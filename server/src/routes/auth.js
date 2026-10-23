import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { asyncHandler, HttpError } from '../errors.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (u) => ({ id: u.id, email: u.email, fullName: u.full_name });

router.post('/register', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const fullName = String(req.body.fullName || '').trim();

  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'A valid email is required');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (!fullName) throw new HttpError(400, 'Full name is required');

  const existing = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  if (existing.rowCount) throw new HttpError(409, 'An account with this email already exists');

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query(
    'INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name',
    [email, hash, fullName],
  );
  res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw new HttpError(401, 'Invalid email or password');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT id, email, full_name FROM users WHERE id = $1', [req.userId]);
  if (!rows[0]) throw new HttpError(404, 'User not found');
  res.json({ user: publicUser(rows[0]) });
}));

export default router;
