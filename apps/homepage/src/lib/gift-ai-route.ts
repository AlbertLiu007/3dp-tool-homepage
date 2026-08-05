import { NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';
import { GiftAiError } from '@/lib/gift-ai';

export function requireGiftEmployee() {
  const session = getGiftSession();
  if (!session) throw new GiftAiError('Authentication required.', 401, 'validation');
  return session;
}
export function giftAiErrorResponse(error: unknown) {
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
