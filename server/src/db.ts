import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // External Render URL (local dev) needs SSL; internal URL (deployed on Render) does not
  ssl: process.env.DATABASE_URL?.includes('.render.com') ? { rejectUnauthorized: false } : false,
});

export default pool;
