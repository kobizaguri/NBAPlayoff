import { v4 as uuidv4 } from 'uuid';
import pool from '../db';

export interface ChampionTeamPointRow {
  teamId: string;
  points: number;
}

export interface LeagueChampionPick {
  id: string;
  leagueId: string;
  userId: string;
  teamId: string;
  pointsAwarded: number;
  createdAt: string;
  updatedAt: string;
}

function rowToChampionPick(row: Record<string, unknown>): LeagueChampionPick {
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    userId: row.user_id as string,
    teamId: row.team_id as string,
    pointsAwarded: row.points_awarded as number,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function getChampionTeamPoints(leagueId: string): Promise<ChampionTeamPointRow[]> {
  const { rows } = await pool.query(
    'SELECT team_id AS "teamId", points FROM league_champion_team_points WHERE league_id = $1 ORDER BY points DESC, team_id',
    [leagueId],
  );
  return rows.map((r) => ({ teamId: r.teamId as string, points: r.points as number }));
}

/**
 * Replace configured team points: only teams present in `rows` are kept.
 */
export async function setChampionTeamPoints(
  leagueId: string,
  rows: ChampionTeamPointRow[],
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM league_champion_team_points WHERE league_id = $1', [leagueId]);
    for (const r of rows) {
      if (r.points <= 0) continue;
      await client.query(
        `INSERT INTO league_champion_team_points (league_id, team_id, points) VALUES ($1, $2, $3)`,
        [leagueId, r.teamId, r.points],
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

export async function getChampionPicksByLeague(leagueId: string): Promise<LeagueChampionPick[]> {
  const { rows } = await pool.query(
    'SELECT * FROM league_champion_picks WHERE league_id = $1',
    [leagueId],
  );
  return rows.map(rowToChampionPick);
}

export async function upsertChampionPick(
  leagueId: string,
  userId: string,
  teamId: string,
): Promise<LeagueChampionPick> {
  const { rows } = await pool.query(
    `INSERT INTO league_champion_picks (id, league_id, user_id, team_id, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (league_id, user_id) DO UPDATE SET
       team_id = EXCLUDED.team_id,
       updated_at = NOW()
     RETURNING *`,
    [uuidv4(), leagueId, userId, teamId],
  );
  return rowToChampionPick(rows[0]);
}

export async function updateChampionPickAwardsForLeague(
  leagueId: string,
  nbaFinalsWinnerTeamId: string | null,
  pointByTeamId: Map<string, number>,
): Promise<void> {
  const picks = await getChampionPicksByLeague(leagueId);
  for (const p of picks) {
    let awarded = 0;
    if (nbaFinalsWinnerTeamId && p.teamId === nbaFinalsWinnerTeamId) {
      awarded = pointByTeamId.get(p.teamId) ?? 0;
    }
    await pool.query(
      'UPDATE league_champion_picks SET points_awarded = $1, updated_at = NOW() WHERE id = $2',
      [awarded, p.id],
    );
  }
}
