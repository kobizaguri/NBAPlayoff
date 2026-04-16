import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { PlayoffSeries } from '../types';
import { calculateScore } from '../services/scoring';
import { createNotification } from '../services/notifications';
import * as seriesDb from '../db/series';
import * as predictionsDb from '../db/predictions';
import * as leaguesDb from '../db/leagues';
import * as usersDb from '../db/users';
import * as mvpPicksDb from '../db/leagueMvpPicks';
import { canonicalMvpPlayerName } from '../data/finalsMvpPlayers';
import { recalculatePerfectRoundAwardsForAllLeagues } from '../services/perfectRound';
import { recalculateChampionAwardsForAllLeagues } from '../services/championPicks';

const router = Router();

function seedPair(s: PlayoffSeries): [number, number] {
  const lo = Math.min(s.homeTeamSeed, s.awayTeamSeed);
  const hi = Math.max(s.homeTeamSeed, s.awayTeamSeed);
  return [lo, hi];
}

function firstRoundCompanionSeedPair(homeSeed: number, awaySeed: number): [number, number] | null {
  const lo = Math.min(homeSeed, awaySeed);
  const hi = Math.max(homeSeed, awaySeed);
  if (lo === 1 && hi === 8) return [4, 5];
  if (lo === 4 && hi === 5) return [1, 8];
  if (lo === 2 && hi === 7) return [3, 6];
  if (lo === 3 && hi === 6) return [2, 7];
  return null;
}

function seriesMatchesSeedPair(s: PlayoffSeries, a: number, b: number): boolean {
  const [lo, hi] = seedPair(s);
  return lo === Math.min(a, b) && hi === Math.max(a, b);
}

// ─── Bracket auto-advancement ─────────────────────────────────────────────────

/**
 * Given a just-completed series, determine whether both feeder series for the
 * next round are now complete, and if so return a new auto-created series for
 * that next round (with default odds 2.0 / deadline +7 days).
 * Returns null if the next series should not be created yet.
 */
