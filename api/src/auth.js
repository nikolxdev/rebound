import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

const SESSION_DAYS = 7;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const DUMMY_HASH = bcrypt.hashSync(randomBytes(16).toString("hex"), 12);

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function login(pool, email, password) {
  const { rows } = await pool.query("SELECT id, password_hash FROM admins WHERE email = $1", [email.toLowerCase()]);
  const admin = rows[0];
  const ok = await bcrypt.compare(password, admin ? admin.password_hash : DUMMY_HASH);
  if (!admin || !ok) return null;
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `INSERT INTO sessions (token_hash, admin_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`,
    [sha256(token), admin.id],
  );
  await pool.query("DELETE FROM sessions WHERE expires_at < now()");
  return token;
}

export async function logout(pool, token) {
  await pool.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

function bearer(req) {
  const header = req.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export function requireAdmin(pool) {
  return async (req, res, next) => {
    const token = bearer(req);
    if (!token) return res.status(401).json({ error: "unauthorized" });
    const { rows } = await pool.query(
      "SELECT a.id, a.email FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = $1 AND s.expires_at > now()",
      [sha256(token)],
    );
    if (!rows[0]) return res.status(401).json({ error: "unauthorized" });
    req.admin = rows[0];
    req.token = token;
    next();
  };
}
