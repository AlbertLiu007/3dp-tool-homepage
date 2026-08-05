import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';
import { updateGiftOpsCategory } from '@/lib/gift-ops-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    await updateGiftOpsCategory(employee, Number(context.params.id), await request.json() as Record<string, unknown>, requestIp);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to update model category.');
  }
}
