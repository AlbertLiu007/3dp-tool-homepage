import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { GiftAccessError, requireGiftEmployeeAccess, type GiftEmployeeAccess } from '@/lib/gift-db';

export const GIFT_OPS_CSRF_COOKIE = 'unionam.gift.ops.csrf';

type RateEntry = { count: number; resetAt: number };

declare global {
  // eslint-disable-next-line no-var
  var unionamGiftOpsRateLimits: Map<string, RateEntry> | undefined;
}

const rateLimits = globalThis.unionamGiftOpsRateLimits ?? new Map<string, RateEntry>();
globalThis.unionamGiftOpsRateLimits = rateLimits;

export function createGiftOpsCsrfToken() {
  return randomBytes(32).toString('base64url');
}

export function giftOpsCsrfCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/gift/ops',
    maxAge: 8 * 60 * 60,
  };
}

export function requestIp(request: NextRequest | Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function enforceOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) throw new GiftAccessError('Origin header is required.', 403, 'forbidden');
  const allowed = new Set<string>();
  if (process.env.NODE_ENV !== 'production') allowed.add('http://localhost:3000');
  allowed.add((process.env.GIFT_OPS_ORIGIN?.trim() || 'https://ops.unionam.com').replace(/\/+$/, ''));
  if (!allowed.has(origin.replace(/\/+$/, ''))) throw new GiftAccessError('The request origin is not allowed.', 403, 'forbidden');
}

function enforceCsrf(request: NextRequest) {
  enforceOrigin(request);
  const cookieToken = request.cookies.get(GIFT_OPS_CSRF_COOKIE)?.value;
  const headerToken = request.headers.get('x-unionam-csrf')?.trim();
  if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
    throw new GiftAccessError('The security token is invalid or expired.', 403, 'forbidden');
  }
}

function enforceRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const existing = rateLimits.get(key);
  if (!existing || existing.resetAt <= now) {
    rateLimits.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) throw new GiftAccessError('Too many Ops requests. Try again shortly.', 429, 'quota');
  existing.count += 1;
  if (rateLimits.size > 5000) {
    for (const [entryKey, entry] of rateLimits) if (entry.resetAt <= now) rateLimits.delete(entryKey);
  }
}

export async function authorizeGiftOpsRequest(request: NextRequest, options: { admin?: boolean; mutation?: boolean } = {}) {
  const session = getGiftSession();
  if (!session) throw new GiftAccessError('Authentication required.', 401, 'authentication');
  const employee = await requireGiftEmployeeAccess(session, { approved: true, operator: true });
  if (options.admin && employee.role !== 'admin') throw new GiftAccessError('Administrator access is required.', 403, 'forbidden');
  if (options.mutation) enforceCsrf(request);
  enforceRateLimit(`${employee.id}:${request.nextUrl.pathname}:${options.mutation ? 'write' : 'read'}`, options.mutation ? 30 : 120, 60_000);
  return { session, employee, requestIp: requestIp(request) };
}

export function giftOpsErrorResponse(error: unknown, context: string) {
  if (error instanceof GiftAccessError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  console.error(`[gift-ops] ${context}`, error);
  return NextResponse.json(
    { error: 'internal', message: 'Unexpected Ops service error.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

export type GiftOpsActor = GiftEmployeeAccess;
