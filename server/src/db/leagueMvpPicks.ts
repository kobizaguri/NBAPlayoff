import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { LeagueMVPPick } from '../types';

function rowToPick(row: Record<string, unknown>): LeagueMVPPick {
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    userId: row.user_id as string,
    playerName: row.player_name as string,
    isLocked: row.is_locked as boolean,
    pointsAwarded: row.points_awarded as number,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function getPicksByLeague(leagueId: string): Promise<LeagueMVPPick[]> {
  const { rows } = await pool.query(
    'SELECT * FROM league_mvp_picks WHERE league_id=$1',
    [leagueId],
  );
  return rows.map(rowToPick);
}

export async function upsertMvpPick(
  leagueId: string,
  userId: string,
  playerName: string,
): Promise<LeagueMVPPick> {
  const { rows } = await pool.query(
    `INSERT INTO league_mvp_picks (id,league_id,user_id,player_name,updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (league_id,user_id) DO UPDATE SET
       player_name = EXCLUDED.player_name,
       updated_at  = NOW()
     RETURNING *`,
    [uuidv4(), leagueId, userId, playerName],
  );
  return rowToPick(rows[0]);
}

export async function awardMvpPoints(
  leagueId: string,
  playerName: string,
  points: number,
): Promise<void> {
  await pool.query(
    `UPDATE league_mvp_picks
     SET points_awarded = CASE WHEN lower(player_name)=lower($2) THEN $3 ELSE 0 END,
         updated_at     = NOW()
     WHERE league_id=$1`,
    [leagueId, playerName, points],
  );
}
