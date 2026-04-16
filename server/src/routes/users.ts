import { Router, Response } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../types';
import * as usersDb from '../db/users';
import * as predictionsDb from '../db/predictions';
import * as seriesDb from '../db/series';
import * as leaguesDb from '../db/leagues';

const router = Router();

function safeUser(user: User) {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

// ─── GET /api/users/:id ───────────────────────────────────────────────────────

router.get('/:id', async (req, res: Response) => {
  try {
    const user = await usersDb.getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── PUT /api/users/:id ───────────────────────────────────────────────────────

const updateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  notificationPreferences: z
    .object({
      leagueInvite: z.boolean(),
      deadlineApproaching: z.boolean(),
      seriesResult: z.boolean(),
    })
    .optional(),
});

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.user!.userId !== req.params.id && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const { displayName, avatarUrl, notificationPreferences } = parsed.data;
    const updated = await usersDb.updateUser(req.params.id, {
      displayName,
      avatarUrl: avatarUrl === null ? undefined : avatarUrl,
      notificationPreferences,
    });
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(safeUser(updated));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET /api/users/:id/stats ─────────────────────────────────────────────────

router.get('/:id/stats', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.params.id;

  try {
    const [predictions, series, leagues] = await Promise.all([
      predictionsDb.getPredictionsByUser(userId),
      seriesDb.getAllSeries(),
      leaguesDb.getAllLeagues(),
    ]);

    // Total points across all leagues
    const totalPoints = predictions.reduce((sum, p) => sum + p.totalPoints, 0);
    const correctWinners = predictions.filter((p) => p.winnerPoints > 0).length;
    const correctExactScores = predictions.filter((p) => p.exactScorePoints > 0).length;

    // Points per round
    const pointsByRound: Record<string, number> = {};
    for (const pred of predictions) {
      const s = series.find((sr) => sr.id === pred.seriesId);
      if (!s) continue;
      pointsByRound[s.round] = (pointsByRound[s.round] ?? 0) + pred.totalPoints;
    }

    // Points per league
    const leagueIds = [...new Set(predictions.map((p) => p.leagueId))];
    const pointsByLeague = leagueIds.map((leagueId) => {
      const league = leagues.find((l) => l.id === leagueId);
      const pts = predictions
        .filter((p) => p.leagueId === leagueId)
        .reduce((sum, p) => sum + p.totalPoints, 0);
      return { leagueId, leagueName: league?.name ?? 'Unknown', points: pts };
    });

    res.json({
      userId,
      totalPoints,
      correctWinners,
      correctExactScores,
      pointsByRound,
      pointsByLeague,
    });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
