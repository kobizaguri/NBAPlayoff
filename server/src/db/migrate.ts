import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pool from '../db';

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  // Add columns that may not exist on older tables
  await pool.query(`ALTER TABLE series ADD COLUMN IF NOT EXISTS win_points INT`);
  await pool.query(
    `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS perfect_round_bonuses JSONB NOT NULL DEFAULT '{}'`,
  );
  await pool.query(
    `ALTER TABLE leagues ADD COLUMN IF NOT EXISTS champion_pick_deadline TIMESTAMPTZ`,
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_perfect_round_awards (
      league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      round     TEXT NOT NULL CHECK (round IN ('firstRound','semis','finals','nbaFinals')),
      points    INT NOT NULL,
      PRIMARY KEY (league_id, user_id, round)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_champion_team_points (
      league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      team_id   UUID NOT NULL,
      points    INT NOT NULL,
      PRIMARY KEY (league_id, team_id)
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS league_champion_picks (
      id              UUID PRIMARY KEY,
      league_id       UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      team_id         UUID NOT NULL,
      points_awarded  INT NOT NULL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(league_id, user_id)
    )`);
  console.log('Schema created/verified.');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
