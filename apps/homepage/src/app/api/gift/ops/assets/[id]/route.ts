import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import { getGiftAssetStream, type GiftImageVariant } from '@/lib/gift-oss';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    await authorizeGiftOpsRequest(request);
    const requestedVariant = request.nextUrl.searchParams.get('variant');
    const variant: GiftImageVariant = ['thumb', 'card', 'large', 'original'].includes(requestedVariant || '')
      ? requestedVariant as GiftImageVariant
      : 'card';
    const asset = await getGiftAssetStream(Number(context.params.id), 'inline', variant);
    const responseHeaders = new Headers();
    const upstreamHeaders = asset.responseHeaders as Record<string, string | string[] | undefined>;
    const upstreamContentType = upstreamHeaders['content-type'];
    const upstreamContentLength = upstreamHeaders['content-length'];
    responseHeaders.set('Content-Type', typeof upstreamContentType === 'string' ? upstreamContentType : asset.contentType);
    if (typeof upstreamContentLength === 'string') responseHeaders.set('Content-Length', upstreamContentLength);
    responseHeaders.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(asset.originalFilename)}`);
    responseHeaders.set('Cache-Control', 'private, max-age=300, must-revalidate');
    return new NextResponse(Readable.toWeb(asset.stream) as unknown as BodyInit, { headers: responseHeaders });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to open model asset.');
  }
}
