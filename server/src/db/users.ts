import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { User, RefreshToken } from '../types';

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    displayName: row.display_name as string,
    avatarUrl: row.avatar_url as string | undefined,
    isAdmin: row.is_admin as boolean,
    notificationPreferences: row.notification_prefs as User['notificationPreferences'],
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE lower(username) = lower($1)',
    [username],
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function getAllUsers(): Promise<User[]> {
  const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at');
  return rows.map(rowToUser);
}

export async function createUser(
  user: Omit<User, 'id' | 'createdAt'> & { id?: string },
): Promise<User> {
  const id = user.id ?? uuidv4();
  const { rows } = await pool.query(
    `INSERT INTO users (id, username, password_hash, display_name, avatar_url, is_admin, notification_prefs)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      id,
      user.username,
      user.passwordHash,
      user.displayName,
      user.avatarUrl ?? null,
      user.isAdmin,
      JSON.stringify(user.notificationPreferences),
    ],
  );
  return rowToUser(rows[0]);
}

export async function updateUser(
  id: string,
  patch: Partial<Pick<User, 'displayName' | 'avatarUrl' | 'notificationPreferences' | 'passwordHash'>>,
): Promise<User | null> {
  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;
  if (patch.displayName !== undefined) {
    sets.push(`display_name = $${i++}`);
    vals.push(patch.displayName);
  }
  if (patch.avatarUrl !== undefined) {
    sets.push(`avatar_url = $${i++}`);
    vals.push(patch.avatarUrl ?? null);
  }
  if (patch.notificationPreferences !== undefined) {
    sets.push(`notification_prefs = $${i++}`);
    vals.push(JSON.stringify(patch.notificationPreferences));
  }
  if (patch.passwordHash !== undefined) {
    sets.push(`password_hash = $${i++}`);
    vals.push(patch.passwordHash);
  }
  if (sets.length === 0) return getUserById(id);
  vals.push(id);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    vals,
  );
  return rows[0] ? rowToUser(rows[0]) : null;
}

// ── Refresh tokens ──────────────────────────────────────────────────────────

export async function saveRefreshToken(token: RefreshToken): Promise<void> {
  await pool.query(
    'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1,$2,$3)',
    [token.token, token.userId, token.expiresAt],
  );
}

export async function findRefreshToken(token: string): Promise<RefreshToken | null> {
  const { rows } = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token = $1',
    [token],
  );
  if (!rows[0]) return null;
  return {
    token: rows[0].token as string,
    userId: rows[0].user_id as string,
    expiresAt: (rows[0].expires_at as Date).toISOString(),
  };
}

export async function deleteRefreshToken(token: string): Promise<void> {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}
