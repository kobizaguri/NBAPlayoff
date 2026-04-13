import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { readStore, writeStore } from '../data/store';
import { requireAdmin, AuthRequest } from '../middleware/auth';
import { PlayoffSeries, Prediction, League, User, Notification, LeagueMVPPick } from '../types';
import { calculateScore } from '../services/scoring';
import { createNotification } from '../services/notifications';

const router = Router();

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
  homeOdds: z.number().positive(),
  awayOdds: z.number().positive(),
  deadline: z.string().datetime(),
  seriesMvpPoints: z.number().nonnegative().default(0),
});

const updateSeriesSchema = z.object({
  homeTeamName: z.string().min(1).max(100).optional(),
  awayTeamName: z.string().min(1).max(100).optional(),
  homeTeamSeed: z.number().int().min(1).max(16).optional(),
  awayTeamSeed: z.number().int().min(1).max(16).optional(),
  homeOdds: z.number().positive().optional(),
  awayOdds: z.number().positive().optional(),
  deadline: z.string().datetime().optional(),
  status: z.enum(['pending', 'active']).optional(),
  seriesMvpPoints: z.number().nonnegative().optional(),
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

router.post('/series', requireAdmin, (req: AuthRequest, res: Response) => {
  const parsed = createSeriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const data = parsed.data;
  const series: PlayoffSeries = {
    id: uuidv4(),
    ...data,
    homeWins: 0,
    awayWins: 0,
    status: 'pending',
    isLockedManually: false,
  };

  const all = readStore<PlayoffSeries>('series');
  all.push(series);
  writeStore('series', all);

  res.status(201).json(series);
});

// ─── UPDATE SERIES ────────────────────────────────────────────────────────────

router.put('/series/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const all = readStore<PlayoffSeries>('series');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const series = all[idx];

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

  Object.assign(all[idx], parsed.data);
  writeStore('series', all);
  res.json(all[idx]);
});

// ─── UPDATE SCORE ─────────────────────────────────────────────────────────────

router.put('/series/:id/score', requireAdmin, (req: AuthRequest, res: Response) => {
  const parsed = updateScoreSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const all = readStore<PlayoffSeries>('series');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  all[idx].homeWins = parsed.data.homeWins;
  all[idx].awayWins = parsed.data.awayWins;
  if (all[idx].status === 'pending') all[idx].status = 'active';
  writeStore('series', all);

  // Emit via socket
  req.app.get('io')?.emit('series:update', all[idx]);
  res.json(all[idx]);
});

// ─── COMPLETE SERIES ──────────────────────────────────────────────────────────

router.put('/series/:id/complete', requireAdmin, (req: AuthRequest, res: Response) => {
  const parsed = completeSeriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const all = readStore<PlayoffSeries>('series');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  const { winnerId, finalSeriesScore, seriesMvpWinner } = parsed.data;

  // Validate winner is one of the two teams
  if (winnerId !== all[idx].homeTeamId && winnerId !== all[idx].awayTeamId) {
    res.status(400).json({ error: 'Winner must be one of the two competing teams' });
    return;
  }

  // Non-playIn series require a final score
  if (all[idx].round !== 'playIn' && !finalSeriesScore) {
    res.status(400).json({ error: 'finalSeriesScore is required for non-Play-In series' });
    return;
  }

  all[idx].status = 'complete';
  all[idx].winnerId = winnerId;
  if (finalSeriesScore) all[idx].finalSeriesScore = finalSeriesScore;
  if (seriesMvpWinner) all[idx].seriesMvpWinner = seriesMvpWinner;
  if (!all[idx].oddsLockedAt) all[idx].oddsLockedAt = new Date().toISOString();
  writeStore('series', all);

  const completedSeries = all[idx];

  // ── Recalculate scores for all predictions on this series ─────────────────
  const predictions = readStore<Prediction>('predictions');
  const leagues = readStore<League>('leagues');
  let changed = false;

  for (let i = 0; i < predictions.length; i++) {
    if (predictions[i].seriesId !== completedSeries.id) continue;
    const league = leagues.find((l) => l.id === predictions[i].leagueId);
    if (!league) continue;
    const scored = calculateScore(predictions[i], completedSeries, league);
    predictions[i] = {
      ...predictions[i],
      ...scored,
      isLocked: true,
    };
    changed = true;
  }

  if (changed) writeStore('predictions', predictions);

  // Notify users ──────────────────────────────────────────────────────────
  const users = readStore<User>('users');
  const affectedUserIds = [...new Set(predictions
    .filter((p) => p.seriesId === completedSeries.id)
    .map((p) => p.userId))];

  for (const uid of affectedUserIds) {
    const user = users.find((u) => u.id === uid);
    if (!user?.notificationPreferences.seriesResult) continue;
    createNotification(uid, 'seriesResult', {
      seriesId: completedSeries.id,
      homeTeamName: completedSeries.homeTeamName,
      awayTeamName: completedSeries.awayTeamName,
      winnerId,
      finalSeriesScore: completedSeries.finalSeriesScore,
    });
  }

  // ── Broadcast updated leaderboards ───────────────────────────────────────
  const io = req.app.get('io');
  if (io) {
    io.emit('series:complete', completedSeries);
    io.emit('leaderboard:update', { seriesId: completedSeries.id });
  }

  res.json(completedSeries);
});

// ─── LOCK / UNLOCK SERIES ─────────────────────────────────────────────────────

router.put('/series/:id/lock', requireAdmin, (req: AuthRequest, res: Response) => {
  const { locked } = req.body as { locked?: boolean };
  if (typeof locked !== 'boolean') {
    res.status(400).json({ error: '"locked" (boolean) is required' });
    return;
  }

  const all = readStore<PlayoffSeries>('series');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }

  all[idx].isLockedManually = locked;
  if (locked && !all[idx].oddsLockedAt) {
    all[idx].oddsLockedAt = new Date().toISOString();
  }
  writeStore('series', all);

  // Lock all open predictions for this series when manually locked
  if (locked) {
    const predictions = readStore<Prediction>('predictions');
    let changed = false;
    for (let i = 0; i < predictions.length; i++) {
      if (predictions[i].seriesId === req.params.id && !predictions[i].isLocked) {
        predictions[i].isLocked = true;
        changed = true;
      }
    }
    if (changed) writeStore('predictions', predictions);
  }

  res.json(all[idx]);
});

