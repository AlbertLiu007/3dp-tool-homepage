import { NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { GiftAiError } from '@/lib/gift-ai';
import { hasGiftAiScenarioConsent, type GiftAiConsentProvider } from '@/lib/gift-ai-consent';
import {
  GiftAccessError,
  canUseGiftGenerativeServices,
  isLocalGiftDevelopmentSession,
  requireGiftEmployeeAccess,
  reserveGiftAiUsage,
  settleGiftAiUsage,
  type GiftAiUsageType,
} from '@/lib/gift-db';
import { logAccessDenied, logApplicationEvent } from '@/lib/server-log';

export async function requireGiftEmployee(options: { approved?: boolean } = {}) {
  const session = getGiftSession();
  if (!session) throw new GiftAiError('Authentication required.', 401, 'authentication');
  const employee = await requireGiftEmployeeAccess(session, { approved: options.approved });
  if (!isLocalGiftDevelopmentSession(session) && !canUseGiftGenerativeServices(employee)) {
    throw new GiftAiError('AI 生成服务备案中，待备案通过再次开放相关生成式服务。', 403, 'approval');
  }
  return session;
}

export function giftAiIdempotencyKey(request: Request) {
  return request.headers.get('Idempotency-Key')?.trim() || undefined;
}

export function requireGiftAiScenarioConsent(request: Request, provider: GiftAiConsentProvider) {
  if (!hasGiftAiScenarioConsent(request.headers, provider)) {
    throw new GiftAiError('This AI operation requires a separate, provider-specific consent.', 400, 'validation');
  }
}

export async function withGiftAiUsage<T>(session: Awaited<ReturnType<typeof requireGiftEmployee>>, usageType: GiftAiUsageType, operation: (reservation: { requestId: string }) => Promise<T>, requestId?: string, metadata?: { provider?: string; model?: string }) {
  const reservation = await reserveGiftAiUsage(session, usageType, requestId, metadata);
  try {
    const result = await operation(reservation);
    await settleGiftAiUsage(reservation.requestId, 'succeeded');
    return result;
  } catch (error) {
    await settleGiftAiUsage(reservation.requestId, 'refunded', error).catch((settleError) => {
      logApplicationEvent({ level: 'error', component: 'background', event: 'task.ai.settlement_failed', result: 'failed', requestId: reservation.requestId, errorCode: 'settlement_failed', details: { error: settleError } });
    });
    throw error;
  }
}
export function giftAiErrorResponse(error: unknown) {
  if (error instanceof GiftAccessError) {
    if (error.status === 401 || error.status === 403 || error.status === 429) logAccessDenied({ component: 'gift', status: error.status, errorCode: error.code });
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof GiftAiError) {
    if (error.status === 401 || error.status === 403 || error.status === 429) logAccessDenied({ component: 'gift', status: error.status, errorCode: error.reason });
    return NextResponse.json(
      { error: error.reason, message: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  logApplicationEvent({ level: 'error', component: 'gift', event: 'gift.ai_request.failed', result: 'failed', errorCode: 'internal', details: { error } });
  return NextResponse.json(
    { error: 'internal', message: 'Unexpected gift AI service error.' },
    { status: 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

export function validateImageFile(value: FormDataEntryValue | null, maxBytes = 8 * 1024 * 1024) {
  if (!(value instanceof File) || value.size === 0) throw new GiftAiError('An image file is required.', 400, 'validation');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type)) throw new GiftAiError('Only JPG, PNG, and WebP images are supported.', 400, 'validation');
  if (value.size > maxBytes) throw new GiftAiError(`Image must not exceed ${Math.floor(maxBytes / 1024 / 1024)}MB.`, 413, 'validation');
  return value;
}
