import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

export const GIFT_SESSION_COOKIE = 'unionam.gift.session';
export const WECOM_STATE_COOKIE = 'unionam.gift.wecom.state';

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type GiftSession = {
  userId: string;
  name: string;
  departments: number[];
  corpId: string;
  issuedAt: number;
  expiresAt: number;
};

type NewGiftSession = Pick<GiftSession, 'userId' | 'name' | 'departments' | 'corpId'>;

function getSessionSecret() {
  const configuredSecret = process.env.GIFT_SESSION_SECRET;

  if (configuredSecret && configuredSecret.length >= 32) return configuredSecret;
  if (process.env.NODE_ENV !== 'production') return 'unionam-gift-local-development-secret-2026';

  throw new Error('GIFT_SESSION_SECRET must be configured with at least 32 characters.');
}

function sign(value: string) {
  return createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isGiftSession(value: unknown): value is GiftSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<GiftSession>;

  return (
    typeof session.userId === 'string' &&
    session.userId.length > 0 &&
    typeof session.name === 'string' &&
    Array.isArray(session.departments) &&
    session.departments.every((department) => Number.isInteger(department)) &&
    typeof session.corpId === 'string' &&
    typeof session.issuedAt === 'number' &&
    typeof session.expiresAt === 'number'
  );
}

export function createGiftSessionToken(user: NewGiftSession) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: GiftSession = {
    ...user,
    issuedAt,
    expiresAt: issuedAt + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyGiftSessionToken(token: string | undefined) {
  if (!token) return null;

  const [encodedPayload, signature, extraPart] = token.split('.');
  if (!encodedPayload || !signature || extraPart || !safeEqual(signature, sign(encodedPayload))) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as unknown;
    if (!isGiftSession(payload)) return null;
    if (payload.expiresAt <= Math.floor(Date.now() / 1000)) return null;

    const configuredCorpId = process.env.WECOM_CORP_ID;
    if (configuredCorpId && payload.corpId !== configuredCorpId) return null;

    return payload;
  } catch {
    return null;
  }
}

export function getGiftSession() {
  return verifyGiftSessionToken(cookies().get(GIFT_SESSION_COOKIE)?.value);
}

export function giftSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function weComStateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/api/gift/auth/wecom',
    maxAge: 10 * 60,
  };
}

export function compareOAuthState(receivedState: string, storedState: string | undefined) {
  if (!storedState) return false;
  return safeEqual(receivedState, storedState);
}
