/**
 * Deletes all application data except rows in `users` (admin and all accounts stay).
 *
 * Clears: leagues, series, predictions, league members, MVP/champion/perfect-round
 * tables, notifications, refresh_tokens (everyone must log in again).
 *
 * Usage (from server/):
 *   EMPTY_DB_CONFIRM=yes npx ts-node-dev --transpile-only src/scripts/emptyDbExceptUsers.ts
 *
 * Or add to package.json: npm run empty-db
 *   (requires EMPTY_DB_CONFIRM=yes in the environment)
 */
import 'dotenv/config';
import pool from '../db';

async function main() {
  if (process.env.EMPTY_DB_CONFIRM !== 'yes') {
    console.error(
      'Refusing to run: set EMPTY_DB_CONFIRM=yes to truncate all tables except users.\n' +
        'Example (PowerShell): $env:EMPTY_DB_CONFIRM="yes"; npm run empty-db',
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Single TRUNCATE: Postgres orders by FK dependencies when all listed together.
    await client.query(`
      TRUNCATE TABLE
        predictions,
        league_members,
        league_mvp_picks,
        league_champion_picks,
        league_champion_team_points,
        league_perfect_round_awards,
        notifications,
        refresh_tokens,
        leagues,
        series
      RESTART IDENTITY CASCADE
    `);

    await client.query('COMMIT');
    console.info('[empty-db] Truncated all tables except users. User accounts and password hashes unchanged.');
    console.info('[empty-db] All refresh tokens removed — users need to sign in again.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[empty-db] Failed:', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
