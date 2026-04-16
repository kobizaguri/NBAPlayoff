import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { League, LeagueMember, PerfectRoundBonuses } from '../types';

function parsePerfectRoundBonuses(raw: unknown): PerfectRoundBonuses {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: PerfectRoundBonuses = {};
  for (const k of ['firstRound', 'semis', 'finals', 'nbaFinals'] as const) {
    const v = o[k];
    if (typeof v === 'number' && v > 0) out[k] = v;
  }
  return out;
}

function rowToLeague(row: Record<string, unknown>): League {
  const champRaw = row.champion_pick_deadline;
  const championPickDeadline =
    champRaw != null ? (champRaw as Date).toISOString() : null;
  return {
    id: row.id as string,
    name: row.name as string,
    inviteCode: row.invite_code as string,
    passwordHash: row.password_hash as string | undefined,
    commissionerId: row.commissioner_id as string,
    isPublic: row.is_public as boolean,
    maxMembers: row.max_members as number,
    baseWinPoints: row.base_win_points as number,
    exactScoreBonus: row.exact_score_bonus as number,
    playInWinPoints: row.play_in_win_points as number,
    mvpPoints: row.mvp_points as number,
    mvpDeadline: (row.mvp_deadline as Date).toISOString(),
    finalsActualMvp: row.finals_actual_mvp as string | undefined,
    perfectRoundBonuses: parsePerfectRoundBonuses(row.perfect_round_bonuses),
    championPickDeadline,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getAllLeagues(): Promise<League[]> {
  const { rows } = await pool.query('SELECT * FROM leagues ORDER BY created_at');
  return rows.map(rowToLeague);
}

export async function getLeagueById(id: string): Promise<League | null> {
  const { rows } = await pool.query('SELECT * FROM leagues WHERE id = $1', [id]);
  return rows[0] ? rowToLeague(rows[0]) : null;
}

export async function getLeagueByInviteCode(code: string): Promise<League | null> {
  const { rows } = await pool.query(
    'SELECT * FROM leagues WHERE invite_code = $1',
    [code],
  );
  return rows[0] ? rowToLeague(rows[0]) : null;
}

export async function leagueNameExists(name: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM leagues WHERE lower(name)=lower($1)',
    [name],
  );
  return rows.length > 0;
}

export async function createLeague(
  l: Omit<League, 'createdAt'> & { id?: string },
): Promise<League> {
  const id = l.id ?? uuidv4();
  const prb = JSON.stringify(l.perfectRoundBonuses ?? {});
  const champDl = l.championPickDeadline ?? null;
  const { rows } = await pool.query(
    `INSERT INTO leagues (id,name,invite_code,password_hash,commissioner_id,is_public,max_members,
      base_win_points,exact_score_bonus,play_in_win_points,mvp_points,mvp_deadline,
      perfect_round_bonuses, champion_pick_deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14) RETURNING *`,
    [
      id, l.name, l.inviteCode, l.passwordHash ?? null, l.commissionerId,
      l.isPublic, l.maxMembers, l.baseWinPoints, l.exactScoreBonus,
      l.playInWinPoints, l.mvpPoints, l.mvpDeadline,
      prb,
      champDl,
    ],
  );
  return rowToLeague(rows[0]);
}

export async function updateLeague(
  id: string,
  patch: Partial<League>,
): Promise<League | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.isPublic !== undefined) {
    sets.push(`is_public = $${i++}`);
    vals.push(patch.isPublic);
  }
  if (patch.maxMembers !== undefined) {
    sets.push(`max_members = $${i++}`);
    vals.push(patch.maxMembers);
  }
  if (patch.finalsActualMvp !== undefined) {
    sets.push(`finals_actual_mvp = $${i++}`);
    vals.push(patch.finalsActualMvp);
  }
  if (patch.perfectRoundBonuses !== undefined) {
    sets.push(`perfect_round_bonuses = $${i++}::jsonb`);
    vals.push(JSON.stringify(patch.perfectRoundBonuses));
  }
  if (patch.championPickDeadline !== undefined) {
    sets.push(`champion_pick_deadline = $${i++}`);
    vals.push(patch.championPickDeadline);
  }
  if (sets.length === 0) return getLeagueById(id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE leagues SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  return rows[0] ? rowToLeague(rows[0]) : null;
}

// ── Members ─────────────────────────────────────────────────────────────────

export async function getMembersByLeague(leagueId: string): Promise<LeagueMember[]> {
  const { rows } = await pool.query(
    'SELECT * FROM league_members WHERE league_id = $1',
    [leagueId],
  );
  return rows.map((r) => ({
    leagueId: r.league_id as string,
    userId: r.user_id as string,
    joinedAt: (r.joined_at as Date).toISOString(),
  }));
}

export async function isMember(leagueId: string, userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM league_members WHERE league_id=$1 AND user_id=$2',
    [leagueId, userId],
  );
  return rows.length > 0;
}

export async function addMember(leagueId: string, userId: string): Promise<void> {
  await pool.query(
    'INSERT INTO league_members (league_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
    [leagueId, userId],
  );
}

export async function removeMember(leagueId: string, userId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    'DELETE FROM league_members WHERE league_id=$1 AND user_id=$2',
    [leagueId, userId],
  );
  return (rowCount ?? 0) > 0;
}

/** Removes membership and all league-scoped rows for this user (predictions, MVP, champion, perfect-round). */
export async function leaveLeagueAndClearUserData(leagueId: string, userId: string): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM predictions WHERE league_id = $1 AND user_id = $2', [
      leagueId,
      userId,
    ]);
    await client.query('DELETE FROM league_mvp_picks WHERE league_id = $1 AND user_id = $2', [
      leagueId,
      userId,
    ]);
    await client.query('DELETE FROM league_champion_picks WHERE league_id = $1 AND user_id = $2', [
      leagueId,
      userId,
    ]);
    await client.query(
      'DELETE FROM league_perfect_round_awards WHERE league_id = $1 AND user_id = $2',
      [leagueId, userId],
    );
    const { rowCount } = await client.query(
      'DELETE FROM league_members WHERE league_id = $1 AND user_id = $2',
      [leagueId, userId],
    );
    await client.query('COMMIT');
    return (rowCount ?? 0) > 0;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getLeaguesByUserId(userId: string): Promise<League[]> {
  const { rows } = await pool.query(
    `SELECT l.*, (m.user_id IS NOT NULL) AS is_member
     FROM leagues l
     LEFT JOIN league_members m ON m.league_id = l.id AND m.user_id = $1
     WHERE l.is_public = true OR m.user_id IS NOT NULL
     ORDER BY l.created_at`,
    [userId],
  );
  return rows.map((row) => ({
    ...rowToLeague(row),
    isMember: Boolean(row.is_member),
  }));
}

export async function getLeagueIdsByUser(userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    'SELECT league_id FROM league_members WHERE user_id = $1',
    [userId],
  );
  return rows.map((r) => r.league_id as string);
}

export async function getMemberCount(leagueId: string): Promise<number> {
  const { rows } = await pool.query(
    'SELECT COUNT(*) FROM league_members WHERE league_id = $1',
    [leagueId],
  );
  return parseInt(rows[0].count as string, 10);
}
