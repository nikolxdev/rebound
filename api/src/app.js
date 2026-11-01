import { randomBytes, randomInt } from "node:crypto";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { login, logout, requireAdmin } from "./auth.js";
import { inTransaction } from "./db.js";
import { confirmationMail, ownerMail } from "./mail.js";
import { rateLimit } from "./rate-limit.js";
import {
  CANCEL_BEFORE, CLOSE, DAYS_AHEAD, DURATIONS, OPEN, PEAK_FROM, PRICES, STEP,
  addDays, isDate, price, slotError, toInstant, toLocal, today,
} from "./rules.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const BOOKING_SELECT = `
  SELECT b.*, c.slug, c.name AS court_name
  FROM bookings b JOIN courts c ON c.id = b.court_id`;

function shapeBooking(row, { full = false } = {}) {
  const s = toLocal(row.starts_at);
  const booking = {
    code: row.code,
    court: row.slug,
    courtName: row.court_name,
    date: s.date,
    start: s.minutes,
    duration: Math.round((row.ends_at - row.starts_at) / 60000),
    name: row.name,
    price: row.price_rsd,
    status: row.status,
  };
  if (full) Object.assign(booking, { id: row.id, email: row.email, phone: row.phone });
  return booking;
}

function shapeBlock(row) {
  const s = toLocal(row.starts_at);
  return {
    id: row.id,
    court: row.slug,
    date: s.date,
    start: s.minutes,
    duration: Math.round((row.ends_at - row.starts_at) / 60000),
    reason: row.reason,
  };
}

const bookingBody = z.object({
  court: z.string(),
  date: z.string(),
  start: z.number().int(),
  duration: z.number().int(),
  name: z.string().trim().min(2).max(80),
  email: z.email().max(120),
  phone: z.string().trim().regex(/^[+0-9 ()/-]{6,20}$/),
});

const moveBody = z.object({
  court: z.string().optional(),
  date: z.string().optional(),
  start: z.number().int().optional(),
  duration: z.number().int().optional(),
});

const blockBody = z.object({
  court: z.string(),
  date: z.string(),
  start: z.number().int(),
  duration: z.number().int(),
  reason: z.string().trim().max(120).default(""),
});

const BLOCK_DURATIONS = Array.from({ length: (CLOSE - OPEN) / STEP }, (_, i) => (i + 1) * STEP);

function parse(schema, body) {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const field = result.error.issues[0]?.path?.[0];
    throw new HttpError(400, field ? `bad_${field}` : "bad_request");
  }
  return result.data;
}

async function findCourt(db, slug) {
  const { rows } = await db.query("SELECT id, slug, name FROM courts WHERE slug = $1", [slug]);
  if (!rows[0]) throw new HttpError(400, "bad_court");
  return rows[0];
}

async function assertNotBlocked(db, courtId, startsAt, endsAt) {
  const { rows } = await db.query(
    "SELECT 1 FROM blocks WHERE court_id = $1 AND tstzrange(starts_at, ends_at) && tstzrange($2, $3) LIMIT 1",
    [courtId, startsAt, endsAt],
  );
  if (rows[0]) throw new HttpError(409, "taken");
}

function overlapToConflict(err) {
  if (err.code === "23P01") throw new HttpError(409, "taken");
  throw err;
}

export function createApp({ pool, mailer, now = () => new Date(), env = process.env }) {
  const app = express();
  const webUrl = (env.WEB_URL || "http://localhost:5173/").replace(/\/?$/, "/");
  const origins = (env.WEB_ORIGIN || "http://localhost:5173").split(",").map((s) => s.trim());
  const limit = (opts) => (env.RATE_LIMIT === "off" ? (req, res, next) => next() : rateLimit(opts));
  const sendQuietly = (mail) => Promise.resolve(mailer(mail)).catch((e) => console.error("[mail]", e.message));

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: origins, allowedHeaders: ["content-type", "authorization"] }));
  app.use(express.json({ limit: "20kb" }));

  app.get("/api/health", async (req, res) => {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  });

  app.get("/api/config", (req, res) => {
    res.json({
      open: OPEN, close: CLOSE, step: STEP, durations: DURATIONS, daysAhead: DAYS_AHEAD,
      prices: PRICES, peakFrom: PEAK_FROM, cancelBefore: CANCEL_BEFORE,
      today: today(now()), now: now().toISOString(),
    });
  });

  app.get("/api/courts", async (req, res) => {
    const { rows } = await pool.query("SELECT slug, name, indoor FROM courts ORDER BY sort_order");
    res.json(rows);
  });

  app.get("/api/availability", async (req, res) => {
    const date = String(req.query.date || "");
    if (!isDate(date)) throw new HttpError(400, "bad_date");
    const from = toInstant(date, 0);
    const to = toInstant(addDays(date, 1), 0);
    const params = [from, to];
    const [courts, busy] = await Promise.all([
      pool.query("SELECT id, slug FROM courts ORDER BY sort_order"),
      pool.query(
        `SELECT court_id, starts_at, ends_at FROM bookings WHERE status = 'confirmed' AND starts_at < $2 AND ends_at > $1
         UNION ALL
         SELECT court_id, starts_at, ends_at FROM blocks WHERE starts_at < $2 AND ends_at > $1`,
        params,
      ),
    ]);
    const dayLength = (to - from) / 60000;
    const result = courts.rows.map((c) => ({
      court: c.slug,
      busy: busy.rows
        .filter((b) => b.court_id === c.id)
        .map((b) => ({
          start: Math.max(0, Math.round((b.starts_at - from) / 60000)),
          end: Math.min(dayLength, Math.round((b.ends_at - from) / 60000)),
        }))
        .sort((a, b) => a.start - b.start),
    }));
    res.json({ date, courts: result });
  });

  app.post("/api/bookings", limit({ windowMs: 60 * 60 * 1000, max: 12 }), async (req, res) => {
    const body = parse(bookingBody, req.body);
    const error = slotError(body, now());
    if (error) throw new HttpError(400, error);
    const startsAt = toInstant(body.date, body.start);
    const endsAt = toInstant(body.date, body.start + body.duration);
    const total = price(body.date, body.start, body.duration);
    const token = randomBytes(18).toString("base64url");

    const row = await inTransaction(pool, async (db) => {
      const court = await findCourt(db, body.court);
      await assertNotBlocked(db, court.id, startsAt, endsAt);
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await db.query("SAVEPOINT insert_booking");
          const { rows } = await db.query(
            `INSERT INTO bookings (code, cancel_token, court_id, starts_at, ends_at, name, email, phone, price_rsd)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [newCode(), token, court.id, startsAt, endsAt, body.name, body.email.toLowerCase(), body.phone, total],
          );
          return { ...rows[0], slug: court.slug, court_name: court.name };
        } catch (err) {
          await db.query("ROLLBACK TO SAVEPOINT insert_booking");
          if (err.code === "23505" && err.constraint === "bookings_code_key") continue;
          overlapToConflict(err);
        }
      }
      throw new Error("could not create a unique booking code");
    });

    const booking = shapeBooking(row);
    res.status(201).json({ ...booking, token });
    const mailData = { ...booking, email: row.email, phone: row.phone, token };
    sendQuietly(confirmationMail(mailData, webUrl));
    if (env.OWNER_EMAIL) sendQuietly(ownerMail(mailData, "new", env.OWNER_EMAIL));
  });

  async function bookingByCode(code, token) {
    const { rows } = await pool.query(`${BOOKING_SELECT} WHERE b.code = $1`, [String(code).toUpperCase()]);
    const row = rows[0];
    if (!row || !token || row.cancel_token !== token) throw new HttpError(404, "not_found");
    return row;
  }

  app.get("/api/bookings/:code", async (req, res) => {
    const row = await bookingByCode(req.params.code, String(req.query.t || ""));
    res.json(shapeBooking(row));
  });

  app.post("/api/bookings/:code/cancel", limit({ windowMs: 15 * 60 * 1000, max: 20 }), async (req, res) => {
    const row = await bookingByCode(req.params.code, String(req.body?.token || ""));
    if (row.status === "cancelled") return res.json(shapeBooking(row));
    if ((row.starts_at - now()) / 60000 < CANCEL_BEFORE) throw new HttpError(409, "too_late");
    await pool.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [row.id]);
    const booking = shapeBooking({ ...row, status: "cancelled" });
    res.json(booking);
    if (env.OWNER_EMAIL) sendQuietly(ownerMail({ ...booking, email: row.email, phone: row.phone }, "cancel", env.OWNER_EMAIL));
  });

  const admin = express.Router();
  const auth = requireAdmin(pool);

  admin.post("/login", limit({ windowMs: 15 * 60 * 1000, max: 8 }), async (req, res) => {
    const { email, password } = parse(z.object({ email: z.string(), password: z.string() }), req.body);
    const token = await login(pool, email, password);
    if (!token) throw new HttpError(401, "wrong_login");
    res.json({ token });
  });

  admin.post("/logout", auth, async (req, res) => {
    await logout(pool, req.token);
    res.status(204).end();
  });

  admin.get("/me", auth, (req, res) => res.json({ email: req.admin.email }));

  admin.get("/schedule", auth, async (req, res) => {
    const from = String(req.query.from || "");
    const days = Math.min(14, Math.max(1, Number(req.query.days) || 7));
    if (!isDate(from)) throw new HttpError(400, "bad_date");
    const params = [toInstant(from, 0), toInstant(addDays(from, days), 0)];
    const [bookings, blocks] = await Promise.all([
      pool.query(`${BOOKING_SELECT} WHERE b.starts_at < $2 AND b.ends_at > $1 ORDER BY b.starts_at`, params),
      pool.query(
        "SELECT k.*, c.slug FROM blocks k JOIN courts c ON c.id = k.court_id WHERE k.starts_at < $2 AND k.ends_at > $1 ORDER BY k.starts_at",
        params,
      ),
    ]);
    res.json({
      from,
      days,
      bookings: bookings.rows.map((r) => shapeBooking(r, { full: true })),
      blocks: blocks.rows.map(shapeBlock),
    });
  });

  admin.patch("/bookings/:id", auth, async (req, res) => {
    const body = parse(moveBody, req.body);
    const updated = await inTransaction(pool, async (db) => {
      const { rows } = await db.query(`${BOOKING_SELECT} WHERE b.id = $1 FOR UPDATE OF b`, [Number(req.params.id)]);
      if (!rows[0]) throw new HttpError(404, "not_found");
      const current = shapeBooking(rows[0]);
      const next = { ...current, ...Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)) };
      const error = slotError(next, now());
      if (error) throw new HttpError(400, error);
      const court = await findCourt(db, next.court);
      const startsAt = toInstant(next.date, next.start);
      const endsAt = toInstant(next.date, next.start + next.duration);
      await assertNotBlocked(db, court.id, startsAt, endsAt);
      try {
        const { rows: out } = await db.query(
          "UPDATE bookings SET court_id = $2, starts_at = $3, ends_at = $4, price_rsd = $5 WHERE id = $1 RETURNING *",
          [rows[0].id, court.id, startsAt, endsAt, price(next.date, next.start, next.duration)],
        );
        return { ...out[0], slug: court.slug, court_name: court.name };
      } catch (err) {
        overlapToConflict(err);
      }
    });
    res.json(shapeBooking(updated, { full: true }));
  });

  admin.post("/bookings/:id/cancel", auth, async (req, res) => {
    const { rows } = await pool.query(
      "UPDATE bookings SET status = 'cancelled' WHERE id = $1 RETURNING id",
      [Number(req.params.id)],
    );
    if (!rows[0]) throw new HttpError(404, "not_found");
    const { rows: out } = await pool.query(`${BOOKING_SELECT} WHERE b.id = $1`, [rows[0].id]);
    res.json(shapeBooking(out[0], { full: true }));
  });

  admin.post("/blocks", auth, async (req, res) => {
    const body = parse(blockBody, req.body);
    const error = slotError(body, now(), { durations: BLOCK_DURATIONS });
    if (error) throw new HttpError(400, error);
    const startsAt = toInstant(body.date, body.start);
    const endsAt = toInstant(body.date, body.start + body.duration);
    const row = await inTransaction(pool, async (db) => {
      const court = await findCourt(db, body.court);
      const clash = await db.query(
        "SELECT 1 FROM bookings WHERE court_id = $1 AND status = 'confirmed' AND tstzrange(starts_at, ends_at) && tstzrange($2, $3) LIMIT 1",
        [court.id, startsAt, endsAt],
      );
      if (clash.rows[0]) throw new HttpError(409, "taken");
      try {
        const { rows } = await db.query(
          "INSERT INTO blocks (court_id, starts_at, ends_at, reason) VALUES ($1, $2, $3, $4) RETURNING *",
          [court.id, startsAt, endsAt, body.reason],
        );
        return { ...rows[0], slug: court.slug };
      } catch (err) {
        overlapToConflict(err);
      }
    });
    res.status(201).json(shapeBlock(row));
  });

  admin.delete("/blocks/:id", auth, async (req, res) => {
    const { rowCount } = await pool.query("DELETE FROM blocks WHERE id = $1", [Number(req.params.id)]);
    if (!rowCount) throw new HttpError(404, "not_found");
    res.status(204).end();
  });

  app.use("/api/admin", admin);

  app.use((req, res) => res.status(404).json({ error: "not_found" }));

  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.code });
    if (err.type === "entity.parse.failed") return res.status(400).json({ error: "bad_request" });
    console.error(err);
    res.status(500).json({ error: "server_error" });
  });

  return app;
}
