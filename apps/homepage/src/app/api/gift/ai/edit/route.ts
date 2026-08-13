import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { configuredImageEditModel, configuredImageFallbackModel, editGiftImage, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, validateImageFile, withGiftAiUsage } from '@/lib/gift-ai-route';
import { isLocalGiftDevelopmentSession, requireGiftEmployeeAccess, updateGiftAiUsageModel } from '@/lib/gift-db';
import { ensureGiftAiDraft } from '@/lib/gift-library-db';
import { assertGiftDraftAsset, findGiftDraftImageByTransformationCacheKey, persistGiftDraftFileAsset, persistGiftDraftGeneratedImage } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function transformationCacheKey(input: {
  image: File;
  mask?: File;
  prompt: string;
  monochromeColor?: string;
  stage: string;
}) {
  const imageHash = createHash('sha256').update(Buffer.from(await input.image.arrayBuffer())).digest('hex');
  const maskHash = input.mask
    ? createHash('sha256').update(Buffer.from(await input.mask.arrayBuffer())).digest('hex')
    : null;
  return createHash('sha256').update(JSON.stringify({
    version: 'gift-white-edit-v3',
    imageHash,
    maskHash,
    prompt: input.prompt,
    monochromeColor: input.monochromeColor || null,
    stage: input.stage,
    primaryModel: configuredImageEditModel(),
    fallbackModel: configuredImageFallbackModel(),
    background: 'white',
  })).digest('hex');
}

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const formData = await request.formData();
    const image = validateImageFile(formData.get('image'), 10 * 1024 * 1024);
    const maskEntry = formData.get('mask');
    const mask = maskEntry ? validateImageFile(maskEntry, 10 * 1024 * 1024) : undefined;
    const promptValue = formData.get('prompt');
    const prompt = typeof promptValue === 'string' ? promptValue.trim() : '';
    if (!prompt || prompt.length > 4000) throw new GiftAiError('Edit prompt must contain 1 to 4000 characters.', 400, 'validation');
    const monochromeValue = formData.get('monochromeColor');
    const monochromeColor = typeof monochromeValue === 'string' && monochromeValue.trim() ? monochromeValue.trim().toUpperCase() : undefined;
    if (monochromeColor && !/^#[0-9A-F]{6}$/.test(monochromeColor)) throw new GiftAiError('Monochrome paint color must be a six-digit HEX value.', 400, 'validation');
    if (isLocalGiftDevelopmentSession(session)) {
      const draftRequestId = Number(formData.get('draftRequestId'));
      const generated = await withGiftAiUsage(
        session,
        'image_edit',
        ({ requestId }) => editGiftImage({ image, mask, prompt, monochromeColor, whiteBackground: true }, { requestId, stage: 'image_edit' }),
        giftAiIdempotencyKey(request),
        { provider: 'krill-ai', model: configuredImageEditModel() },
      );
      return NextResponse.json({
        draft: { id: Number.isInteger(draftRequestId) && draftRequestId > 0 ? draftRequestId : 1 },
        image: { ...generated, assetId: 1 },
        sourceAssetId: 1,
        maskAssetId: mask ? 2 : null,
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const employee = await requireGiftEmployeeAccess(session, { approved: true });
    const draft = await ensureGiftAiDraft(session, {
      draftRequestId: formData.get('draftRequestId'),
      title: formData.get('draftTitle'),
      businessScene: formData.get('businessScene'),
      finishType: formData.get('finishType'),
      paintColor: formData.get('paintColor'),
      requestNotes: formData.get('brief'),
    });
    const sourceAssetValue = formData.get('sourceAssetId');
    const requestedSourceAssetId = typeof sourceAssetValue === 'string' && sourceAssetValue ? Number(sourceAssetValue) : null;
    if (requestedSourceAssetId !== null && (!Number.isInteger(requestedSourceAssetId) || requestedSourceAssetId <= 0)) {
      throw new GiftAiError('Source asset ID is invalid.', 400, 'validation');
    }
    const stageValue = formData.get('stage');
    const stage = typeof stageValue === 'string' && stageValue.trim() ? stageValue.trim().slice(0, 64) : 'image_edit';
    const sourceAsset = requestedSourceAssetId
      ? await assertGiftDraftAsset(employee, draft.id, requestedSourceAssetId)
      : await persistGiftDraftFileAsset({
        actor: employee, requestId: draft.id, kind: 'reference_image', file: image,
        metadata: { source: 'user', stage: `${stage}_input` },
      });
    const maskAsset = mask ? await persistGiftDraftFileAsset({
      actor: employee, requestId: draft.id, kind: 'edit_mask', file: mask,
      metadata: { source: 'user', stage: `${stage}_mask` },
    }) : null;
    const cacheKey = await transformationCacheKey({ image, mask, prompt, monochromeColor, stage });
    const cached = await findGiftDraftImageByTransformationCacheKey(employee, draft.id, cacheKey);
    if (cached) {
      return NextResponse.json({
        draft,
        image: { assetId: cached.assetId, url: cached.url, cacheHit: true },
        sourceAssetId: sourceAsset.assetId,
        maskAssetId: maskAsset?.assetId || null,
      }, { headers: { 'Cache-Control': 'no-store', 'X-UnionAM-AI-Cache': 'HIT' } });
    }
    const result = await withGiftAiUsage(session, 'image_edit', async ({ requestId }) => {
      const generated = await editGiftImage(
        { image, mask, prompt, monochromeColor, whiteBackground: true },
        { requestId, stage },
      );
      await updateGiftAiUsageModel(requestId, generated.model || configuredImageEditModel());
      const output = await persistGiftDraftGeneratedImage({
        actor: employee, requestId: draft.id, image: generated, filename: `${stage}.png`,
        metadata: { source: 'ai', stage, usageRequestId: requestId, sourceAssetId: sourceAsset.assetId, maskAssetId: maskAsset?.assetId || null, transformationCacheKey: cacheKey },
      });
      return { image: output, sourceAssetId: sourceAsset.assetId, maskAssetId: maskAsset?.assetId || null };
    }, giftAiIdempotencyKey(request), { provider: 'krill-ai', model: configuredImageEditModel() });
    return NextResponse.json({ draft, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
