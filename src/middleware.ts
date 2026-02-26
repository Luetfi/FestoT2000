import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verify, SESSION_COOKIE_NAME, cookieOptions } from '@/lib/auth/session';

const PUBLIC_PATHS = ['/login', '/api/auth'];
const SELF_AUTHED_PREFIXES = ['/api/cron', '/api/ingest', '/api/seed', '/api/health'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for login page and auth API
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip auth for endpoints that have their own Bearer-token auth
  if (SELF_AUTHED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return redirectToLogin(request);
  }

  const session = await verify(token);
  if (!session) {
    // Expired or invalid — clear cookie and redirect
    const res = redirectToLogin(request);
    res.cookies.set(SESSION_COOKIE_NAME, '', { ...cookieOptions(0), maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const from = url.pathname + url.search;
  url.pathname = '/login';
  url.search = from !== '/' ? `?from=${encodeURIComponent(from)}` : '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, festo-logo.png (static assets)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|festo-logo\\.png).*)',
  ],
};
