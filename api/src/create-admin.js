import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "./auth.js";
import { createPool } from "./db.js";
import { migrate } from "./migrate.js";

const rl = createInterface({ input: stdin, output: stdout });
const email = (process.env.ADMIN_EMAIL || (await rl.question("Email: "))).trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || (await rl.question("Lozinka (najmanje 10 znakova): "));
rl.close();

if (!email.includes("@") || password.length < 10) {
  console.error("Email nije ispravan ili je lozinka kraća od 10 znakova.");
  process.exit(1);
}

const pool = createPool();
await migrate(pool);
await pool.query(
  `INSERT INTO admins (email, password_hash) VALUES ($1, $2)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`,
  [email, await hashPassword(password)],
);
console.log(`Admin ${email} je spreman.`);
await pool.end();
