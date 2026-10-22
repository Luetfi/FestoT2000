import { NextResponse } from 'next/server';
import { createSession, cookieOptions, SESSION_COOKIE_NAME } from '@/lib/auth/session';

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const aBuf = await crypto.subtle.digest('SHA-256', encoder.encode(a));
  const bBuf = await crypto.subtle.digest('SHA-256', encoder.encode(b));
  const aArr = new Uint8Array(aBuf);
  const bArr = new Uint8Array(bBuf);
  if (aArr.length !== bArr.length) return false;
  let result = 0;
  for (let i = 0; i < aArr.length; i++) {
    result |= aArr[i] ^ bArr[i];
  }
  return result === 0;
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const expectedUser = process.env.AUTH_USERNAME;
    const expectedPass = process.env.AUTH_PASSWORD;

    if (!expectedUser || !expectedPass) {
      return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
    }

    const [userOk, passOk] = await Promise.all([
      timingSafeEqual(username ?? '', expectedUser),
      timingSafeEqual(password ?? '', expectedPass),
    ]);

    if (!userOk || !passOk) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createSession(username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE_NAME, token, cookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
