import { NextResponse } from 'next/server';
import { generateGiftImages, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, requireGiftEmployee } from '@/lib/gift-ai-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    requireGiftEmployee();
    const body = await request.json() as { prompt?: unknown };
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) throw new GiftAiError('Prompt must contain 1 to 4000 characters.', 400, 'validation');
    const images = await generateGiftImages(prompt, 3);
    return NextResponse.json({ images }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
