import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { readStore, writeStore } from '../data/store';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { League, LeagueMember, User, Prediction, PlayoffSeries } from '../types';
import { createNotification } from '../services/notifications';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isRound1Started(): boolean {
  const series = readStore<PlayoffSeries>('series');
  return series.some(
    (s) => s.round === 'firstRound' && (s.status === 'active' || s.status === 'complete'),
  );
}

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function uniqueInviteCode(): string {
  const leagues = readStore<League>('leagues');
  let code: string;
  do {
    code = generateInviteCode();
  } while (leagues.some((l) => l.inviteCode === code));
  return code;
}

// ─── CREATE LEAGUE ────────────────────────────────────────────────────────────

const createLeagueSchema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(1).max(128).optional(),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().int().min(20).max(30).default(20),
  baseWinPoints: z.number().positive().default(100),
  exactScoreBonus: z.number().nonnegative().default(50),
});

router.post('/', requireAuth, (req: AuthRequest, res: Response) => {
  const parsed = createLeagueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { name, password, isPublic, maxMembers, baseWinPoints, exactScoreBonus } = parsed.data;
  const leagues = readStore<League>('leagues');

  if (leagues.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
    res.status(409).json({ error: 'League name already taken' });
    return;
  }

  const league: League = {
    id: uuidv4(),
    name,
    inviteCode: uniqueInviteCode(),
    passwordHash: password ? bcrypt.hashSync(password, 12) : undefined,
    commissionerId: req.user!.userId,
    isPublic,
    maxMembers,
    baseWinPoints,
    exactScoreBonus,
    createdAt: new Date().toISOString(),
  };

  leagues.push(league);
  writeStore('leagues', leagues);

  // Auto-join creator
  const members = readStore<LeagueMember>('members');
  members.push({ leagueId: league.id, userId: req.user!.userId, joinedAt: new Date().toISOString() });
  writeStore('members', members);

  res.status(201).json(safeLeague(league));
});

// ─── LIST LEAGUES ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const leagues = readStore<League>('leagues');
  const members = readStore<LeagueMember>('members');
  const userId = req.user!.userId;

  // Return public leagues + leagues the user is a member of
  const visible = leagues.filter(
    (l) => l.isPublic || members.some((m) => m.leagueId === l.id && m.userId === userId),
  );

  res.json(visible.map(safeLeague));
});

// ─── GET LEAGUE ───────────────────────────────────────────────────────────────

router.get('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const league = readStore<League>('leagues').find((l) => l.id === req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }
  const members = readStore<LeagueMember>('members');
  const isMember = members.some((m) => m.leagueId === league.id && m.userId === req.user!.userId);
  if (!league.isPublic && !isMember && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  res.json(safeLeague(league));
});

// ─── JOIN LEAGUE ──────────────────────────────────────────────────────────────

const joinSchema = z.object({
  inviteCode: z.string().length(6),
  password: z.string().optional(),
});

router.post('/join', requireAuth, (req: AuthRequest, res: Response) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid invite code' });
    return;
  }

  const { inviteCode, password } = parsed.data;
  const leagues = readStore<League>('leagues');
  const league = leagues.find((l) => l.inviteCode === inviteCode.toUpperCase());
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  if (isRound1Started()) {
    res.status(403).json({ error: 'Cannot join after round 1 has started' });
    return;
  }

  if (league.passwordHash && (!password || !bcrypt.compareSync(password, league.passwordHash))) {
    res.status(401).json({ error: 'Incorrect league password' });
    return;
  }

  const members = readStore<LeagueMember>('members');
  const leagueMembers = members.filter((m) => m.leagueId === league.id);

  if (leagueMembers.some((m) => m.userId === req.user!.userId)) {
    res.status(409).json({ error: 'Already a member of this league' });
    return;
  }

  if (leagueMembers.length >= league.maxMembers) {
    res.status(403).json({ error: 'League is full' });
    return;
  }

  members.push({ leagueId: league.id, userId: req.user!.userId, joinedAt: new Date().toISOString() });
  writeStore('members', members);

  // Notify commissioner
  const users = readStore<User>('users');
  const joiningUser = users.find((u) => u.id === req.user!.userId);
  const commissioner = users.find((u) => u.id === league.commissionerId);
  if (commissioner?.notificationPreferences.leagueInvite) {
    createNotification(league.commissionerId, 'leagueInvite', {
      leagueId: league.id,
      leagueName: league.name,
      joinedUserId: req.user!.userId,
      joinedUserName: joiningUser?.displayName ?? 'Unknown',
    });
  }

  res.json(safeLeague(league));
});

