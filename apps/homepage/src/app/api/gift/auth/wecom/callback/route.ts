import { NextRequest, NextResponse } from 'next/server';
import {
  compareOAuthState,
  createGiftSessionToken,
  GIFT_SESSION_COOKIE,
  giftSessionCookieOptions,
  WECOM_STATE_COOKIE,
  weComStateCookieOptions,
} from '@/lib/gift-auth';
import { giftPublicUrl, verifyWeComEmployee, WeComAuthError } from '@/lib/wecom';

export const dynamic = 'force-dynamic';

function redirectWithError(reason: string) {
  const response = NextResponse.redirect(giftPublicUrl(`/gift?auth_error=${reason}`));
  response.cookies.set(WECOM_STATE_COOKIE, '', { ...weComStateCookieOptions(), maxAge: 0 });
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim();
  const state = request.nextUrl.searchParams.get('state')?.trim() ?? '';
  const storedState = request.cookies.get(WECOM_STATE_COOKIE)?.value;

  if (!code || !compareOAuthState(state, storedState)) return redirectWithError('invalid_state');

  try {
    const employee = await verifyWeComEmployee(code);
    const response = NextResponse.redirect(giftPublicUrl('/gift'));
    response.cookies.set(GIFT_SESSION_COOKIE, createGiftSessionToken(employee), giftSessionCookieOptions());
    response.cookies.set(WECOM_STATE_COOKIE, '', { ...weComStateCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof WeComAuthError) {
      console.error(`[gift-auth] WeCom login failed (${error.reason}): ${error.message}`);
      return redirectWithError(error.reason === 'unauthorized' ? 'not_employee' : error.reason);
    }

    console.error('[gift-auth] Unexpected WeCom login failure.', error);
    return redirectWithError('login_failed');
  }
}
