import { NextRequest, NextResponse } from 'next/server';
import {
  compareOAuthState,
  createGiftSessionToken,
  GIFT_SESSION_COOKIE,
  giftSessionCookieOptions,
  WECOM_RETURN_COOKIE,
  WECOM_STATE_COOKIE,
  weComReturnCookieOptions,
  weComStateCookieOptions,
} from '@/lib/gift-auth';
import { registerVerifiedGiftEmployee } from '@/lib/gift-db';
import { giftPublicUrl, verifyWeComEmployee, WeComAuthError } from '@/lib/wecom';
import { LOG_EVENTS } from '@/lib/application-log';
import { logApplicationEvent } from '@/lib/server-log';

export const dynamic = 'force-dynamic';

function redirectWithError(reason: string) {
  const response = NextResponse.redirect(giftPublicUrl(`/gift?auth_error=${reason}`));
  response.cookies.set(WECOM_STATE_COOKIE, '', { ...weComStateCookieOptions(), maxAge: 0 });
  return response;
}

function successfulRedirect(returnTarget: string | undefined) {
  if (returnTarget === 'ops') {
    const opsOrigin = process.env.GIFT_OPS_ORIGIN?.trim() || 'https://ops.unionam.com';
    return new URL('/', opsOrigin);
  }
  return giftPublicUrl('/gift');
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const code = request.nextUrl.searchParams.get('code')?.trim();
  const state = request.nextUrl.searchParams.get('state')?.trim() ?? '';
  const storedState = request.cookies.get(WECOM_STATE_COOKIE)?.value;
  const returnTarget = request.cookies.get(WECOM_RETURN_COOKIE)?.value;

  if (!code || !compareOAuthState(state, storedState)) {
    logApplicationEvent({ level: 'warn', component: 'gift', event: LOG_EVENTS.weComLoginFailed, result: 'failed', durationMs: Date.now() - startedAt, errorCode: 'invalid_state' });
    return redirectWithError('invalid_state');
  }

  try {
    const employee = await verifyWeComEmployee(code);
    await registerVerifiedGiftEmployee(employee);
    const response = NextResponse.redirect(successfulRedirect(returnTarget));
    response.cookies.set(GIFT_SESSION_COOKIE, createGiftSessionToken(employee), giftSessionCookieOptions());
    response.cookies.set(WECOM_STATE_COOKIE, '', { ...weComStateCookieOptions(), maxAge: 0 });
    response.cookies.set(WECOM_RETURN_COOKIE, '', { ...weComReturnCookieOptions(), maxAge: 0 });
    logApplicationEvent({ component: 'gift', event: LOG_EVENTS.weComLoginSucceeded, result: 'succeeded', durationMs: Date.now() - startedAt });
    return response;
  } catch (error) {
    if (error instanceof WeComAuthError) {
      logApplicationEvent({ level: 'warn', component: 'gift', event: LOG_EVENTS.weComLoginFailed, result: 'failed', durationMs: Date.now() - startedAt, errorCode: error.reason, details: { error } });
      return redirectWithError(error.reason === 'unauthorized' ? 'not_employee' : error.reason);
    }

    logApplicationEvent({ level: 'error', component: 'gift', event: LOG_EVENTS.weComLoginFailed, result: 'failed', durationMs: Date.now() - startedAt, errorCode: 'login_failed', details: { error } });
    return redirectWithError('login_failed');
  }
}
