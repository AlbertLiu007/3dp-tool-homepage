import { NextResponse } from 'next/server';
import { queryWhiteModel, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, requireGiftEmployee } from '@/lib/gift-ai-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    requireGiftEmployee();
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id || id.length > 160) throw new GiftAiError('A valid model job ID is required.', 400, 'validation');
    const job = await queryWhiteModel(id);
    return NextResponse.json({ job }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
