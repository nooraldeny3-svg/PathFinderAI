import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { INTEREST_IDS } from '../interests.js';
import { loadAssessment } from '../services/careers.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncHandler(async (req, res) => {
  res.json({ assessment: await loadAssessment(req.userId) });
}));

// Saves the full assessment (replaces previously saved skills).
router.put('/', asyncHandler(async (req, res) => {
  const major = String(req.body.major || '').trim();
  const graduationYear = req.body.graduationYear ? Number(req.body.graduationYear) : null;
  const interests = Array.isArray(req.body.interests) ? [...new Set(req.body.interests)] : [];
  const skills = Array.isArray(req.body.skills) ? req.body.skills : [];

  if (!major) throw new HttpError(400, 'Major is required');
  if (graduationYear !== null && !(Number.isInteger(graduationYear) && graduationYear >= 1950 && graduationYear <= 2100)) {
    throw new HttpError(400, 'Graduation year is invalid');
  }
  const unknownInterests = interests.filter((i) => !INTEREST_IDS.has(i));
  if (unknownInterests.length) throw new HttpError(400, 'Unknown interests', unknownInterests);

  const skillLevels = new Map();
  for (const s of skills) {
    const skillId = Number(s.skillId);
    const level = Number(s.level);
    if (!Number.isInteger(skillId) || !Number.isInteger(level) || level < 1 || level > 5) {
      throw new HttpError(400, 'Each skill needs a skillId and a level from 1 to 5');
    }
    skillLevels.set(skillId, level);
  }
  if (skillLevels.size) {
    const { rows } = await query('SELECT id FROM skills WHERE id = ANY($1::int[])', [[...skillLevels.keys()]]);
    if (rows.length !== skillLevels.size) throw new HttpError(400, 'One or more skills do not exist');
  }

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO profiles (user_id, major, graduation_year, interests, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
       SET major = EXCLUDED.major, graduation_year = EXCLUDED.graduation_year,
           interests = EXCLUDED.interests, updated_at = now()`,
      [req.userId, major, graduationYear, interests],
    );
    await client.query('DELETE FROM user_skills WHERE user_id = $1', [req.userId]);
    for (const [skillId, level] of skillLevels) {
      await client.query('INSERT INTO user_skills (user_id, skill_id, level) VALUES ($1, $2, $3)', [req.userId, skillId, level]);
    }
  });

  res.json({ assessment: await loadAssessment(req.userId) });
}));

export default router;
