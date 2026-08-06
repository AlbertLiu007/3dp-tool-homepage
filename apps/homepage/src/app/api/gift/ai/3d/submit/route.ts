import { NextResponse } from 'next/server';
import { GiftAiError, submitWhiteModel, TRIPO_3D_MODEL } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, validateImageFile } from '@/lib/gift-ai-route';
import { markGiftAiUsageRunning, requireGiftEmployeeAccess, reserveGiftAiUsage, settleGiftAiUsage } from '@/lib/gift-db';
import { ensureGiftAiDraft } from '@/lib/gift-library-db';
import { assertGiftDraftAsset, persistGiftDraftFileAsset } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const formData = await request.formData();
    const image = validateImageFile(formData.get('image'), 5 * 1024 * 1024);
    const employee = await requireGiftEmployeeAccess(session, { approved: true });
    const draft = await ensureGiftAiDraft(session, {
      draftRequestId: formData.get('draftRequestId'),
      title: formData.get('draftTitle'),
      businessScene: formData.get('businessScene'),
      finishType: formData.get('finishType'),
      paintColor: formData.get('paintColor'),
      requestNotes: formData.get('brief'),
    });
    const reservation = await reserveGiftAiUsage(session, 'image_to_3d', giftAiIdempotencyKey(request), { provider: 'tripo3d', model: TRIPO_3D_MODEL });
    let job: Awaited<ReturnType<typeof submitWhiteModel>>;
    let sourceAssetId = 0;
    try {
      const sourceAssetValue = formData.get('sourceAssetId');
      const requestedSourceAssetId = typeof sourceAssetValue === 'string' && sourceAssetValue ? Number(sourceAssetValue) : null;
      if (requestedSourceAssetId !== null && (!Number.isInteger(requestedSourceAssetId) || requestedSourceAssetId <= 0)) {
        throw new GiftAiError('Source asset ID is invalid.', 400, 'validation');
      }
      const sourceAsset = requestedSourceAssetId
        ? await assertGiftDraftAsset(employee, draft.id, requestedSourceAssetId)
        : await persistGiftDraftFileAsset({
          actor: employee, requestId: draft.id, kind: 'reference_image', file: image,
          metadata: { source: 'user', stage: 'image_to_3d_input', usageRequestId: reservation.requestId },
        });
      sourceAssetId = sourceAsset.assetId;
      job = await submitWhiteModel(image);
      await markGiftAiUsageRunning(reservation.requestId, job.id);
    } catch (error) {
      await settleGiftAiUsage(reservation.requestId, 'refunded', error).catch((settleError) => {
        console.error('Unable to refund failed 3D generation usage:', settleError);
      });
      throw error;
    }
    return NextResponse.json({ draft, sourceAssetId, job }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
