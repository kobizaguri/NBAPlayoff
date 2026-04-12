import { Router, Response } from 'express';
import { z } from 'zod';
import { readStore, writeStore } from '../data/store';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Notification } from '../types';

const router = Router();

// ─── GET notifications for current user ──────────────────────────────────────

router.get('/', requireAuth, (req: AuthRequest, res: Response) => {
  const notifications = readStore<Notification>('notifications')
    .filter((n) => n.userId === req.user!.userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json(notifications);
});

// ─── MARK as read ─────────────────────────────────────────────────────────────

router.put('/:id/read', requireAuth, (req: AuthRequest, res: Response) => {
  const notifications = readStore<Notification>('notifications');
  const idx = notifications.findIndex(
    (n) => n.id === req.params.id && n.userId === req.user!.userId,
  );
  if (idx === -1) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  notifications[idx].readAt = new Date().toISOString();
  writeStore('notifications', notifications);
  res.json(notifications[idx]);
});

// ─── MARK ALL as read ─────────────────────────────────────────────────────────

router.put('/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const notifications = readStore<Notification>('notifications');
  const now = new Date().toISOString();
  let changed = false;
  for (let i = 0; i < notifications.length; i++) {
    if (notifications[i].userId === req.user!.userId && !notifications[i].readAt) {
      notifications[i].readAt = now;
      changed = true;
    }
  }
  if (changed) writeStore('notifications', notifications);
  res.sendStatus(204);
});

export default router;
