import { NextResponse } from 'next/server';
import { queryWhiteModel, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, requireGiftEmployee } from '@/lib/gift-ai-route';
import { getOwnedGiftAiJob, settleGiftAiUsage } from '@/lib/gift-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const id = new URL(request.url).searchParams.get('id')?.trim();
    if (!id || id.length > 160) throw new GiftAiError('A valid model job ID is required.', 400, 'validation');
    const usage = await getOwnedGiftAiJob(session, id);
    const job = await queryWhiteModel(id);
    if (job.status === 'completed') await settleGiftAiUsage(usage.requestId, 'succeeded');
    if (job.status === 'failed') await settleGiftAiUsage(usage.requestId, 'refunded', new Error('3D model generation failed.'));
    return NextResponse.json({ job }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
