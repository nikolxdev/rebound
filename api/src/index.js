import { createApp } from "./app.js";
import { createPool } from "./db.js";
import { createMailer } from "./mail.js";
import { migrate } from "./migrate.js";

const pool = createPool();
const applied = await migrate(pool);
if (applied.length) console.log(`Migrations applied: ${applied.join(", ")}`);

const app = createApp({ pool, mailer: createMailer() });
const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`Rebound API on http://localhost:${port}`));
