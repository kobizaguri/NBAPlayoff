import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as seriesDb from '../db/series';
import * as predictionsDb from '../db/predictions';
import * as leaguesDb from '../db/leagues';

const router = Router();

// ─── GET ALL SERIES ───────────────────────────────────────────────────────────

router.get('/', async (_req, res: Response) => {
  try {
    const series = await seriesDb.getAllSeries();
    res.json(series);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET SINGLE SERIES ────────────────────────────────────────────────────────

router.get('/:id', async (req, res: Response) => {
  try {
    const series = await seriesDb.getSeriesById(req.params.id);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }
    res.json(series);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET PREDICTIONS FOR A SERIES (locked or complete only) ──────────────────

router.get('/:id/predictions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const series = await seriesDb.getSeriesById(req.params.id);
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
    const userLeagueIds = await leaguesDb.getLeagueIdsByUser(req.user!.userId);

    const predictions = (await predictionsDb.getPredictionsBySeries(req.params.id)).filter(
      (p) => req.user!.isAdmin || userLeagueIds.includes(p.leagueId),
    );

    res.json(predictions);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
