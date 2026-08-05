import { NextResponse } from 'next/server';
import { generateGiftImages, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, withGiftAiUsage } from '@/lib/gift-ai-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const body = await request.json() as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) throw new GiftAiError('Prompt must contain 1 to 4000 characters.', 400, 'validation');
    const images = await withGiftAiUsage(session, 'render', () => generateGiftImages(prompt, 3), giftAiIdempotencyKey(request), { provider: 'krill-ai', model: process.env.GPT_IMAGE_MODEL || 'wan2.7-image-pro' });
    return NextResponse.json({ images }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
