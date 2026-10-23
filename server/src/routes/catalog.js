import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler } from '../errors.js';
import { INTERESTS } from '../interests.js';
import { loadCareers } from '../services/careers.js';

const router = Router();

router.get('/skills', asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT id, name, category FROM skills ORDER BY category, name');
  res.json({ skills: rows });
}));

router.get('/interests', (_req, res) => res.json({ interests: INTERESTS }));

router.get('/majors', asyncHandler(async (_req, res) => {
  const { rows } = await query('SELECT DISTINCT unnest(related_majors) AS major FROM careers ORDER BY major');
  res.json({ majors: rows.map((r) => r.major) });
}));

router.get('/careers', asyncHandler(async (_req, res) => {
  res.json({ careers: await loadCareers() });
}));

export default router;