function buildNextRoundSeries(
  completed: PlayoffSeries,
  allSeries: PlayoffSeries[],
): PlayoffSeries | null {
  const { round, conference, winnerId, homeTeamId, awayTeamId,
    homeTeamName, awayTeamName, homeTeamSeed, awayTeamSeed } = completed;

  if (!winnerId) return null;
  if (round === 'playIn' || round === 'nbaFinals') return null;

  const nextRound: Partial<Record<PlayoffSeries['round'], PlayoffSeries['round']>> = {
    firstRound: 'semis',
    semis: 'finals',
    finals: 'nbaFinals',
  };
  const next = nextRound[round];
  if (!next) return null;

  const nextConf: PlayoffSeries['conference'] =
    round === 'finals' ? 'finals' : conference;

  const winnerName = winnerId === homeTeamId ? homeTeamName : awayTeamName;
  const winnerSeed = winnerId === homeTeamId ? homeTeamSeed : awayTeamSeed;

  // Find the companion series that feeds the same next-round slot
  let companion: PlayoffSeries | undefined;

  if (round === 'firstRound') {
    const companionSeeds = firstRoundCompanionSeedPair(homeTeamSeed, awayTeamSeed);
    if (!companionSeeds) return null;
    const [cLo, cHi] = companionSeeds;
    companion = allSeries.find((s) => {
      if (s.round !== 'firstRound' || s.conference !== conference || s.id === completed.id) return false;
      if (s.status !== 'complete' || !s.winnerId) return false;
      return seriesMatchesSeedPair(s, cLo, cHi);
    });
  } else if (round === 'semis') {
    companion = allSeries.find(
      (s) => s.round === 'semis' && s.conference === conference &&
             s.id !== completed.id && s.status === 'complete' && !!s.winnerId,
    );
  } else if (round === 'finals') {
    // Find the other conference's conf finals
    companion = allSeries.find(
      (s) => s.round === 'finals' && s.conference !== conference &&
             s.conference !== 'finals' && s.status === 'complete' && !!s.winnerId,
    );
  }

  if (!companion || !companion.winnerId) return null;

  const companionWinnerName =
    companion.winnerId === companion.homeTeamId ? companion.homeTeamName : companion.awayTeamName;
  const companionWinnerSeed =
    companion.winnerId === companion.homeTeamId ? companion.homeTeamSeed : companion.awayTeamSeed;

  // Deduplicate: don't create if a series already exists for these two teams in that round
  const alreadyExists = allSeries.some(
    (s) =>
      s.round === next &&
      s.conference === nextConf &&
      ((s.homeTeamId === winnerId && s.awayTeamId === companion!.winnerId) ||
        (s.homeTeamId === companion!.winnerId && s.awayTeamId === winnerId)),
  );
  if (alreadyExists) return null;

  const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  return {
    id: uuidv4(),
    round: next,
    conference: nextConf,
    homeTeamId: winnerId,
    awayTeamId: companion.winnerId,
    homeTeamName: winnerName,
    awayTeamName: companionWinnerName,
    homeTeamSeed: winnerSeed,
    awayTeamSeed: companionWinnerSeed,
    homeOdds: -110,
    awayOdds: -110,
    homeWins: 0,
    awayWins: 0,
    status: 'pending',
    isLockedManually: false,
    deadline,
    seriesMvpPoints: 0,
  };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createSeriesSchema = z.object({
  round: z.enum(['playIn', 'firstRound', 'semis', 'finals', 'nbaFinals']),
  conference: z.enum(['east', 'west', 'finals']),
  homeTeamId: z.string().min(1),
  awayTeamId: z.string().min(1),
  homeTeamName: z.string().min(1).max(100),
  awayTeamName: z.string().min(1).max(100),
  homeTeamSeed: z.number().int().min(1).max(16),
  awayTeamSeed: z.number().int().min(1).max(16),
  homeOdds: z.number().int(),
  awayOdds: z.number().int(),
  deadline: z.string().datetime(),
  seriesMvpPoints: z.number().nonnegative().default(0),
  winPoints: z.number().int().positive().optional(),
});

const updateSeriesSchema = z.object({
  round: z.enum(['playIn', 'firstRound', 'semis', 'finals', 'nbaFinals']).optional(),
  conference: z.enum(['east', 'west', 'finals']).optional(),
  homeTeamName: z.string().min(1).max(100).optional(),
  awayTeamName: z.string().min(1).max(100).optional(),
  homeTeamSeed: z.number().int().min(1).max(16).optional(),
  awayTeamSeed: z.number().int().min(1).max(16).optional(),
  homeOdds: z.number().int().optional(),
  awayOdds: z.number().int().optional(),
  deadline: z.string().datetime().optional(),
  status: z.enum(['pending', 'active']).optional(),
  seriesMvpPoints: z.number().nonnegative().optional(),
  winPoints: z.number().int().positive().nullable().optional(),
});

const updateScoreSchema = z.object({
  homeWins: z.number().int().min(0).max(4),
  awayWins: z.number().int().min(0).max(4),
});

const completeSeriesSchema = z.object({
  winnerId: z.string().min(1),
  finalSeriesScore: z.enum(['4-0', '4-1', '4-2', '4-3']).optional(),
  seriesMvpWinner: z.string().max(100).optional(),
});

// ─── CREATE SERIES ────────────────────────────────────────────────────────────

router.post('/series', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = createSeriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const series = await seriesDb.createSeries({
      id: uuidv4(),
      ...parsed.data,
    });
    res.status(201).json(series);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── UPDATE SERIES ────────────────────────────────────────────────────────────

router.put('/series/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const series = await seriesDb.getSeriesById(req.params.id);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    // Block odds changes after lock
    if (
      (req.body.homeOdds !== undefined || req.body.awayOdds !== undefined) &&
      series.oddsLockedAt
    ) {
      res.status(403).json({ error: 'Odds are frozen after the deadline' });
      return;
    }

    const parsed = updateSeriesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const updated = await seriesDb.updateSeries(
      req.params.id,
      parsed.data as Partial<PlayoffSeries>,
    );
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── UPDATE SCORE ─────────────────────────────────────────────────────────────

router.put('/series/:id/score', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = updateScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const series = await seriesDb.getSeriesById(req.params.id);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    const updated = await seriesDb.updateSeries(req.params.id, {
      homeWins: parsed.data.homeWins,
      awayWins: parsed.data.awayWins,
      status: series.status === 'pending' ? 'active' : series.status,
    });

    req.app.get('io')?.emit('series:update', updated);
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── COMPLETE SERIES ──────────────────────────────────────────────────────────

router.put('/series/:id/complete', requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = completeSeriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const series = await seriesDb.getSeriesById(req.params.id);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    const { winnerId, finalSeriesScore, seriesMvpWinner } = parsed.data;

    if (winnerId !== series.homeTeamId && winnerId !== series.awayTeamId) {
      res.status(400).json({ error: 'Winner must be one of the two competing teams' });
      return;
    }

    if (series.round !== 'playIn' && !finalSeriesScore) {
      res.status(400).json({ error: 'finalSeriesScore is required for non-Play-In series' });
      return;
    }

    const completedSeries = await seriesDb.updateSeries(req.params.id, {
      status: 'complete',
      winnerId,
      finalSeriesScore: finalSeriesScore ?? undefined,
      seriesMvpWinner: seriesMvpWinner ?? undefined,
      oddsLockedAt: series.oddsLockedAt ?? new Date().toISOString(),
    }) as PlayoffSeries;

    // ── Recalculate scores for all predictions on this series ─────────────
    const [predictions, leagues] = await Promise.all([
      predictionsDb.getPredictionsBySeries(completedSeries.id),
      leaguesDb.getAllLeagues(),
    ]);

    for (const pred of predictions) {
      const league = leagues.find((l) => l.id === pred.leagueId);
      if (!league) continue;
      const scored = calculateScore(pred, completedSeries, league);
      await predictionsDb.updatePredictionScores(pred.id, { ...scored, isLocked: true });
    }

    const allSeries = await seriesDb.getAllSeries();
    await recalculatePerfectRoundAwardsForAllLeagues(allSeries);
    await recalculateChampionAwardsForAllLeagues(allSeries);

    // ── Notify users ────────────────────────────────────────────────────
    const affectedUserIds = [...new Set(predictions.map((p) => p.userId))];
    for (const uid of affectedUserIds) {
      const user = await usersDb.getUserById(uid);
      if (!user?.notificationPreferences.seriesResult) continue;
      await createNotification(uid, 'seriesResult', {
        seriesId: completedSeries.id,
        homeTeamName: completedSeries.homeTeamName,
        awayTeamName: completedSeries.awayTeamName,
        winnerId,
        finalSeriesScore: completedSeries.finalSeriesScore,
      });
    }

    // ── Broadcast ──────────────────────────────────────────────────────
    const io = req.app.get('io');
    if (io) {
      io.emit('series:complete', completedSeries);
      io.emit('leaderboard:update', { seriesId: completedSeries.id });
    }

    // ── Auto-advance winner to next round ──────────────────────────────
    const nextSeries = buildNextRoundSeries(completedSeries, allSeries);
    if (nextSeries) {
      const created = await seriesDb.createSeries(nextSeries);
      if (io) io.emit('series:update', created);
    }

    res.json(completedSeries);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── LOCK / UNLOCK SERIES ─────────────────────────────────────────────────────

router.put('/series/:id/lock', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { locked } = req.body as { locked?: boolean };
  if (typeof locked !== 'boolean') {
    res.status(400).json({ error: '"locked" (boolean) is required' });
    return;
  }

  try {
    const series = await seriesDb.getSeriesById(req.params.id);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    const updated = await seriesDb.updateSeries(req.params.id, {
      isLockedManually: locked,
      oddsLockedAt: locked && !series.oddsLockedAt ? new Date().toISOString() : series.oddsLockedAt,
    });

    if (locked) {
      await predictionsDb.lockPredictionsForSeries(req.params.id);
    }

    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── DELETE SERIES ────────────────────────────────────────────────────────────

router.delete('/series/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const series = await seriesDb.getSeriesById(req.params.id);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }
    if (series.status === 'complete') {
      res.status(403).json({ error: 'Cannot delete a completed series' });
      return;
    }
    await seriesDb.deleteSeries(req.params.id);
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── SET FINALS MVP WINNER (per league) ──────────────────────────────────────

router.put('/leagues/:leagueId/finals-mvp', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;
  const { playerName } = req.body as { playerName?: string };

  if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
    res.status(400).json({ error: 'playerName is required' });
    return;
  }

  try {
    const league = await leaguesDb.getLeagueById(leagueId);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const canonical = canonicalMvpPlayerName(playerName);
    if (!canonical) {
      res.status(400).json({
        error: 'Player must match the same MVP candidate list members use (check spelling).',
      });
      return;
    }

    await leaguesDb.updateLeague(leagueId, { finalsActualMvp: canonical });
    await mvpPicksDb.awardMvpPoints(leagueId, canonical, league.mvpPoints);

    const io = req.app.get('io');
    if (io) io.emit('leaderboard:update', { leagueId });

    res.json({ leagueId, finalsActualMvp: canonical });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── RESET USER PASSWORD ──────────────────────────────────────────────────────

router.put('/users/:id/password', requireAdmin, async (req: AuthRequest, res: Response) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  try {
    const updated = await usersDb.updateUser(req.params.id, {
      passwordHash: bcrypt.hashSync(newPassword, 12),
    });
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── LIST ALL USERS (admin only) ─────────────────────────────────────────────

router.get('/users', requireAdmin, async (_req, res: Response) => {
  try {
    const users = await usersDb.getAllUsers();
    res.json(users.map(({ passwordHash: _ph, ...u }) => u));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
