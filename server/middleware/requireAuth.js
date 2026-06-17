import { verifyToken, COOKIE_NAME } from '../auth/jwt.js';

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'Not authenticated' });
  req.user = payload;
  next();
}
