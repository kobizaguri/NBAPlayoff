import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import * as notificationsDb from '../db/notifications';

const router = Router();

// ─── GET notifications for current user ──────────────────────────────────────

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await notificationsDb.getNotificationsByUser(req.user!.userId);
    res.json(notifications);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── MARK as read ─────────────────────────────────────────────────────────────

router.put('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await notificationsDb.markRead(req.params.id, req.user!.userId);
    if (!updated) {
      res.status(404).json({ error: 'Notification not found' });
      return;
    }
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

// ─── MARK ALL as read ─────────────────────────────────────────────────────────

router.put('/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await notificationsDb.markAllRead(req.user!.userId);
    res.sendStatus(204);
  } catch {
    res.status(500).json({ error: 'Database error' });
  }
});

export default router;
