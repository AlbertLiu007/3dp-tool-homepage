import { NextResponse } from 'next/server';
import { GIFT_SESSION_COOKIE, giftSessionCookieOptions } from '@/lib/gift-auth';

export function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(GIFT_SESSION_COOKIE, '', { ...giftSessionCookieOptions(), maxAge: 0 });
  return response;
}
