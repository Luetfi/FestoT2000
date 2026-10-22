export const SESSION_COOKIE_NAME = 'festo_session';
// Separate cookie for the admin area. Distinct name + a role claim (see
// createAdminSession) keep admin auth fully independent from the app login,
// even though both are HMAC-signed with the same AUTH_SECRET.
export const ADMIN_SESSION_COOKIE_NAME = 'festo_admin_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds

function getSecret(): ArrayBuffer {
  const hex = process.env.AUTH_SECRET;
  if (!hex || hex.length < 32) {
    throw new Error('AUTH_SECRET env var is missing or too short');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return toArrayBuffer(bytes);
}

function toArrayBuffer(arr: Uint8Array): ArrayBuffer {
  // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer issues
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return buf;
}

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    getSecret(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const encoded = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign('HMAC', key, encoded);
  return `${base64url(toArrayBuffer(encoded))}.${base64url(sig)}`;
}

async function verifySignature(token: string): Promise<string | null> {
  const dotIdx = token.indexOf('.');
  if (dotIdx === -1) return null;
  const payloadB64 = token.substring(0, dotIdx);
  const sigB64 = token.substring(dotIdx + 1);

  const payloadBytes = base64urlDecode(payloadB64);
  const payload = new TextDecoder().decode(payloadBytes);
  const sig = base64urlDecode(sigB64);

  const key = await crypto.subtle.importKey(
    'raw',
    getSecret(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify('HMAC', key, toArrayBuffer(sig), toArrayBuffer(payloadBytes));
  return valid ? payload : null;
}

export async function createSession(username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ sub: username, iat: now, exp: now + SESSION_DURATION });
  return sign(payload);
}

export async function verify(token: string): Promise<{ sub: string } | null> {
  const payload = await verifySignature(token);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) {
      return null; // expired
    }
    return { sub: data.sub };
  } catch {
    return null;
  }
}

// --- Admin session (separate gate) ---
// Reuses the same signing/secret as the app session but stamps role:'admin'.
// A normal festo_session token has no role claim, so it can never satisfy
// verifyAdmin even if copied into the admin cookie.

export async function createAdminSession(username: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({ sub: username, role: 'admin', iat: now, exp: now + SESSION_DURATION });
  return sign(payload);
}

export async function verifyAdmin(token: string): Promise<{ sub: string } | null> {
  const payload = await verifySignature(token);
  if (!payload) return null;
  try {
    const data = JSON.parse(payload);
    if (data.role !== 'admin') return null;
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) {
      return null; // expired
    }
    return { sub: data.sub };
  } catch {
    return null;
  }
}

export function cookieOptions(maxAge = SESSION_DURATION) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}
