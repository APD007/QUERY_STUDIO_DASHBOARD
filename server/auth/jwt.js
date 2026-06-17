import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';

const SECRET = process.env.JWT_SECRET || (() => {
  console.warn('[auth] JWT_SECRET not set — generating an ephemeral one (sessions will not survive a restart).');
  return randomBytes(32).toString('hex');
})();

const EXPIRES_IN = '7d';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export const COOKIE_NAME = 'qs_token';
export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
