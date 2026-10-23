import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { errorHandler } from './errors.js';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import profileRoutes from './routes/profile.js';
import recommendationRoutes from './routes/recommendations.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes);
  app.use('/api', catalogRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/recommendations', recommendationRoutes);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
  app.use(errorHandler);
  return app;
}
