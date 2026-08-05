import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';
import { deleteGiftOpsModelAsset } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(request: NextRequest, context: { params: { id: string; assetId: string } }) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    await deleteGiftOpsModelAsset(employee, Number(context.params.id), Number(context.params.assetId), requestIp);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to delete model asset.');
  }
}
