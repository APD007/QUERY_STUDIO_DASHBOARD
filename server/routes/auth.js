import express from 'express';
import { createUser, findUserByEmail, findUserById } from '../db/appDb.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { signToken, COOKIE_NAME, COOKIE_OPTIONS } from '../auth/jwt.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Express 4 doesn't catch rejected promises from async handlers on its own —
// without this, a transient DB error would hang the request instead of erroring.
const wrap = fn => (req, res, next) => fn(req, res, next).catch(next);

router.post('/register', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (await findUserByEmail(email)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const passwordHash = await hashPassword(password);
  const user = await createUser(email, passwordHash);
  const token = signToken({ sub: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.status(201).json({ id: user.id, email: user.email });
}));

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  const user = typeof email === 'string' ? await findUserByEmail(email) : null;
  const ok = user && typeof password === 'string' && (await verifyPassword(password, user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });
  const token = signToken({ sub: user.id, email: user.email });
  res.cookie(COOKIE_NAME, token, COOKIE_OPTIONS);
  res.json({ id: user.id, email: user.email });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.json({ ok: true });
});

router.get('/me', requireAuth, wrap(async (req, res) => {
  const user = await findUserById(req.user.sub);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ id: user.id, email: user.email });
}));

export default router;
