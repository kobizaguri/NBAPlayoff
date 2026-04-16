import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { Prediction } from '../types';

function rowToPrediction(row: Record<string, unknown>): Prediction {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    leagueId: row.league_id as string,
    seriesId: row.series_id as string,
    predictedWinnerId: row.predicted_winner_id as string,
    predictedSeriesScore: row.predicted_series_score as string | undefined,
    predictedSeriesMvp: row.predicted_series_mvp as string | undefined,
    isLocked: row.is_locked as boolean,
    winnerPoints: parseFloat(row.winner_points as string),
    exactScorePoints: parseFloat(row.exact_score_points as string),
    seriesMvpBonus: parseFloat(row.series_mvp_bonus as string),
    totalPoints: parseFloat(row.total_points as string),
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  };
}

export async function getPredictionsByLeague(leagueId: string): Promise<Prediction[]> {
  const { rows } = await pool.query(
    'SELECT * FROM predictions WHERE league_id = $1',
    [leagueId],
  );
  return rows.map(rowToPrediction);
}

export async function getPredictionsBySeries(seriesId: string): Promise<Prediction[]> {
  const { rows } = await pool.query(
    'SELECT * FROM predictions WHERE series_id = $1',
    [seriesId],
  );
  return rows.map(rowToPrediction);
}

export async function getPredictionsByUser(userId: string): Promise<Prediction[]> {
  const { rows } = await pool.query(
    'SELECT * FROM predictions WHERE user_id = $1',
    [userId],
  );
  return rows.map(rowToPrediction);
}

export async function findPrediction(
  userId: string,
  leagueId: string,
  seriesId: string,
): Promise<Prediction | null> {
  const { rows } = await pool.query(
    'SELECT * FROM predictions WHERE user_id=$1 AND league_id=$2 AND series_id=$3',
    [userId, leagueId, seriesId],
  );
  return rows[0] ? rowToPrediction(rows[0]) : null;
}

export async function upsertPrediction(
  p: Omit<
    Prediction,
    'id' | 'createdAt' | 'updatedAt' | 'isLocked' | 'winnerPoints' | 'exactScorePoints' | 'seriesMvpBonus' | 'totalPoints'
  >,
): Promise<Prediction> {
  const now = new Date().toISOString();
  const { rows } = await pool.query(
    `INSERT INTO predictions
       (id,user_id,league_id,series_id,predicted_winner_id,predicted_series_score,predicted_series_mvp,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (user_id,league_id,series_id) DO UPDATE SET
       predicted_winner_id    = EXCLUDED.predicted_winner_id,
       predicted_series_score = EXCLUDED.predicted_series_score,
       predicted_series_mvp   = EXCLUDED.predicted_series_mvp,
       updated_at             = EXCLUDED.updated_at
     RETURNING *`,
    [
      uuidv4(), p.userId, p.leagueId, p.seriesId, p.predictedWinnerId,
      p.predictedSeriesScore ?? null, p.predictedSeriesMvp ?? null, now,
    ],
  );
  return rowToPrediction(rows[0]);
}

export async function updatePredictionScores(
  id: string,
  scores: {
    winnerPoints: number;
    exactScorePoints: number;
    seriesMvpBonus: number;
    totalPoints: number;
    isLocked: boolean;
  },
): Promise<void> {
  await pool.query(
    `UPDATE predictions
     SET winner_points=$1, exact_score_points=$2, series_mvp_bonus=$3,
         total_points=$4, is_locked=$5, updated_at=NOW()
     WHERE id=$6`,
    [
      scores.winnerPoints, scores.exactScorePoints, scores.seriesMvpBonus,
      scores.totalPoints, scores.isLocked, id,
    ],
  );
}

export async function lockPredictionsForSeries(seriesId: string): Promise<void> {
  await pool.query(
    'UPDATE predictions SET is_locked=true, updated_at=NOW() WHERE series_id=$1 AND is_locked=false',
    [seriesId],
  );
}

export async function deletePrediction(id: string): Promise<void> {
  await pool.query('DELETE FROM predictions WHERE id = $1', [id]);
}
