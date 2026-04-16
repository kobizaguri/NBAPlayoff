import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { Notification, NotificationType } from '../types';

function rowToNotification(row: Record<string, unknown>): Notification {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    type: row.type as NotificationType,
    payload: row.payload as Record<string, unknown>,
    readAt: row.read_at ? (row.read_at as Date).toISOString() : undefined,
    createdAt: (row.created_at as Date).toISOString(),
  };
}

export async function getNotificationsByUser(userId: string): Promise<Notification[]> {
  const { rows } = await pool.query(
    'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(rowToNotification);
}

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
): Promise<Notification> {
  const { rows } = await pool.query(
    'INSERT INTO notifications (id,user_id,type,payload) VALUES ($1,$2,$3,$4) RETURNING *',
    [uuidv4(), userId, type, JSON.stringify(payload)],
  );
  return rowToNotification(rows[0]);
}

export async function markRead(id: string, userId: string): Promise<Notification | null> {
  const { rows } = await pool.query(
    'UPDATE notifications SET read_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *',
    [id, userId],
  );
  return rows[0] ? rowToNotification(rows[0]) : null;
}

export async function markAllRead(userId: string): Promise<void> {
  await pool.query(
    'UPDATE notifications SET read_at=NOW() WHERE user_id=$1 AND read_at IS NULL',
    [userId],
  );
}

export async function hasDeadlineNotification(
  userId: string,
  seriesId: string,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM notifications WHERE user_id=$1 AND type='deadlineApproaching'
     AND payload->>'seriesId' = $2`,
    [userId, seriesId],
  );
  return rows.length > 0;
}
