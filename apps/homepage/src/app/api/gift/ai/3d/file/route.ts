import { GiftAiError, queryWhiteModel } from '@/lib/gift-ai';
import { giftAiErrorResponse, requireGiftEmployee } from '@/lib/gift-ai-route';
import { getOwnedGiftAiJob } from '@/lib/gift-db';
import { ensureServerStl, readServerStl } from '@/lib/model/server-glb-to-stl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get('id')?.trim();
    const requestedType = searchParams.get('type')?.trim().toLowerCase();
    if (!id || id.length > 255) throw new GiftAiError('A valid model job ID is required.', 400, 'validation');
    if (!requestedType || !['stl', 'glb', 'gltf', 'preview'].includes(requestedType)) throw new GiftAiError('Unsupported model asset type.', 400, 'validation');

    const usage = await getOwnedGiftAiJob(session, id);
    const job = await queryWhiteModel(usage.providerJobId);
    if (job.status !== 'completed') throw new GiftAiError('The generated model is not ready.', 409, 'validation');
    if (requestedType === 'stl' && usage.providerJobId.startsWith('tripo:g:')) {
      const sourceModel = job.models.find((item) => item.type.toLowerCase() === 'glb') || job.models.find((item) => item.type.toLowerCase() === 'stl');
      if (!sourceModel?.url) throw new GiftAiError('The generated GLB source is unavailable.', 404, 'validation');
      const artifact = await ensureServerStl(usage.providerJobId, sourceModel.url);
      const bytes = await readServerStl(artifact);
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type': 'model/stl',
          'Content-Length': String(bytes.byteLength),
          'Content-Disposition': 'inline; filename="unionam-gift.stl"',
          'Cache-Control': 'private, max-age=300',
          'X-Content-Type-Options': 'nosniff',
          'X-UnionAM-Triangle-Count': String(artifact.triangleCount),
        },
      });
    }
    const model = requestedType === 'preview'
      ? job.models.find((item) => item.previewImageUrl)
      : job.models.find((item) => item.type.toLowerCase() === requestedType);
    const upstreamUrl = requestedType === 'preview' ? model?.previewImageUrl : model?.url;
    if (!upstreamUrl) throw new GiftAiError('The requested model asset is unavailable.', 404, 'validation');

    const upstream = await fetch(upstreamUrl, { cache: 'no-store' });
    if (!upstream.ok || !upstream.body) throw new GiftAiError('Unable to download the generated model asset.');
    const fallbackContentType = requestedType === 'preview' ? 'image/png' : requestedType === 'stl' ? 'model/stl' : 'model/gltf-binary';
    const headers = new Headers({
      'Content-Type': upstream.headers.get('content-type') || fallbackContentType,
      'Cache-Control': 'private, max-age=300',
      'Content-Disposition': requestedType === 'preview' ? 'inline' : `inline; filename="unionam-gift.${requestedType}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    return new Response(upstream.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
