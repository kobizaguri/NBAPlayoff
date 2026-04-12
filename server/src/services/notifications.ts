import { v4 as uuidv4 } from 'uuid';
import { readStore, writeStore } from '../data/store';
import { Notification, NotificationType, User, PlayoffSeries, Prediction } from '../types';

export function createNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
): Notification {
  const notifications = readStore<Notification>('notifications');
  const notification: Notification = {
    id: uuidv4(),
    userId,
    type,
    payload,
    createdAt: new Date().toISOString(),
  };
  notifications.push(notification);
  writeStore('notifications', notifications);
  return notification;
}

/**
 * Check all series deadlines and create "deadlineApproaching" notifications
 * for users who have predictions that are about to lock (24 h window).
 * Called on an interval from index.ts.
 */
export function checkDeadlineNotifications(): void {
  const series = readStore<PlayoffSeries>('series');
  const predictions = readStore<Prediction>('predictions');
  const users = readStore<User>('users');
  const notifications = readStore<Notification>('notifications');

  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;

  for (const s of series) {
    if (s.status !== 'pending' && s.status !== 'active') continue;
    const deadlineMs = new Date(s.deadline).getTime();
    if (deadlineMs - now > windowMs || deadlineMs <= now) continue;

    // Find users with predictions for this series
    const seriesPredictions = predictions.filter((p) => p.seriesId === s.id && !p.isLocked);
    for (const pred of seriesPredictions) {
      const user = users.find((u) => u.id === pred.userId);
      if (!user?.notificationPreferences.deadlineApproaching) continue;

      const alreadyNotified = notifications.some(
        (n) =>
          n.userId === pred.userId &&
          n.type === 'deadlineApproaching' &&
          (n.payload as Record<string, unknown>).seriesId === s.id,
      );
      if (alreadyNotified) continue;

      const notification: Notification = {
        id: uuidv4(),
        userId: pred.userId,
        type: 'deadlineApproaching',
        payload: {
          seriesId: s.id,
          homeTeamName: s.homeTeamName,
          awayTeamName: s.awayTeamName,
          deadline: s.deadline,
        },
        createdAt: new Date().toISOString(),
      };
      notifications.push(notification);
    }
  }

  writeStore('notifications', notifications);
}
