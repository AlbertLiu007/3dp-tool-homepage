import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { WECOM_STATE_COOKIE, weComStateCookieOptions } from '@/lib/gift-auth';
import { buildWeComQrLoginUrl, WeComAuthError } from '@/lib/wecom';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const state = randomBytes(32).toString('base64url');
    const language = request.cookies.get('unionam.language')?.value === 'en' ? 'en' : 'zh';
    const response = NextResponse.redirect(buildWeComQrLoginUrl(state, language));
    response.cookies.set(WECOM_STATE_COOKIE, state, weComStateCookieOptions());
    return response;
  } catch (error) {
    const reason = error instanceof WeComAuthError && error.reason === 'configuration' ? 'configuration' : 'login_failed';
    return NextResponse.redirect(new URL(`/gift?auth_error=${reason}`, request.url));
  }
}
