import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a different salt (and hash) for the same password each time', async () => {
    const hashA = await hashPassword('same-password');
    const hashB = await hashPassword('same-password');
    expect(hashA).not.toBe(hashB);
    expect(await verifyPassword('same-password', hashA)).toBe(true);
    expect(await verifyPassword('same-password', hashB)).toBe(true);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
  });
});
