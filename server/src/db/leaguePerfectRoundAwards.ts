import pool from '../db';

export async function replacePerfectRoundAwards(
  leagueId: string,
  rows: { userId: string; round: string; points: number }[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM league_perfect_round_awards WHERE league_id = $1', [leagueId]);
    for (const r of rows) {
      await client.query(
        `INSERT INTO league_perfect_round_awards (league_id, user_id, round, points)
         VALUES ($1, $2, $3, $4)`,
        [leagueId, r.userId, r.round, r.points],
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getPerfectRoundSumByUser(leagueId: string): Promise<Map<string, number>> {
  const { rows } = await pool.query(
    `SELECT user_id, COALESCE(SUM(points), 0)::float AS pts
     FROM league_perfect_round_awards
     WHERE league_id = $1
     GROUP BY user_id`,
    [leagueId],
  );
  const m = new Map<string, number>();
  for (const r of rows) {
    m.set(r.user_id as string, parseFloat(r.pts as string));
  }
  return m;
}
