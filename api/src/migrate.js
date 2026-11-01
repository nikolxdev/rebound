import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createPool, inTransaction } from "./db.js";

const dir = fileURLToPath(new URL("../migrations/", import.meta.url));

export async function migrate(pool) {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const { rows } = await pool.query("SELECT name FROM schema_migrations");
  const done = new Set(rows.map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const applied = [];
  for (const file of files) {
    if (done.has(file)) continue;
    const sql = await readFile(dir + file, "utf8");
    await inTransaction(pool, async (c) => {
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    applied.push(file);
  }
  return applied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = createPool();
  const applied = await migrate(pool);
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "Database is up to date");
  await pool.end();
}
