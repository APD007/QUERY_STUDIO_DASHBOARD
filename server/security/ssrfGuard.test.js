import { describe, it, expect } from 'vitest';
import { assertPublicHost } from './ssrfGuard.js';

describe('assertPublicHost', () => {
  it('rejects malformed URLs', async () => {
    await expect(assertPublicHost('not a url')).rejects.toThrow();
  });

  it('rejects non-http(s) protocols', async () => {
    await expect(assertPublicHost('file:///etc/passwd')).rejects.toThrow();
  });

  it('rejects localhost', async () => {
    await expect(assertPublicHost('http://localhost:5174/api/health')).rejects.toThrow();
  });

  it('rejects loopback and private IPv4 literals', async () => {
    await expect(assertPublicHost('http://127.0.0.1')).rejects.toThrow();
    await expect(assertPublicHost('http://10.0.0.1')).rejects.toThrow();
    await expect(assertPublicHost('http://192.168.1.1')).rejects.toThrow();
    await expect(assertPublicHost('http://172.16.0.5')).rejects.toThrow();
  });

  it('rejects the link-local / cloud-metadata range', async () => {
    await expect(assertPublicHost('http://169.254.169.254/latest/meta-data')).rejects.toThrow();
  });

  it('allows a public IPv4 literal through', async () => {
    await expect(assertPublicHost('http://8.8.8.8')).resolves.toBeInstanceOf(URL);
  });
});
