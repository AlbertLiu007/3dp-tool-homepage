import { NextRequest, NextResponse } from 'next/server';
import { updateGiftOpsModel } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    await updateGiftOpsModel(employee, Number(context.params.id), await request.json() as Record<string, unknown>, requestIp);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to update model.');
  }
}
