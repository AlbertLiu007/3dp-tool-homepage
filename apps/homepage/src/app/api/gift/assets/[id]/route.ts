import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { canAccessGiftAsset } from '@/lib/gift-library-db';
import { GiftAccessError } from '@/lib/gift-db';
import { getGiftAssetUrl } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee } = await authorizeGiftRequest(request);
    const assetId = Number(context.params.id);
    if (!Number.isInteger(assetId) || !(await canAccessGiftAsset(employee, assetId))) throw new GiftAccessError('Asset was not found.', 404, 'not_found');
    return NextResponse.redirect(await getGiftAssetUrl(assetId, request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline'), 307);
  } catch (error) {
    return giftApiError(error, 'Unable to open gift asset.');
  }
}
