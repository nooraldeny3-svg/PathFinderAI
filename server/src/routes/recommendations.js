import { Router } from 'express';
import { query } from '../db.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { loadAssessment, loadCareers } from '../services/careers.js';
import { findMissingFields, recommend } from '../services/recommender/index.js';

const router = Router();
router.use(requireAuth);

const toResponse = (row) => ({ id: row.id, source: row.source, createdAt: row.created_at, ...row.payload });

router.post('/', asyncHandler(async (req, res) => {
  const assessment = await loadAssessment(req.userId);
  const missing = findMissingFields(assessment);
  if (missing.length) {
    throw new HttpError(422, 'Your assessment is incomplete. Please answer the essential questions first.', missing);
  }

  const result = await recommend(assessment, await loadCareers());
  const { rows } = await query(
    'INSERT INTO recommendations (user_id, source, payload) VALUES ($1, $2, $3) RETURNING *',
    [req.userId, result.source, { recommendations: result.recommendations, notice: result.notice }],
  );
  res.status(201).json(toResponse(rows[0]));
}));

router.get('/latest', asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT * FROM recommendations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
    [req.userId],
  );
  if (!rows[0]) throw new HttpError(404, 'No recommendations yet');
  res.json(toResponse(rows[0]));
}));

router.post('/:id/feedback', asyncHandler(async (req, res) => {
  const recommendationId = Number(req.params.id);
  const careerId = Number(req.body.careerId);
  const rating = Number(req.body.rating);
  const comment = req.body.comment ? String(req.body.comment).slice(0, 1000) : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Rating must be from 1 to 5');

  const { rows } = await query('SELECT payload FROM recommendations WHERE id = $1 AND user_id = $2', [recommendationId, req.userId]);
  if (!rows[0]) throw new HttpError(404, 'Recommendation not found');
  if (!rows[0].payload.recommendations.some((r) => r.careerId === careerId)) {
    throw new HttpError(400, 'This career is not part of the recommendation');
  }

  await query(
    `INSERT INTO feedback (recommendation_id, user_id, career_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (recommendation_id, career_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment`,
    [recommendationId, req.userId, careerId, rating, comment],
  );
  res.status(204).end();
}));

export default router;
