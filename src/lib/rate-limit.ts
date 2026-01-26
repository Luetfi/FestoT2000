// Rate limiting with Upstash Redis
// IP-based rate limiting prevents abuse
// Rate limit triggers user-friendly message
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

let _ratelimit: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  if (_ratelimit) return _ratelimit;

  // Check if Upstash env vars are configured
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('Rate limiting disabled: Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN');
    return null;
  }

  const redis = Redis.fromEnv();
  _ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
    prefix: 'festo-video-search',
  });

  return _ratelimit;
}

// Export for direct usage (may be null if not configured)
export const ratelimit = getRatelimit();

// German user-friendly error message
export const RATE_LIMIT_MESSAGE = 'Zu viele Anfragen – bitte kurz warten';
export const RATE_LIMIT_MESSAGE_EN = 'Too many requests – please wait a moment';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given identifier (usually IP address)
 */
export async function checkRateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRatelimit();
  if (!limiter) {
    // Rate limiting disabled - allow all requests
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }
  const result = await limiter.limit(identifier);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Get client IP address from request headers
 * Handles Vercel's x-forwarded-for and x-real-ip headers
 */
export function getClientIp(request: Request): string {
  // Vercel provides x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP if multiple (client, proxy1, proxy2...)
    return forwardedFor.split(',')[0].trim();
  }

  // Fallback to x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Local development fallback
  return '127.0.0.1';
}

/**
 * Rate limit middleware helper for API routes
 * Returns Response if rate limited, null if allowed
 */
export async function rateLimitMiddleware(request: Request): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const result = await checkRateLimit(ip);

  if (!result.success) {
    return NextResponse.json(
      {
        error: RATE_LIMIT_MESSAGE,
        error_en: RATE_LIMIT_MESSAGE_EN,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null;
}
