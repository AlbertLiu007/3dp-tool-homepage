import { NextResponse } from 'next/server';
import { editGiftImage, GiftAiError, IMAGE_EDIT_MODEL } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, validateImageFile, withGiftAiUsage } from '@/lib/gift-ai-route';
import { isLocalGiftDevelopmentSession, requireGiftEmployeeAccess, updateGiftAiUsageModel } from '@/lib/gift-db';
import { ensureGiftAiDraft } from '@/lib/gift-library-db';
import { assertGiftDraftAsset, persistGiftDraftFileAsset, persistGiftDraftGeneratedImage } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
    if (isLocalGiftDevelopmentSession(session)) {
      const draftRequestId = Number(formData.get('draftRequestId'));
      const generated = await withGiftAiUsage(
        session,
        'image_edit',
        () => editGiftImage({ image, mask, prompt }),
        giftAiIdempotencyKey(request),
        { provider: 'krill-ai', model: IMAGE_EDIT_MODEL },
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
    const result = await withGiftAiUsage(session, 'image_edit', async ({ requestId }) => {
      const sourceAsset = requestedSourceAssetId
        ? await assertGiftDraftAsset(employee, draft.id, requestedSourceAssetId)
        : await persistGiftDraftFileAsset({
          actor: employee, requestId: draft.id, kind: 'reference_image', file: image,
          metadata: { source: 'user', stage: `${stage}_input`, usageRequestId: requestId },
        });
      const maskAsset = mask ? await persistGiftDraftFileAsset({
        actor: employee, requestId: draft.id, kind: 'edit_mask', file: mask,
        metadata: { source: 'user', stage: `${stage}_mask`, usageRequestId: requestId },
      }) : null;
      const generated = await editGiftImage({ image, mask, prompt });
      await updateGiftAiUsageModel(requestId, generated.model || IMAGE_EDIT_MODEL);
      const output = await persistGiftDraftGeneratedImage({
        actor: employee, requestId: draft.id, image: generated, filename: `${stage}.png`,
        metadata: { source: 'ai', stage, usageRequestId: requestId, sourceAssetId: sourceAsset.assetId, maskAssetId: maskAsset?.assetId || null },
      });
      return { image: output, sourceAssetId: sourceAsset.assetId, maskAssetId: maskAsset?.assetId || null };
    }, giftAiIdempotencyKey(request), { provider: 'krill-ai', model: IMAGE_EDIT_MODEL });
    return NextResponse.json({ draft, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
