import { NextResponse } from 'next/server';
import { createGiftSessionToken, GIFT_SESSION_COOKIE, giftSessionCookieOptions } from '@/lib/gift-auth';

export function POST() {
  if (process.env.NODE_ENV === 'production') return new NextResponse(null, { status: 404 });

  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(
    GIFT_SESSION_COOKIE,
    createGiftSessionToken({
      userId: 'local-development-employee',
      name: '本地开发员工',
      departments: [1],
      corpId: process.env.WECOM_CORP_ID ?? 'local-development',
    }),
    giftSessionCookieOptions(),
  );
  return response;
}
