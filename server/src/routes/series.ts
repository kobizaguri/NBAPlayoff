import { Router, Response } from 'express';
import { readStore } from '../data/store';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { PlayoffSeries, Prediction, League, LeagueMember } from '../types';

const router = Router();

// ─── GET ALL SERIES ───────────────────────────────────────────────────────────

router.get('/', (req, res: Response) => {
  const series = readStore<PlayoffSeries>('series');
  res.json(series);
});

// ─── GET SINGLE SERIES ────────────────────────────────────────────────────────

router.get('/:id', (req, res: Response) => {
  const series = readStore<PlayoffSeries>('series').find((s) => s.id === req.params.id);
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }
  res.json(series);
});

// ─── GET PREDICTIONS FOR A SERIES (locked or complete only) ──────────────────

router.get('/:id/predictions', requireAuth, (req: AuthRequest, res: Response) => {
  const series = readStore<PlayoffSeries>('series').find((s) => s.id === req.params.id);
  if (!series) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const now = new Date();
  const isLocked = series.isLockedManually || new Date(series.deadline) <= now;
  if (!isLocked && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Predictions are not yet visible (deadline not passed)' });
    return;
  }

  // Only show predictions for leagues the user belongs to
  const members = readStore<LeagueMember>('members');
  const userLeagueIds = members
    .filter((m) => m.userId === req.user!.userId)
    .map((m) => m.leagueId);

  const predictions = readStore<Prediction>('predictions').filter(
    (p) =>
      p.seriesId === req.params.id &&
      (req.user!.isAdmin || userLeagueIds.includes(p.leagueId)),
  );

  res.json(predictions);
});

export default router;
