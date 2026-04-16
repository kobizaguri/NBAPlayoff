import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';

import pool from './db';
import { initSocket } from './socket';
import { errorHandler } from './middleware/errorHandler';
import { checkDeadlineNotifications } from './services/notifications';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import leagueRoutes from './routes/leagues';
import seriesRoutes from './routes/series';
import predictionsRoutes from './routes/predictions';
import adminRoutes from './routes/admin';
import notificationRoutes from './routes/notifications';

async function start() {
  // Test DB connection on startup
  try {
    await pool.query('SELECT 1');
    console.info('[db] Connected to PostgreSQL');
  } catch (err) {
    console.error('[db] Failed to connect:', err);
    process.exit(1);
  }

  const app = express();
  const PORT = parseInt(process.env.PORT ?? '3001', 10);

  // ── Middleware ────────────────────────────────────────────────────────────
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }));
  app.use(express.json());

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/leagues', leagueRoutes);
  app.use('/api/series', seriesRoutes);
  app.use('/api/leagues', predictionsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  // ── Error handler ─────────────────────────────────────────────────────────
  app.use(errorHandler);

  // ── HTTP server + Socket.IO ───────────────────────────────────────────────
  const httpServer = http.createServer(app);
  const io = initSocket(httpServer);
  app.set('io', io);

  // ── Start server ──────────────────────────────────────────────────────────
  httpServer.listen(PORT, () => {
    console.info(`[server] listening on http://localhost:${PORT}`);
  });

  // ── Deadline notification check (every 15 minutes) ────────────────────────
  setInterval(() => { checkDeadlineNotifications().catch(console.error); }, 15 * 60 * 1000);
}

start();
