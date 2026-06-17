import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEY_LEN = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, KEY_LEN);
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const derived = await scrypt(password, salt, KEY_LEN);
  const stored_ = Buffer.from(hashHex, 'hex');
  if (derived.length !== stored_.length) return false;
  return timingSafeEqual(derived, stored_);
}
