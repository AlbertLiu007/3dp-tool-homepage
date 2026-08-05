import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  WECOM_RETURN_COOKIE,
  WECOM_STATE_COOKIE,
  weComReturnCookieOptions,
  weComStateCookieOptions,
} from '@/lib/gift-auth';
import { buildWeComQrLoginUrl, giftPublicUrl, WeComAuthError } from '@/lib/wecom';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const state = randomBytes(32).toString('base64url');
    const returnTarget = request.nextUrl.searchParams.get('return_to') === 'ops' ? 'ops' : 'gift';
    const language = request.cookies.get('unionam.language')?.value === 'en' ? 'en' : 'zh';
    const response = NextResponse.redirect(buildWeComQrLoginUrl(state, language));
    response.cookies.set(WECOM_STATE_COOKIE, state, weComStateCookieOptions());
    response.cookies.set(WECOM_RETURN_COOKIE, returnTarget, weComReturnCookieOptions());
    return response;
  } catch (error) {
    const reason = error instanceof WeComAuthError && error.reason === 'configuration' ? 'configuration' : 'login_failed';
    return NextResponse.redirect(giftPublicUrl(`/gift?auth_error=${reason}`));
  }
}
