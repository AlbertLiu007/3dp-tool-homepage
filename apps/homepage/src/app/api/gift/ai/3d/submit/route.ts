import { NextResponse } from 'next/server';
import { submitWhiteModel } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, validateImageFile } from '@/lib/gift-ai-route';
import { markGiftAiUsageRunning, reserveGiftAiUsage, settleGiftAiUsage } from '@/lib/gift-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const formData = await request.formData();
    const image = validateImageFile(formData.get('image'), 5 * 1024 * 1024);
    const reservation = await reserveGiftAiUsage(session, 'image_to_3d', giftAiIdempotencyKey(request), { provider: 'tencent-hunyuan', model: process.env.HUNYUAN_3D_MODEL || 'hy-3d-3.1' });
    let job: Awaited<ReturnType<typeof submitWhiteModel>>;
    try {
      job = await submitWhiteModel(image);
      await markGiftAiUsageRunning(reservation.requestId, job.id);
    } catch (error) {
      await settleGiftAiUsage(reservation.requestId, 'refunded', error).catch((settleError) => {
        console.error('Unable to refund failed 3D generation usage:', settleError);
      });
      throw error;
    }
    return NextResponse.json({ job }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
