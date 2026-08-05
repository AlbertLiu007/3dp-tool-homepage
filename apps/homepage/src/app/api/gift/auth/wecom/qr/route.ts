import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { WECOM_STATE_COOKIE, weComStateCookieOptions } from '@/lib/gift-auth';
import { getWeComConfiguration, WeComAuthError } from '@/lib/wecom';

export const dynamic = 'force-dynamic';

export function GET(request: NextRequest) {
  try {
    const state = randomBytes(32).toString('base64url');
    const requestedLanguage = request.nextUrl.searchParams.get('lang');
    const language = requestedLanguage === 'en' ? 'en' : 'zh';
    const { corpId, agentId, callbackUrl } = getWeComConfiguration();
    const response = NextResponse.json(
      { appId: corpId, agentId, redirectUri: callbackUrl, state, language },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );

    response.cookies.set(WECOM_STATE_COOKIE, state, weComStateCookieOptions());
    return response;
  } catch (error) {
    const reason = error instanceof WeComAuthError && error.reason === 'configuration'
      ? 'configuration'
      : 'login_failed';
    return NextResponse.json({ error: reason }, { status: 503 });
  }
}
