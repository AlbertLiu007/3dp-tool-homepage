import { NextRequest, NextResponse } from 'next/server';
import { getGiftOpsAssetUrl } from '@/lib/gift-oss';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    await authorizeGiftOpsRequest(request);
    return NextResponse.redirect(await getGiftOpsAssetUrl(Number(context.params.id)));
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to open model asset.');
  }
}
