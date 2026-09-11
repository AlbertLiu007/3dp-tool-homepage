import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { canAccessGiftAsset } from '@/lib/gift-library-db';
import { GiftAccessError } from '@/lib/gift-db';
import { getGiftAssetStream, type GiftImageVariant } from '@/lib/gift-oss';
import { LOG_EVENTS } from '@/lib/application-log';
import { logApplicationEvent } from '@/lib/server-log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee } = await authorizeGiftRequest(request);
    const assetId = Number(context.params.id);
    if (!Number.isInteger(assetId) || !(await canAccessGiftAsset(employee, assetId))) throw new GiftAccessError('Asset was not found.', 404, 'not_found');
    const download = request.nextUrl.searchParams.get('download') === '1';
    const requestedVariant = request.nextUrl.searchParams.get('variant');
    const variant: GiftImageVariant = ['thumb', 'card', 'large', 'original'].includes(requestedVariant || '')
      ? requestedVariant as GiftImageVariant
      : 'card';
    const asset = await getGiftAssetStream(assetId, download ? 'attachment' : 'inline', variant);
    logApplicationEvent({ component: 'gift', event: LOG_EVENTS.ossAssetRead, result: download ? 'downloaded' : 'read', details: { employee_id: employee.id, asset_id: assetId, disposition: download ? 'attachment' : 'inline', variant } });
    const responseHeaders = new Headers();
    const upstreamHeaders = asset.responseHeaders as Record<string, string | string[] | undefined>;
    const upstreamContentType = upstreamHeaders['content-type'];
    const upstreamContentLength = upstreamHeaders['content-length'];
    responseHeaders.set('Content-Type', typeof upstreamContentType === 'string' ? upstreamContentType : asset.contentType);
    if (typeof upstreamContentLength === 'string') responseHeaders.set('Content-Length', upstreamContentLength);
    responseHeaders.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(asset.originalFilename)}`);
    responseHeaders.set('Cache-Control', download ? 'private, no-store' : 'private, max-age=300, must-revalidate');
    return new NextResponse(Readable.toWeb(asset.stream) as unknown as BodyInit, { headers: responseHeaders });
  } catch (error) {
    return giftApiError(error, 'Unable to open gift asset.');
  }
}
