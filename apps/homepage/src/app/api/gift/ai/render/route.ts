import { NextResponse } from 'next/server';
import { generateGiftImages, GiftAiError, IMAGE_GENERATION_MODEL } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, withGiftAiUsage } from '@/lib/gift-ai-route';
import { isLocalGiftDevelopmentSession, requireGiftEmployeeAccess, reserveGiftAiUsage, settleGiftAiUsage, updateGiftAiUsageModel } from '@/lib/gift-db';
import { ensureGiftAiDraft } from '@/lib/gift-library-db';
import { persistGiftDraftGeneratedImage } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StreamImageMessage = { type: 'image'; index: number; image: Awaited<ReturnType<typeof generateGiftImages>>[number]; draft: { id: number } };

function streamResponse(run: (send: (message: unknown) => void) => Promise<void>) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(message)}\n`));
      void run(send).catch((error) => {
        send({ type: 'error', error: error instanceof GiftAiError ? error.reason : 'internal', message: error instanceof Error ? error.message : 'Unexpected gift AI service error.' });
      }).finally(() => controller.close());
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const body = await request.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) throw new GiftAiError('Prompt must contain 1 to 4000 characters.', 400, 'validation');
    if (body.stream === true) {
      const local = isLocalGiftDevelopmentSession(session);
      const employee = local ? null : await requireGiftEmployeeAccess(session, { approved: true });
      const requestedDraftId = Number(body.draftRequestId);
      const draft = local
        ? { id: Number.isInteger(requestedDraftId) && requestedDraftId > 0 ? requestedDraftId : 1 }
        : await ensureGiftAiDraft(session, {
          draftRequestId: body.draftRequestId,
          title: body.draftTitle,
          businessScene: body.businessScene,
          finishType: body.finishType,
          paintColor: body.paintColor,
          requestNotes: body.brief,
          specifications: body.specifications,
        });
      const reservation = await reserveGiftAiUsage(session, 'render', giftAiIdempotencyKey(request), { provider: 'krill-ai', model: IMAGE_GENERATION_MODEL });
      return streamResponse(async (send) => {
        const startedAt = Date.now();
        const tasks = new Map<number, Promise<{ index: number; image?: StreamImageMessage['image']; error?: string }>>();
        for (let index = 0; index < 3; index += 1) {
          tasks.set(index, generateGiftImages(prompt, 1).then(async (generated) => {
            const image = generated[0];
            if (!image) throw new GiftAiError('Image provider did not return an image.');
            await updateGiftAiUsageModel(reservation.requestId, image.model || IMAGE_GENERATION_MODEL);
            const saved = local
              ? { ...image, assetId: index + 1 }
              : await persistGiftDraftGeneratedImage({ actor: employee!, requestId: draft.id, image, filename: `gift-render-${index + 1}.png`, metadata: { source: 'ai', stage: 'render', sequence: index + 1, usageRequestId: reservation.requestId } });
            return { index, image: saved };
          }).catch((error) => ({ index, error: error instanceof Error ? error.message : 'This concept failed to generate.' })));
        }
        let readyCount = 0;
        try {
          while (tasks.size > 0) {
            const result = await Promise.race(tasks.values());
            tasks.delete(result.index);
            if (result.image) {
              readyCount += 1;
              send({ type: 'image', index: result.index, image: result.image, draft });
            } else {
              send({ type: 'slot-error', index: result.index, message: result.error || 'This concept failed to generate.' });
            }
          }
          if (readyCount > 0) await settleGiftAiUsage(reservation.requestId, 'succeeded');
          else await settleGiftAiUsage(reservation.requestId, 'refunded', new GiftAiError('All gift concepts failed to generate.'));
          send({ type: 'done', draft, elapsedMs: Date.now() - startedAt });
        } catch (error) {
          await settleGiftAiUsage(reservation.requestId, 'refunded', error).catch((settleError) => console.error('Unable to refund failed gift AI usage:', settleError));
          throw error;
        }
      });
    }
    if (isLocalGiftDevelopmentSession(session)) {
      const requestedDraftId = Number(body.draftRequestId);
      const generated = await withGiftAiUsage(
        session,
        'render',
        () => generateGiftImages(prompt, 3),
        giftAiIdempotencyKey(request),
        { provider: 'krill-ai', model: IMAGE_GENERATION_MODEL },
      );
      return NextResponse.json({
        draft: { id: Number.isInteger(requestedDraftId) && requestedDraftId > 0 ? requestedDraftId : 1 },
        images: generated.map((image, index) => ({ ...image, assetId: index + 1 })),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const employee = await requireGiftEmployeeAccess(session, { approved: true });
    const draft = await ensureGiftAiDraft(session, {
      draftRequestId: body.draftRequestId,
      title: body.draftTitle,
      businessScene: body.businessScene,
      finishType: body.finishType,
      paintColor: body.paintColor,
      requestNotes: body.brief,
      specifications: body.specifications,
    });
    const images = await withGiftAiUsage(session, 'render', async ({ requestId }) => {
      const generated = await generateGiftImages(prompt, 3);
      await updateGiftAiUsageModel(requestId, generated.find((image) => image.model)?.model || IMAGE_GENERATION_MODEL);
      return Promise.all(generated.map((image, index) => persistGiftDraftGeneratedImage({
        actor: employee,
        requestId: draft.id,
        image,
        filename: `gift-render-${index + 1}.png`,
        metadata: { source: 'ai', stage: 'render', sequence: index + 1, usageRequestId: requestId },
      })));
    }, giftAiIdempotencyKey(request), { provider: 'krill-ai', model: IMAGE_GENERATION_MODEL });
    return NextResponse.json({ draft, images }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
