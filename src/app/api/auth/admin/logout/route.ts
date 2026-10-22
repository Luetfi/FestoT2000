import { NextResponse } from 'next/server';
import { cookieOptions, ADMIN_SESSION_COOKIE_NAME } from '@/lib/auth/session';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_SESSION_COOKIE_NAME, '', { ...cookieOptions(0), maxAge: 0 });
  return res;
}
