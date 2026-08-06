import { NextResponse } from 'next/server';
import { queryWhiteModel, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, requireGiftEmployee } from '@/lib/gift-ai-route';
import { getOwnedGiftAiJob, replaceGiftAiProviderJob, requireGiftEmployeeAccess, settleGiftAiUsage } from '@/lib/gift-db';
import { findGiftDraftGeneratedAsset, persistGiftDraftRemoteAsset } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get('id')?.trim();
    const draftRequestId = Number(searchParams.get('draftRequestId'));
    if (!id || id.length > 255) throw new GiftAiError('A valid model job ID is required.', 400, 'validation');
    if (!Number.isInteger(draftRequestId) || draftRequestId <= 0) throw new GiftAiError('A valid draft request ID is required.', 400, 'validation');
    const employee = await requireGiftEmployeeAccess(session, { approved: true });
    const usage = await getOwnedGiftAiJob(session, id);
    let activeId = usage.providerJobId;
    const storedModel = await findGiftDraftGeneratedAsset(employee, draftRequestId, activeId, 'model_file');
    if (usage.status === 'succeeded' && storedModel) {
      const storedPreview = await findGiftDraftGeneratedAsset(employee, draftRequestId, activeId, 'model_preview');
      return NextResponse.json({
        draft: { id: draftRequestId },
        job: { id: activeId, status: 'completed', models: [{ type: storedModel.extension, url: storedModel.url, assetId: storedModel.assetId, previewImageUrl: storedPreview?.url, previewAssetId: storedPreview?.assetId }] },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    let job = await queryWhiteModel(activeId);
    if (job.id !== activeId) {
      const storedId = await replaceGiftAiProviderJob(usage.requestId, activeId, job.id);
      if (storedId !== job.id) job = { id: storedId, status: 'in_progress', models: [] };
      activeId = storedId;
    }
    if (job.status === 'completed') {
      const preferred = job.models.find((model) => model.type.toLowerCase() === 'stl') || job.models[0];
      if (!preferred?.url) throw new GiftAiError('The completed model does not contain a downloadable file.');
      const extension = preferred.type.toLowerCase();
      if (!['stl', 'glb', 'gltf'].includes(extension)) throw new GiftAiError('The completed model format is not supported.', 502, 'validation');
      const modelAsset = await persistGiftDraftRemoteAsset({
        actor: employee,
        requestId: draftRequestId,
        kind: 'model_file',
        sourceUrl: preferred.url,
        filename: `unionam-ai-gift.${extension}`,
        contentType: extension === 'stl' ? 'model/stl' : extension === 'gltf' ? 'model/gltf+json' : 'model/gltf-binary',
        providerJobId: activeId,
        metadata: { source: 'ai', stage: 'image_to_3d', usageRequestId: usage.requestId },
      });
      const previewAsset = preferred.previewImageUrl ? await persistGiftDraftRemoteAsset({
        actor: employee,
        requestId: draftRequestId,
        kind: 'model_preview',
        sourceUrl: preferred.previewImageUrl,
        filename: 'unionam-ai-gift-preview.png',
        contentType: 'image/png',
        providerJobId: activeId,
        metadata: { source: 'ai', stage: 'image_to_3d_preview', usageRequestId: usage.requestId },
      }) : null;
      await settleGiftAiUsage(usage.requestId, 'succeeded');
      job = {
        ...job,
        models: [{ type: extension, url: modelAsset.url, previewImageUrl: previewAsset?.url }],
      };
      return NextResponse.json({
        draft: { id: draftRequestId },
        job: { ...job, models: job.models.map((model) => ({ ...model, assetId: modelAsset.assetId, previewAssetId: previewAsset?.assetId })) },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (job.status === 'failed') await settleGiftAiUsage(usage.requestId, 'refunded', new Error('3D model generation failed.'));
    return NextResponse.json({ draft: { id: draftRequestId }, job }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
