import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { PlayoffSeries } from '../types';

function rowToSeries(row: Record<string, unknown>): PlayoffSeries {
  return {
    id: row.id as string,
    round: row.round as PlayoffSeries['round'],
    conference: row.conference as PlayoffSeries['conference'],
    homeTeamId: row.home_team_id as string,
    awayTeamId: row.away_team_id as string,
    homeTeamName: row.home_team_name as string,
    awayTeamName: row.away_team_name as string,
    homeTeamSeed: row.home_team_seed as number,
    awayTeamSeed: row.away_team_seed as number,
    homeOdds: parseFloat(row.home_odds as string),
    awayOdds: parseFloat(row.away_odds as string),
    oddsLockedAt: row.odds_locked_at
      ? (row.odds_locked_at as Date).toISOString()
      : undefined,
    homeWins: row.home_wins as number,
    awayWins: row.away_wins as number,
    status: row.status as PlayoffSeries['status'],
    winnerId: row.winner_id as string | undefined,
    finalSeriesScore: row.final_series_score as string | undefined,
    seriesMvpPoints: row.series_mvp_points as number,
    seriesMvpWinner: row.series_mvp_winner as string | undefined,
    winPoints: row.win_points != null ? (row.win_points as number) : undefined,
    deadline: (row.deadline as Date).toISOString(),
    isLockedManually: row.is_locked_manually as boolean,
  };
}

export async function getAllSeries(): Promise<PlayoffSeries[]> {
  const { rows } = await pool.query('SELECT * FROM series ORDER BY round, conference');
  return rows.map(rowToSeries);
}

export async function getSeriesById(id: string): Promise<PlayoffSeries | null> {
  const { rows } = await pool.query('SELECT * FROM series WHERE id = $1', [id]);
  return rows[0] ? rowToSeries(rows[0]) : null;
}

export async function createSeries(
  s: Omit<PlayoffSeries, 'homeWins' | 'awayWins' | 'status' | 'isLockedManually'> & { id?: string },
): Promise<PlayoffSeries> {
  const id = s.id ?? uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO series (id,round,conference,home_team_id,away_team_id,home_team_name,away_team_name,
      home_team_seed,away_team_seed,home_odds,away_odds,series_mvp_points,win_points,deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [
      id, s.round, s.conference, s.homeTeamId, s.awayTeamId,
      s.homeTeamName, s.awayTeamName, s.homeTeamSeed, s.awayTeamSeed,
      s.homeOdds, s.awayOdds, s.seriesMvpPoints, s.winPoints ?? null, s.deadline,
    ],
  );
  return rowToSeries(rows[0]);
}

export async function updateSeries(
  id: string,
  patch: Partial<PlayoffSeries>,
): Promise<PlayoffSeries | null> {
  const colMap: Partial<Record<keyof PlayoffSeries, string>> = {
    homeTeamName: 'home_team_name',
    awayTeamName: 'away_team_name',
    homeTeamSeed: 'home_team_seed',
    awayTeamSeed: 'away_team_seed',
    homeOdds: 'home_odds',
    awayOdds: 'away_odds',
    oddsLockedAt: 'odds_locked_at',
    homeWins: 'home_wins',
    awayWins: 'away_wins',
    status: 'status',
    winnerId: 'winner_id',
    finalSeriesScore: 'final_series_score',
    seriesMvpPoints: 'series_mvp_points',
    seriesMvpWinner: 'series_mvp_winner',
    winPoints: 'win_points',
    deadline: 'deadline',
    isLockedManually: 'is_locked_manually',
  };

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(colMap) as [keyof PlayoffSeries, string][]) {
    if (key in patch) {
      sets.push(`${col} = $${i++}`);
      vals.push((patch as Record<string, unknown>)[key] ?? null);
    }
  }
  if (sets.length === 0) return getSeriesById(id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE series SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  return rows[0] ? rowToSeries(rows[0]) : null;
}

export async function deleteSeries(id: string): Promise<void> {
  await pool.query('DELETE FROM series WHERE id = $1', [id]);
}