// ─── UPDATE LEAGUE (commissioner) ────────────────────────────────────────────

const updateLeagueSchema = z.object({
  isPublic: z.boolean().optional(),
  maxMembers: z.number().int().min(20).max(30).optional(),
});

router.put('/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const leagues = readStore<League>('leagues');
  const idx = leagues.findIndex((l) => l.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const league = leagues[idx];
  const isCommissioner = league.commissionerId === req.user!.userId;
  if (!isCommissioner && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Only the commissioner can update the league' });
    return;
  }

  const parsed = updateLeagueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  if (parsed.data.isPublic !== undefined) leagues[idx].isPublic = parsed.data.isPublic;
  if (parsed.data.maxMembers !== undefined) leagues[idx].maxMembers = parsed.data.maxMembers;

  writeStore('leagues', leagues);
  res.json(safeLeague(leagues[idx]));
});

// ─── REMOVE MEMBER (commissioner / admin) ────────────────────────────────────

router.delete('/:id/members/:userId', requireAuth, (req: AuthRequest, res: Response) => {
  const league = readStore<League>('leagues').find((l) => l.id === req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const isCommissioner = league.commissionerId === req.user!.userId;
  if (!isCommissioner && !req.user!.isAdmin) {
    res.status(403).json({ error: 'Only the commissioner can remove members' });
    return;
  }

  if (req.params.userId === league.commissionerId) {
    res.status(400).json({ error: 'Cannot remove the commissioner' });
    return;
  }

  const members = readStore<LeagueMember>('members');
  const filtered = members.filter(
    (m) => !(m.leagueId === req.params.id && m.userId === req.params.userId),
  );

  if (filtered.length === members.length) {
    res.status(404).json({ error: 'Member not found in this league' });
    return;
  }

  writeStore('members', filtered);
  res.sendStatus(204);
});

// ─── GET MEMBERS ──────────────────────────────────────────────────────────────

router.get('/:id/members', requireAuth, (req: AuthRequest, res: Response) => {
  const league = readStore<League>('leagues').find((l) => l.id === req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const members = readStore<LeagueMember>('members').filter((m) => m.leagueId === req.params.id);
  const users = readStore<User>('users');

  const result = members.map((m) => {
    const user = users.find((u) => u.id === m.userId);
    return {
      userId: m.userId,
      joinedAt: m.joinedAt,
      displayName: user?.displayName ?? 'Unknown',
      avatarUrl: user?.avatarUrl,
      isCommissioner: m.userId === league.commissionerId,
    };
  });

  res.json(result);
});

// ─── GET LEADERBOARD ──────────────────────────────────────────────────────────

router.get('/:id/leaderboard', requireAuth, (req: AuthRequest, res: Response) => {
  const league = readStore<League>('leagues').find((l) => l.id === req.params.id);
  if (!league) {
    res.status(404).json({ error: 'League not found' });
    return;
  }

  const members = readStore<LeagueMember>('members').filter((m) => m.leagueId === req.params.id);
  const predictions = readStore<Prediction>('predictions').filter(
    (p) => p.leagueId === req.params.id,
  );
  const users = readStore<User>('users');

  const entries = members.map((m) => {
    const user = users.find((u) => u.id === m.userId);
    const userPredictions = predictions.filter((p) => p.userId === m.userId);
    const totalPoints = userPredictions.reduce((sum, p) => sum + p.totalPoints, 0);
    const correctWinners = userPredictions.filter((p) => p.winnerPoints > 0).length;
    const correctExactScores = userPredictions.filter((p) => p.exactScorePoints > 0).length;
    return {
      userId: m.userId,
      displayName: user?.displayName ?? 'Unknown',
      avatarUrl: user?.avatarUrl,
      totalPoints,
      correctWinners,
      correctExactScores,
    };
  });

  // Sort descending; ties share the same rank
  entries.sort((a, b) => b.totalPoints - a.totalPoints);

  let rank = 1;
  const ranked = entries.map((entry, idx) => {
    if (idx > 0 && entry.totalPoints < entries[idx - 1].totalPoints) {
      rank = idx + 1;
    }
    return { rank, ...entry };
  });

  res.json(ranked);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeLeague(league: League) {
  const { passwordHash: _ph, ...safe } = league;
  return { ...safe, hasPassword: !!league.passwordHash };
}

export default router;
