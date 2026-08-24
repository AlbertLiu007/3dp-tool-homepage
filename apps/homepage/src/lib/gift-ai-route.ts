import { NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { GiftAiError } from '@/lib/gift-ai';
import {
  GiftAccessError,
  canUseGiftGenerativeServices,
  isLocalGiftDevelopmentSession,
  requireGiftEmployeeAccess,
  reserveGiftAiUsage,
  settleGiftAiUsage,
  type GiftAiUsageType,
} from '@/lib/gift-db';

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

export async function withGiftAiUsage<T>(session: Awaited<ReturnType<typeof requireGiftEmployee>>, usageType: GiftAiUsageType, operation: (reservation: { requestId: string }) => Promise<T>, requestId?: string, metadata?: { provider?: string; model?: string }) {
  const reservation = await reserveGiftAiUsage(session, usageType, requestId, metadata);
  try {
    const result = await operation(reservation);
    await settleGiftAiUsage(reservation.requestId, 'succeeded');
    return result;
  } catch (error) {
    await settleGiftAiUsage(reservation.requestId, 'refunded', error).catch((settleError) => {
      console.error('Unable to refund failed gift AI usage:', settleError);
    });
    throw error;
  }
}
export function giftAiErrorResponse(error: unknown) {
  if (error instanceof GiftAccessError) {
    return NextResponse.json(
      { error: error.code, message: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (error instanceof GiftAiError) {
    return NextResponse.json(
      { error: error.reason, message: error.message },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  console.error('Unexpected gift AI error:', error);
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
