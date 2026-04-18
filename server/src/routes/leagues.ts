import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { League } from '../types';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { createNotification } from '../services/notifications';
import * as leaguesDb from '../db/leagues';
import * as seriesDb from '../db/series';
import * as predictionsDb from '../db/predictions';
import * as mvpPicksDb from '../db/leagueMvpPicks';
import * as usersDb from '../db/users';
import { getPerfectRoundSumByUser } from '../db/leaguePerfectRoundAwards';
import * as championDb from '../db/leagueChampion';
import { recalculatePerfectRoundAwardsForLeague } from '../services/perfectRound';
import {
  recalculateChampionAwardsForLeague,
  getPlayoffTeamsFromSeries,
  getNbaFinalsWinnerTeamId,
} from '../services/championPicks';
import { FINALS_MVP_PLAYER_NAMES, canonicalMvpPlayerName } from '../data/finalsMvpPlayers';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function isRound1Started(): Promise<boolean> {
  const series = await seriesDb.getAllSeries();
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

async function uniqueInviteCode(): Promise<string> {
  const leagues = await leaguesDb.getAllLeagues();
  let code: string;
  do {
    code = generateInviteCode();
  } while (leagues.some((l) => l.inviteCode === code));
  return code;
}

// ─── CREATE LEAGUE ────────────────────────────────────────────────────────────

const perfectRoundBonusesSchema = z
  .object({
    firstRound: z.number().nonnegative().optional(),
    semis: z.number().nonnegative().optional(),
    finals: z.number().nonnegative().optional(),
    nbaFinals: z.number().nonnegative().optional(),
  })
  .optional();

const createLeagueSchema = z.object({
  name: z.string().min(1).max(80),
  password: z.string().min(1).max(128).optional(),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().int().min(20).max(30).default(20),
  baseWinPoints: z.number().positive().default(100),
  exactScoreBonus: z.number().nonnegative().optional().default(0),
  playInWinPoints: z.number().nonnegative().default(50),
  mvpPoints: z.number().nonnegative().default(100),
  mvpDeadline: z.string().datetime(),
  perfectRoundBonuses: perfectRoundBonusesSchema,
  championPickDeadline: z.string().datetime().nullable().optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = createLeagueSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const {
    name,
    password,
    isPublic,
    maxMembers,
    baseWinPoints,
    exactScoreBonus,
    playInWinPoints,
    mvpPoints,
    mvpDeadline,
    perfectRoundBonuses,
    championPickDeadline,
  } = parsed.data;

  try {
    if (await leaguesDb.leagueNameExists(name)) {
      res.status(409).json({ error: 'League name already taken' });
      return;
    }

    const league = await leaguesDb.createLeague({
      id: uuidv4(),
      name,
      inviteCode: await uniqueInviteCode(),
      passwordHash: password ? bcrypt.hashSync(password, 12) : undefined,
      commissionerId: req.user!.userId,
      isPublic,
      maxMembers,
      baseWinPoints,
      exactScoreBonus,
      playInWinPoints,
      mvpPoints,
      mvpDeadline,
      perfectRoundBonuses: perfectRoundBonuses ?? {},
      championPickDeadline: championPickDeadline ?? null,
    });

    // Auto-join creator
    await leaguesDb.addMember(league.id, req.user!.userId);

    res.status(201).json(safeLeague(league));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── LIST LEAGUES ─────────────────────────────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const leagues = await leaguesDb.getLeaguesByUserId(req.user!.userId);
    res.json(leagues.map(safeLeague));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// Must be registered before `GET /:id` so "mvp-player-options" is not parsed as a league id.
router.get('/mvp-player-options', requireAuth, (_req: AuthRequest, res: Response) => {
  res.json({ players: FINALS_MVP_PLAYER_NAMES });
});

// ─── GET LEAGUE ───────────────────────────────────────────────────────────────

router.get('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    const memberCheck = await leaguesDb.isMember(league.id, req.user!.userId);
    if (!league.isPublic && !memberCheck && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    res.json(safeLeague(league));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── JOIN LEAGUE ──────────────────────────────────────────────────────────────

const joinSchema = z.object({
  inviteCode: z.string().length(6),
  password: z.string().optional(),
});

router.post('/join', requireAuth, async (req: AuthRequest, res: Response) => {
  const parsed = joinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid invite code' });
    return;
  }

  const { inviteCode, password } = parsed.data;

  try {
    const league = await leaguesDb.getLeagueByInviteCode(inviteCode.toUpperCase());
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (await isRound1Started()) {
      res.status(403).json({ error: 'Cannot join after round 1 has started' });
      return;
    }

    if (league.passwordHash && (!password || !bcrypt.compareSync(password, league.passwordHash))) {
      res.status(401).json({ error: 'Incorrect league password' });
      return;
    }

    if (await leaguesDb.isMember(league.id, req.user!.userId)) {
      res.status(409).json({ error: 'Already a member of this league' });
      return;
    }

    const memberCount = await leaguesDb.getMemberCount(league.id);
    if (memberCount >= league.maxMembers) {
      res.status(403).json({ error: 'League is full' });
      return;
    }

    await leaguesDb.addMember(league.id, req.user!.userId);

    // Notify commissioner
    const [joiningUser, commissioner] = await Promise.all([
      usersDb.getUserById(req.user!.userId),
      usersDb.getUserById(league.commissionerId),
    ]);
    if (commissioner?.notificationPreferences.leagueInvite) {
      await createNotification(league.commissionerId, 'leagueInvite', {
        leagueId: league.id,
        leagueName: league.name,
        joinedUserId: req.user!.userId,
        joinedUserName: joiningUser?.displayName ?? 'Unknown',
      });
    }

    res.json(safeLeague(league));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── UPDATE LEAGUE (commissioner) ────────────────────────────────────────────

const updateLeagueSchema = z.object({
  isPublic: z.boolean().optional(),
  maxMembers: z.number().int().min(20).max(30).optional(),
  perfectRoundBonuses: perfectRoundBonusesSchema,
  championPickDeadline: z.string().datetime().nullable().optional(),
});

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

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

    const updated = await leaguesDb.updateLeague(req.params.id, parsed.data);
    if (!updated) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    if (parsed.data.perfectRoundBonuses !== undefined) {
      const allSeries = await seriesDb.getAllSeries();
      await recalculatePerfectRoundAwardsForLeague(
        updated.id,
        updated.perfectRoundBonuses,
        allSeries,
      );
    }

    res.json(safeLeague(updated));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── REMOVE MEMBER (commissioner / admin) ────────────────────────────────────

router.delete('/:id/members/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
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

    const removed = await leaguesDb.removeMember(req.params.id, req.params.userId);
    if (!removed) {
      res.status(404).json({ error: 'Member not found in this league' });
      return;
    }

    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── LEAVE LEAGUE (self) ─────────────────────────────────────────────────────

router.post('/:id/leave', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const userId = req.user!.userId;
    if (league.commissionerId === userId) {
      res.status(400).json({
        error: 'The commissioner cannot leave the league. Transfer ownership is not supported yet.',
      });
      return;
    }

    const member = await leaguesDb.isMember(league.id, userId);
    if (!member) {
      res.status(403).json({ error: 'You are not a member of this league' });
      return;
    }

    const left = await leaguesDb.leaveLeagueAndClearUserData(league.id, userId);
    if (!left) {
      res.status(500).json({ error: 'Failed to leave league' });
      return;
    }

    req.app.get('io')?.emit('leaderboard:update', { leagueId: league.id });

    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── DELETE LEAGUE (commissioner or admin) ─────────────────────────────────

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const isCommissioner = league.commissionerId === req.user!.userId;
    if (!isCommissioner && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Only the commissioner can delete this league' });
      return;
    }

    await leaguesDb.deleteLeague(league.id);
    req.app.get('io')?.emit('leaderboard:update', { leagueId: league.id });
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET MEMBERS ──────────────────────────────────────────────────────────────

router.get('/:id/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const members = await leaguesDb.getMembersByLeague(req.params.id);
    const userList = await Promise.all(members.map((m) => usersDb.getUserById(m.userId)));

    const result = members.map((m, i) => ({
      userId: m.userId,
      joinedAt: m.joinedAt,
      displayName: userList[i]?.displayName ?? 'Unknown',
      avatarUrl: userList[i]?.avatarUrl,
      isCommissioner: m.userId === league.commissionerId,
    }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET LEADERBOARD ──────────────────────────────────────────────────────────

router.get('/:id/leaderboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const [members, predictions, mvpPicks, perfectSums, championPicks] = await Promise.all([
      leaguesDb.getMembersByLeague(req.params.id),
      predictionsDb.getPredictionsByLeague(req.params.id),
      mvpPicksDb.getPicksByLeague(req.params.id),
      getPerfectRoundSumByUser(req.params.id),
      championDb.getChampionPicksByLeague(req.params.id),
    ]);
    const userList = await Promise.all(members.map((m) => usersDb.getUserById(m.userId)));

    const entries = members.map((m, i) => {
      const user = userList[i];
      const userPredictions = predictions.filter((p) => p.userId === m.userId);
      const seriesPoints = userPredictions.reduce((sum, p) => sum + p.totalPoints, 0);
      const mvpPick = mvpPicks.find((pk) => pk.userId === m.userId);
      const mvpPoints = mvpPick?.pointsAwarded ?? 0;
      const perfectPoints = perfectSums.get(m.userId) ?? 0;
      const champPick = championPicks.find((cp) => cp.userId === m.userId);
      const championPoints = champPick?.pointsAwarded ?? 0;
      const totalPoints = seriesPoints + mvpPoints + perfectPoints + championPoints;
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

    entries.sort((a, b) => b.totalPoints - a.totalPoints);

    let rank = 1;
    const ranked = entries.map((entry, idx) => {
      if (idx > 0 && entry.totalPoints < entries[idx - 1].totalPoints) {
        rank = idx + 1;
      }
      return { rank, ...entry };
    });

    res.json(ranked);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── GET MVP PICK ─────────────────────────────────────────────────────────────

router.get('/:id/mvp-pick', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const memberCheck = await leaguesDb.isMember(req.params.id, req.user!.userId);
    if (!memberCheck && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    const allPicks = await mvpPicksDb.getPicksByLeague(req.params.id);
    const deadlinePassed = new Date(league.mvpDeadline) <= new Date();

    if (deadlinePassed || req.user!.isAdmin) {
      res.json(allPicks);
    } else {
      const myPick = allPicks.find((pk) => pk.userId === req.user!.userId);
      res.json(myPick ? [myPick] : []);
    }
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── UPSERT MVP PICK ─────────────────────────────────────────────────────────

const mvpPickSchema = z.object({
  playerName: z.string().min(1).max(100),
});

router.post('/:id/mvp-pick', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }

    const memberCheck = await leaguesDb.isMember(req.params.id, req.user!.userId);
    if (!memberCheck) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    if (new Date(league.mvpDeadline) <= new Date()) {
      res.status(403).json({ error: 'MVP pick deadline has passed' });
      return;
    }

    const parsed = mvpPickSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const canonical = canonicalMvpPlayerName(parsed.data.playerName);
    if (!canonical) {
      res.status(400).json({ error: 'Player must be chosen from the official MVP candidate list' });
      return;
    }

    const pick = await mvpPicksDb.upsertMvpPick(req.params.id, req.user!.userId, canonical);
    res.status(201).json(pick);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── CHAMPION PICK (pre-Finals) ───────────────────────────────────────────────

const championPickSchema = z.object({
  teamId: z.string().uuid(),
});

const championTeamPointsSchema = z.object({
  rows: z.array(
    z.object({
      teamId: z.string().uuid(),
      points: z.number().int().positive(),
    }),
  ),
});

router.get('/:id/champion', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    const memberCheck = await leaguesDb.isMember(req.params.id, req.user!.userId);
    if (!memberCheck && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    const allSeries = await seriesDb.getAllSeries();
    const playoffTeams = getPlayoffTeamsFromSeries(allSeries);
    const pointRows = await championDb.getChampionTeamPoints(req.params.id);
    const nameById = new Map(playoffTeams.map((t) => [t.teamId, t.teamName]));
    const teamPointsTable = pointRows.map((r) => ({
      teamId: r.teamId,
      teamName: nameById.get(r.teamId) ?? 'Team',
      points: r.points,
    }));

    const picks = await championDb.getChampionPicksByLeague(req.params.id);
    const myPick = picks.find((p) => p.userId === req.user!.userId);
    const dl = league.championPickDeadline;
    const championDeadlinePassed = dl ? new Date(dl) <= new Date() : false;
    const showAllPicks = championDeadlinePassed || req.user!.isAdmin;
    const memberPicks = showAllPicks
      ? picks.map((p) => ({
          userId: p.userId,
          teamId: p.teamId,
          pointsAwarded: p.pointsAwarded,
        }))
      : myPick
        ? [
            {
              userId: req.user!.userId,
              teamId: myPick.teamId,
              pointsAwarded: myPick.pointsAwarded,
            },
          ]
        : [];

    res.json({
      championPickDeadline: dl ?? null,
      championDeadlinePassed,
      playoffTeams,
      teamPointsTable,
      myPick: myPick
        ? { teamId: myPick.teamId, pointsAwarded: myPick.pointsAwarded }
        : null,
      memberPicks,
      nbaChampionTeamId: getNbaFinalsWinnerTeamId(allSeries),
    });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

router.post('/:id/champion-pick', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    const memberCheck = await leaguesDb.isMember(req.params.id, req.user!.userId);
    if (!memberCheck) {
      res.status(403).json({ error: 'Not a member of this league' });
      return;
    }

    if (!league.championPickDeadline) {
      res.status(403).json({ error: 'Champion pick is not enabled for this league' });
      return;
    }
    if (new Date(league.championPickDeadline) <= new Date()) {
      res.status(403).json({ error: 'Champion pick deadline has passed' });
      return;
    }

    const parsed = championPickSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const allSeries = await seriesDb.getAllSeries();
    const playoffTeams = getPlayoffTeamsFromSeries(allSeries);
    const allowed = new Set(playoffTeams.map((t) => t.teamId));
    if (!allowed.has(parsed.data.teamId)) {
      res.status(400).json({ error: 'Team is not in the playoff field' });
      return;
    }

    const pick = await championDb.upsertChampionPick(
      req.params.id,
      req.user!.userId,
      parsed.data.teamId,
    );
    const allSeries2 = await seriesDb.getAllSeries();
    await recalculateChampionAwardsForLeague(req.params.id, allSeries2);

    res.status(201).json(pick);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

router.put('/:id/champion-team-points', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const league = await leaguesDb.getLeagueById(req.params.id);
    if (!league) {
      res.status(404).json({ error: 'League not found' });
      return;
    }
    const isCommissioner = league.commissionerId === req.user!.userId;
    if (!isCommissioner && !req.user!.isAdmin) {
      res.status(403).json({ error: 'Only the commissioner can set champion points' });
      return;
    }

    const parsed = championTeamPointsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    await championDb.setChampionTeamPoints(req.params.id, parsed.data.rows);
    const allSeries = await seriesDb.getAllSeries();
    await recalculateChampionAwardsForLeague(req.params.id, allSeries);

    req.app.get('io')?.emit('leaderboard:update', { leagueId: req.params.id });

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

function safeLeague(league: League) {
  const { passwordHash: _ph, ...safe } = league;
  return { ...safe, hasPassword: !!league.passwordHash };
}

export default router;
