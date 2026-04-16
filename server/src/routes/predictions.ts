import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { PlayoffSeries } from '../types';
import pool from '../db';
import * as predictionsDb from '../db/predictions';
import * as seriesDb from '../db/series';
import * as leaguesDb from '../db/leagues';

const router = Router({ mergeParams: true });

const VALID_SCORES = ['4-0', '4-1', '4-2', '4-3'];

const predictionSchema = z.object({
  predictedWinnerId: z.string().uuid(),
  predictedSeriesScore: z.enum(['4-0', '4-1', '4-2', '4-3']).optional(),
  predictedSeriesMvp: z.string().max(100).optional(),
});

function isDeadlinePassed(series: PlayoffSeries): boolean {
  return series.isLockedManually || new Date(series.deadline) <= new Date();
}

// ─── GET predictions for a league ────────────────────────────────────────────

router.get('/:leagueId/predictions', requireAuth, async (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;

  try {
    const league = await leaguesDb.getLeagueById(leagueId);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const memberCheck = await leaguesDb.isMember(leagueId, req.user!.userId);
    if (!memberCheck && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    const [allPredictions, series] = await Promise.all([
      predictionsDb.getPredictionsByLeague(leagueId),
      seriesDb.getAllSeries(),
    ]);

    // Before deadline: only show the current user's own predictions
    const result = allPredictions.filter((p) => {
      const s = series.find((sr) => sr.id === p.seriesId);
      if (!s) return false;
      const locked = isDeadlinePassed(s);
      return locked || p.userId === req.user!.userId || req.user!.isAdmin;
    });

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── UPSERT prediction ────────────────────────────────────────────────────────

router.post('/:leagueId/predictions', requireAuth, async (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;

  try {
    const league = await leaguesDb.getLeagueById(leagueId);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const memberCheck = await leaguesDb.isMember(leagueId, req.user!.userId);
    if (!memberCheck) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    const parsed = predictionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { predictedWinnerId, predictedSeriesScore, predictedSeriesMvp } = parsed.data;
    const { seriesId } = req.body as { seriesId?: string };
    if (!seriesId) {
      res.status(400).json({ error: 'seriesId is required' });
      return;
    }

    const series = await seriesDb.getSeriesById(seriesId);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    if (series.status === 'complete') {
      res.status(403).json({ error: 'Series is already complete' });
      return;
    }

    if (isDeadlinePassed(series)) {
      res.status(403).json({ error: 'Prediction deadline has passed' });
      return;
    }

    // Validate predicted winner is one of the two teams
    if (predictedWinnerId !== series.homeTeamId && predictedWinnerId !== series.awayTeamId) {
      res.status(400).json({ error: 'Predicted winner must be one of the two competing teams' });
      return;
    }

    // Non-playIn series require a series score
    if (series.round !== 'playIn' && !predictedSeriesScore) {
      res.status(400).json({ error: 'predictedSeriesScore is required for non-Play-In series' });
      return;
    }

    const prediction = await predictionsDb.upsertPrediction({
      userId: req.user!.userId,
      leagueId,
      seriesId,
      predictedWinnerId,
      predictedSeriesScore,
      predictedSeriesMvp,
    });

    res.status(201).json(prediction);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── DELETE prediction ────────────────────────────────────────────────────────

router.delete(
  '/:leagueId/predictions/:predictionId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { leagueId, predictionId } = req.params;

    try {
      const { rows } = await pool.query(
        'SELECT * FROM predictions WHERE id=$1 AND user_id=$2 AND league_id=$3',
        [predictionId, req.user!.userId, leagueId],
      );

      if (!rows[0]) {
        res.status(404).json({ error: 'Prediction not found' });
        return;
      }

      const series = await seriesDb.getSeriesById(rows[0].series_id as string);
      if (series && isDeadlinePassed(series)) {
        res.status(403).json({ error: 'Cannot delete a locked prediction' });
        return;
      }

      await predictionsDb.deletePrediction(predictionId);
      res.sendStatus(204);
    } catch {
      res.status(500).json({ error: 'Database error' });
    }
  },
);

export { VALID_SCORES };
export default router;
