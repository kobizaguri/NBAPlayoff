import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { readStore, writeStore } from '../data/store';
import { authLimiter } from '../middleware/rateLimit';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { User, RefreshToken } from '../types';

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

router.post('/register', authLimiter, (req, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { username, password, displayName } = parsed.data;
  const users = readStore<User>('users');

  if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const user: User = {
    id: uuidv4(),
    username,
    passwordHash,
    displayName: displayName ?? username,
    isAdmin: username.toLowerCase() === 'kobi',
    notificationPreferences: {
      leagueInvite: true,
      deadlineApproaching: true,
      seriesResult: true,
    },
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  writeStore('users', users);

  const { accessToken, refreshToken } = generateTokens(user.id, user.isAdmin);
  const tokens = readStore<RefreshToken>('refreshTokens');
  tokens.push({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString(),
  });
  writeStore('refreshTokens', tokens);

  res.status(201).json({
    accessToken,
    refreshToken,
    user: safeUser(user),
  });
});

// ─── Login ───────────────────────────────────────────────────────────────────

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

router.post('/login', authLimiter, (req, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const { username, password } = parsed.data;
  const users = readStore<User>('users');
  const user = users.find((u) => u.username.toLowerCase() === username.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const { accessToken, refreshToken } = generateTokens(user.id, user.isAdmin);
  const tokens = readStore<RefreshToken>('refreshTokens');
  tokens.push({
    token: refreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString(),
  });
  writeStore('refreshTokens', tokens);

  res.json({ accessToken, refreshToken, user: safeUser(user) });
});

// ─── Refresh ─────────────────────────────────────────────────────────────────

router.post('/refresh', (req, res: Response) => {
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

  const tokens = readStore<RefreshToken>('refreshTokens');
  const tokenIndex = tokens.findIndex(
    (t) => t.token === refreshToken && t.userId === payload.userId,
  );
  if (tokenIndex === -1) {
    res.status(401).json({ error: 'Refresh token not found' });
    return;
  }

  // Rotate — invalidate old token
  tokens.splice(tokenIndex, 1);

  const users = readStore<User>('users');
  const user = users.find((u) => u.id === payload.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.isAdmin);
  tokens.push({
    token: newRefreshToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS).toISOString(),
  });
  writeStore('refreshTokens', tokens);

  res.json({ accessToken, refreshToken: newRefreshToken, user: safeUser(user) });
});

// ─── Logout ──────────────────────────────────────────────────────────────────

router.post('/logout', (req, res: Response) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (refreshToken) {
    const tokens = readStore<RefreshToken>('refreshTokens');
    const filtered = tokens.filter((t) => t.token !== refreshToken);
    writeStore('refreshTokens', filtered);
  }
  res.sendStatus(204);
});

// ─── Me ──────────────────────────────────────────────────────────────────────

router.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  const users = readStore<User>('users');
  const user = users.find((u) => u.id === req.user!.userId);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(safeUser(user));
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeUser(user: User) {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

export default router;