// ─── DELETE SERIES ────────────────────────────────────────────────────────────

router.delete('/series/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const all = readStore<PlayoffSeries>('series');
  const idx = all.findIndex((s) => s.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Series not found' });
    return;
  }
  if (all[idx].status === 'complete') {
    res.status(403).json({ error: 'Cannot delete a completed series' });
    return;
  }
  all.splice(idx, 1);
  writeStore('series', all);
  res.sendStatus(204);
});

// ─── SET FINALS MVP WINNER (per league) ──────────────────────────────────────

router.put('/leagues/:leagueId/finals-mvp', requireAdmin, (req: AuthRequest, res: Response) => {
  const { leagueId } = req.params;
  const { playerName } = req.body as { playerName?: string };

  if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
    res.status(400).json({ error: 'playerName is required' });
    return;
  }

  const leagues = readStore<League>('leagues');
  const idx = leagues.findIndex((l) => l.id === leagueId);
  if (idx === -1) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  leagues[idx].finalsActualMvp = playerName.trim();
  writeStore('leagues', leagues);

  const league = leagues[idx];

  // Award points to matching picks
  const picks = readStore<LeagueMVPPick>('leagueMvpPicks');
  let picksChanged = false;
  for (let i = 0; i < picks.length; i++) {
    if (picks[i].leagueId !== leagueId) continue;
    const match =
      picks[i].playerName.trim().toLowerCase() === playerName.trim().toLowerCase();
    picks[i].pointsAwarded = match ? league.mvpPoints : 0;
    picks[i].updatedAt = new Date().toISOString();
    picksChanged = true;
  }
  if (picksChanged) writeStore('leagueMvpPicks', picks);

  // Emit leaderboard update
  const io = req.app.get('io');
  if (io) io.emit('leaderboard:update', { leagueId });

  res.json({ leagueId, finalsActualMvp: playerName.trim() });
});

// ─── RESET USER PASSWORD ──────────────────────────────────────────────────────

router.put('/users/:id/password', requireAdmin, (req: AuthRequest, res: Response) => {
  const { newPassword } = req.body as { newPassword?: string };
  if (!newPassword || newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const users = readStore<User>('users');
  const idx = users.findIndex((u) => u.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  users[idx].passwordHash = bcrypt.hashSync(newPassword, 12);
  writeStore('users', users);
  res.sendStatus(204);
});

// ─── LIST ALL USERS (admin only) ─────────────────────────────────────────────

router.get('/users', requireAdmin, (_req, res: Response) => {
  const users = readStore<User>('users').map(({ passwordHash: _ph, ...u }) => u);
  res.json(users);
});

export default router;
