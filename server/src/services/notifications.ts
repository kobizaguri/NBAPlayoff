import * as notificationsDb from '../db/notifications';
import * as seriesDb from '../db/series';
import * as usersDb from '../db/users';
import * as predictionsDb from '../db/predictions';
import { Notification, NotificationType } from '../types';

export async function createNotification(
  userId: string,
  type: NotificationType,
  payload: Record<string, unknown>,
): Promise<Notification> {
  return notificationsDb.createNotification(userId, type, payload);
}

export async function checkDeadlineNotifications(): Promise<void> {
  const allSeries = await seriesDb.getAllSeries();
  const now = Date.now();
  const windowMs = 24 * 60 * 60 * 1000;

  for (const s of allSeries) {
    if (s.status !== 'pending' && s.status !== 'active') continue;
    const deadlineMs = new Date(s.deadline).getTime();
    if (deadlineMs - now > windowMs || deadlineMs <= now) continue;

    const predictions = await predictionsDb.getPredictionsBySeries(s.id);
    for (const pred of predictions) {
      if (pred.isLocked) continue;
      const user = await usersDb.getUserById(pred.userId);
      if (!user?.notificationPreferences.deadlineApproaching) continue;
      const alreadyNotified = await notificationsDb.hasDeadlineNotification(pred.userId, s.id);
      if (alreadyNotified) continue;
      await notificationsDb.createNotification(pred.userId, 'deadlineApproaching', {
        seriesId: s.id,
        homeTeamName: s.homeTeamName,
        awayTeamName: s.awayTeamName,
        deadline: s.deadline,
      });
    }
  }
}

