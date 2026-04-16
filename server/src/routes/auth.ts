import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User } from '../types';
import * as usersDb from '../db/users';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'fallback-refresh-secret';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

function generateTokens(userId: string, isAdmin: boolean) {
  const accessToken = jwt.sign({ userId, isAdmin }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
  const refreshToken = jwt.sign({ userId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  return { accessToken, refreshToken };
}

// ─── Register ────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(50).optional(),
});

router.post('/register', authLimiter, async (req, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { username, password, displayName } = parsed.data;

  try {
    const existing = await usersDb.getUserByUsername(username);
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const passwordHash = bcrypt.hashSync(password, 12);
    const user = await usersDb.createUser({
      username,
      passwordHash,
      displayName: displayName ?? username,
      isAdmin: username.toLowerCase() === 'kobi',
      notificationPreferences: {
        leagueInvite: true,
        deadlineApproaching: true,
        seriesResult: true,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user.id, user.isAdmin);
    await usersDb.saveRefreshToken({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString(),
    });

    res.status(201).json({ accessToken, refreshToken, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Login ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', authLimiter, async (req, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const { username, password } = parsed.data;

  try {
    const user = await usersDb.getUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const { accessToken, refreshToken } = generateTokens(user.id, user.isAdmin);
    await usersDb.saveRefreshToken({
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString(),
    });

    res.json({ accessToken, refreshToken, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

router.post('/refresh', async (req, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) {
    res.status(400).json({ error: 'Refresh token required' });
    return;
  }

  let payload: { userId: string };
  try {
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
  } catch {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  try {
    const stored = await usersDb.findRefreshToken(refreshToken);
    if (!stored || stored.userId !== payload.userId) {
      res.status(401).json({ error: 'Refresh token not found' });
      return;
    }

    // Rotate — invalidate old token
    await usersDb.deleteRefreshToken(refreshToken);

    const user = await usersDb.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.isAdmin);
    await usersDb.saveRefreshToken({
      token: newRefreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString(),
    });

    res.json({ accessToken, refreshToken: newRefreshToken, user: safeUser(user) });
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/logout', async (req, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    try {
      await usersDb.deleteRefreshToken(refreshToken);
    } catch {
      // ignore errors on logout
    }
  }
  res.sendStatus(204);
});

// ─── Me ──────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await usersDb.getUserById(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(safeUser(user));
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeUser(user: User) {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

export default router;
