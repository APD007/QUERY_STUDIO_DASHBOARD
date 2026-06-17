import dns from 'node:dns';

const { promises: dnsPromises } = dns;

function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 0) return true; // unspecified
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  if (lower.startsWith('fe80')) return true; // link-local
  if (lower === '::') return true; // unspecified
  return false;
}

/** Resolves the hostname and throws if it points at a private/loopback/link-local address. */
export async function assertPublicHost(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed.');
  }
  if (parsed.hostname === 'localhost') {
    throw new Error('Requests to localhost are not allowed.');
  }

  let addresses;
  try {
    addresses = await dnsPromises.lookup(parsed.hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve host "${parsed.hostname}".`);
  }

  for (const { address, family } of addresses) {
    const blocked = family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address);
    if (blocked) throw new Error(`Requests to private/internal addresses are not allowed (${address}).`);
  }

  return parsed;
}
