import { NextResponse } from 'next/server';
import { editGiftImage, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, validateImageFile, withGiftAiUsage } from '@/lib/gift-ai-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const formData = await request.formData();
    const image = validateImageFile(formData.get('image'), 10 * 1024 * 1024);
    const maskEntry = formData.get('mask');
    const mask = maskEntry ? validateImageFile(maskEntry, 10 * 1024 * 1024) : undefined;
    const promptValue = formData.get('prompt');
    const prompt = typeof promptValue === 'string' ? promptValue.trim() : '';
    if (!prompt || prompt.length > 4000) throw new GiftAiError('Edit prompt must contain 1 to 4000 characters.', 400, 'validation');
    const imageResult = await withGiftAiUsage(session, 'image_edit', () => editGiftImage({ image, mask, prompt }), giftAiIdempotencyKey(request), { provider: 'krill-ai', model: process.env.GPT_IMAGE_MODEL || 'wan2.7-image-pro' });
    return NextResponse.json({ image: imageResult }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
