import { randomBytes } from "node:crypto";
import { createPool } from "./db.js";
import { migrate } from "./migrate.js";
import { CLOSE, OPEN, addDays, price, toInstant, today } from "./rules.js";

const NAMES = [
  "Marko P.", "Jelena S.", "Stefan M.", "Ana Đ.", "Nikola R.", "Milica T.", "Luka V.",
  "Teodora K.", "Vuk J.", "Sara N.", "Filip B.", "Ivana L.", "Dušan G.", "Katarina Ž.",
];

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const pool = createPool();
await migrate(pool);
const { rows: courts } = await pool.query("SELECT id FROM courts ORDER BY sort_order");
const start = today();
let added = 0;

for (let day = 0; day < 7; day++) {
  const date = addDays(start, day);
  for (const court of courts) {
    let t = OPEN + Math.floor(rand() * 4) * 30;
    while (t < CLOSE - 60) {
      const duration = [60, 90, 90, 120][Math.floor(rand() * 4)];
      const evening = t >= 16 * 60;
      if (t + duration <= CLOSE && rand() < (evening ? 0.55 : 0.22)) {
        const name = NAMES[Math.floor(rand() * NAMES.length)];
        const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
        const res = await pool.query(
          `INSERT INTO bookings (code, cancel_token, court_id, starts_at, ends_at, name, email, phone, price_rsd)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
          [code, randomBytes(18).toString("base64url"), court.id, toInstant(date, t), toInstant(date, t + duration),
            name, "demo@example.com", "060 000 0000", price(date, t, duration)],
        ).catch(() => ({ rowCount: 0 }));
        added += res.rowCount;
        t += duration;
      } else {
        t += 30 * (1 + Math.floor(rand() * 3));
      }
    }
  }
}

console.log(`Dodato ${added} demo rezervacija za narednih 7 dana.`);
await pool.end();
