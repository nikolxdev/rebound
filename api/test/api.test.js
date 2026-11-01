import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword } from "../src/auth.js";
import { createPool } from "../src/db.js";
import { migrate } from "../src/migrate.js";

const url = process.env.TEST_DATABASE_URL;
const pool = url ? createPool(url) : null;
const mails = [];
let clock = new Date("2026-11-04T09:15:00Z");
const app = pool && createApp({
  pool,
  mailer: (m) => mails.push(m),
  now: () => clock,
  env: { WEB_URL: "https://example.test/rebound/", WEB_ORIGIN: "https://example.test", OWNER_EMAIL: "owner@example.test", RATE_LIMIT: "off" },
});

const book = (over = {}) =>
  request(app).post("/api/bookings").send({
    court: "morava", date: "2026-11-05", start: 18 * 60, duration: 90,
    name: "Marko Petrović", email: "marko@example.test", phone: "060 123 4567", ...over,
  });

async function adminToken() {
  const res = await request(app).post("/api/admin/login").send({ email: "admin@example.test", password: "dobra-lozinka-123" });
  return res.body.token;
}

describe.skipIf(!pool)("API", () => {
  beforeAll(async () => {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    await migrate(pool);
    await pool.query("INSERT INTO admins (email, password_hash) VALUES ($1, $2)", [
      "admin@example.test", await hashPassword("dobra-lozinka-123"),
    ]);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE bookings, blocks, sessions RESTART IDENTITY");
    mails.length = 0;
    clock = new Date("2026-11-04T09:15:00Z");
  });

  afterAll(() => pool.end());

  test("lists courts and config", async () => {
    const courts = await request(app).get("/api/courts");
    expect(courts.body.map((c) => c.slug)).toEqual(["morava", "ovcar", "kablar", "jelica"]);
    const config = await request(app).get("/api/config");
    expect(config.body.today).toBe("2026-11-04");
  });

  test("books a court, shows it as busy and sends emails", async () => {
    const res = await book();
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ court: "morava", date: "2026-11-05", start: 1080, duration: 90, price: 4800 });
    expect(res.body.code).toMatch(/^[A-Z2-9]{6}$/);

    const day = await request(app).get("/api/availability?date=2026-11-05");
    const morava = day.body.courts.find((c) => c.court === "morava");
    expect(morava.busy).toEqual([{ start: 1080, end: 1170 }]);

    await new Promise((r) => setTimeout(r, 10));
    expect(mails.map((m) => m.to).sort()).toEqual(["marko@example.test", "owner@example.test"]);
    expect(mails.find((m) => m.to === "marko@example.test").text).toContain(`#/rezervacija/${res.body.code}?t=${res.body.token}`);
  });

  test("never allows two bookings on the same court at the same time", async () => {
    const results = await Promise.all([book(), book({ start: 18 * 60 + 30 }), book({ start: 17 * 60, duration: 120 })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    expect((await book({ court: "ovcar" })).status).toBe(201);
    expect((await book({ start: 20 * 60 })).status).toBe(201);
  });

  test("rejects invalid bookings", async () => {
    expect((await book({ start: 22 * 60 })).body.error).toBe("closed");
    expect((await book({ date: "2026-11-04", start: 9 * 60 })).body.error).toBe("past");
    expect((await book({ email: "nije-mejl" })).body.error).toBe("bad_email");
    expect((await book({ court: "wimbledon" })).body.error).toBe("bad_court");
  });

  test("customer can see and cancel a booking with the link, but not too late", async () => {
    const { body } = await book();
    expect((await request(app).get(`/api/bookings/${body.code}?t=wrong`)).status).toBe(404);
    const seen = await request(app).get(`/api/bookings/${body.code}?t=${body.token}`);
    expect(seen.body.status).toBe("confirmed");

    clock = new Date("2026-11-05T16:30:00Z");
    const late = await request(app).post(`/api/bookings/${body.code}/cancel`).send({ token: body.token });
    expect(late.body.error).toBe("too_late");

    clock = new Date("2026-11-05T12:00:00Z");
    const ok = await request(app).post(`/api/bookings/${body.code}/cancel`).send({ token: body.token });
    expect(ok.body.status).toBe("cancelled");
    expect((await book()).status).toBe(201);
  });

  test("admin endpoints need a valid login", async () => {
    expect((await request(app).get("/api/admin/me")).status).toBe(401);
    const wrong = await request(app).post("/api/admin/login").send({ email: "admin@example.test", password: "pogresna" });
    expect(wrong.status).toBe(401);
    const token = await adminToken();
    const me = await request(app).get("/api/admin/me").set("authorization", `Bearer ${token}`);
    expect(me.body.email).toBe("admin@example.test");
    await request(app).post("/api/admin/logout").set("authorization", `Bearer ${token}`);
    expect((await request(app).get("/api/admin/me").set("authorization", `Bearer ${token}`)).status).toBe(401);
  });

  test("admin moves a booking and cannot move it onto another one", async () => {
    const token = await adminToken();
    const auth = { authorization: `Bearer ${token}` };
    await book();
    await book({ court: "ovcar", start: 20 * 60, duration: 60 });
    const { body } = await request(app).get("/api/admin/schedule?from=2026-11-05&days=1").set(auth);
    const first = body.bookings.find((b) => b.court === "morava");

    const moved = await request(app).patch(`/api/admin/bookings/${first.id}`).set(auth).send({ court: "ovcar", start: 18 * 60 });
    expect(moved.body).toMatchObject({ court: "ovcar", start: 1080, duration: 90 });

    const clash = await request(app).patch(`/api/admin/bookings/${first.id}`).set(auth).send({ start: 19 * 60 + 30 });
    expect(clash.status).toBe(409);
  });

  test("blocked time cannot be booked, and blocks cannot cover bookings", async () => {
    const auth = { authorization: `Bearer ${await adminToken()}` };
    const block = await request(app).post("/api/admin/blocks").set(auth)
      .send({ court: "kablar", date: "2026-11-05", start: 8 * 60, duration: 240, reason: "Turnir" });
    expect(block.status).toBe(201);
    expect((await book({ court: "kablar", start: 9 * 60, duration: 60 })).status).toBe(409);

    await book({ court: "jelica" });
    const over = await request(app).post("/api/admin/blocks").set(auth)
      .send({ court: "jelica", date: "2026-11-05", start: 17 * 60, duration: 180 });
    expect(over.status).toBe(409);

    await request(app).delete(`/api/admin/blocks/${block.body.id}`).set(auth).expect(204);
    expect((await book({ court: "kablar", start: 9 * 60, duration: 60 })).status).toBe(201);
  });
});
