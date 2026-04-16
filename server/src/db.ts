import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.trim()) {
  console.error(
    '[db] DATABASE_URL is missing or empty. The pg client will not use Render Postgres.\n' +
      '  → Render: Web Service → Environment → add DATABASE_URL (or link your Postgres resource).\n' +
      '  → Local: set DATABASE_URL in server/.env (not committed to git).',
  );
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  // External Render hostname (local dev or public DB URL) needs SSL; internal Render URL does not
  ssl: connectionString.includes('.render.com') ? { rejectUnauthorized: false } : false,
});

export default pool;
