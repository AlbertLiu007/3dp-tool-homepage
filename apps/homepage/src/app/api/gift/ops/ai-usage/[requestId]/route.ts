import { NextRequest, NextResponse } from 'next/server';
import { refundGiftOpsAiUsage } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, context: { params: { requestId: string } }) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    const body = await request.json() as { action?: unknown; note?: unknown };
    if (body.action !== 'release') return NextResponse.json({ error: 'validation' }, { status: 400 });
    await refundGiftOpsAiUsage(employee, context.params.requestId, typeof body.note === 'string' ? body.note : '', requestIp);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to release AI usage.');
  }
}
