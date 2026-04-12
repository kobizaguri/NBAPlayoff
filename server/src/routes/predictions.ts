import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { readStore, writeStore } from '../data/store';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Prediction, PlayoffSeries, League, LeagueMember } from '../types';

const router = Router({ mergeParams: true });

const VALID_SCORES = ['4-0', '4-1', '4-2', '4-3'];

const predictionSchema = z.object({
  predictedWinnerId: z.string().uuid(),
  predictedSeriesScore: z.enum(['4-0', '4-1', '4-2', '4-3']),
});

function isDeadlinePassed(series: PlayoffSeries): boolean {
  return series.isLockedManually || new Date(series.deadline) <= new Date();
}

// ─── GET predictions for a league ────────────────────────────────────────────

router.get('/:leagueId/predictions', requireAuth, (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;
  const league = readStore<League>('leagues').find((l) => l.id === leagueId);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const members = readStore<LeagueMember>('members');
  const isMember = members.some((m) => m.leagueId === leagueId && m.userId === req.user!.userId);
  if (!isMember && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Not a member of this league' });
    return;
  }

  const allPredictions = readStore<Prediction>('predictions').filter(
    (p) => p.leagueId === leagueId,
  );

  // Before deadline: only show the current user's own predictions
  const series = readStore<PlayoffSeries>('series');
  const result = allPredictions.filter((p) => {
    const s = series.find((sr) => sr.id === p.seriesId);
    if (!s) return false;
    const locked = isDeadlinePassed(s);
    return locked || p.userId === req.user!.userId || req.user!.isAdmin;
  });

  res.json(result);
});

// ─── UPSERT prediction ────────────────────────────────────────────────────────

router.post('/:leagueId/predictions', requireAuth, (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;

  const league = readStore<League>('leagues').find((l) => l.id === leagueId);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const members = readStore<LeagueMember>('members');
  if (!members.some((m) => m.leagueId === leagueId && m.userId === req.user!.userId)) {
    res.status(403).json({ error: 'Not a member of this league' });
    return;
  }

  const parsed = predictionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { predictedWinnerId, predictedSeriesScore } = parsed.data;
  const { seriesId } = req.body as { seriesId?: string };
  if (!seriesId) {
    res.status(400).json({ error: 'seriesId is required' });
    return;
  }

  const series = readStore<PlayoffSeries>('series').find((s) => s.id === seriesId);
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

  const predictions = readStore<Prediction>('predictions');
  const existing = predictions.findIndex(
    (p) => p.userId === req.user!.userId && p.leagueId === leagueId && p.seriesId === seriesId,
  );

  const now = new Date().toISOString();

  if (existing !== -1) {
    predictions[existing].predictedWinnerId = predictedWinnerId;
    predictions[existing].predictedSeriesScore = predictedSeriesScore;
    predictions[existing].updatedAt = now;
    writeStore('predictions', predictions);
    res.json(predictions[existing]);
  } else {
    const prediction: Prediction = {
      id: uuidv4(),
      userId: req.user!.userId,
      leagueId,
      seriesId,
      predictedWinnerId,
      predictedSeriesScore,
      isLocked: false,
      winnerPoints: 0,
      exactScorePoints: 0,
      totalPoints: 0,
      createdAt: now,
      updatedAt: now,
    };
    predictions.push(prediction);
    writeStore('predictions', predictions);
    res.status(201).json(prediction);
  }
});

// ─── DELETE prediction ────────────────────────────────────────────────────────

router.delete(
  '/:leagueId/predictions/:predictionId',
  requireAuth,
  (req: AuthRequest, res: Response) => {
    const { leagueId, predictionId } = req.params;
    const predictions = readStore<Prediction>('predictions');
    const idx = predictions.findIndex(
      (p) => p.id === predictionId && p.userId === req.user!.userId && p.leagueId === leagueId,
    );
    if (idx === -1) {
      res.status(404).json({ error: 'Prediction not found' });
      return;
    }

    const series = readStore<PlayoffSeries>('series').find(
      (s) => s.id === predictions[idx].seriesId,
    );
    if (series && isDeadlinePassed(series)) {
      res.status(403).json({ error: 'Cannot delete a locked prediction' });
      return;
    }

    predictions.splice(idx, 1);
    writeStore('predictions', predictions);
    res.sendStatus(204);
  },
);

export { VALID_SCORES };
export default router;
