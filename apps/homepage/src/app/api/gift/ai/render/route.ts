import { NextResponse } from 'next/server';
import { configuredImageGenerationModel, generateGiftImages, GiftAiError, publicGiftImageError } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, withGiftAiUsage } from '@/lib/gift-ai-route';
import { isLocalGiftDevelopmentSession, markGiftAiUsageRunning, requireGiftEmployeeAccess, reserveGiftAiUsage, settleGiftAiUsage, updateGiftAiUsageModel } from '@/lib/gift-db';
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
        const publicError = publicGiftImageError(error);
        send({ type: 'error', error: publicError.code, message: publicError.message });
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
    const monochromeColor = typeof body.monochromeColor === 'string' && body.monochromeColor.trim()
      ? body.monochromeColor.trim().toUpperCase()
      : undefined;
    if (monochromeColor && !/^#[0-9A-F]{6}$/.test(monochromeColor)) throw new GiftAiError('Monochrome paint color must be a six-digit HEX value.', 400, 'validation');
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
      const configuredModel = configuredImageGenerationModel();
      const reservation = await reserveGiftAiUsage(session, 'render', giftAiIdempotencyKey(request), { provider: 'krill-ai', model: configuredModel });
      return streamResponse(async (send) => {
        const startedAt = Date.now();
        const tasks = new Map<number, Promise<{ index: number; image?: StreamImageMessage['image']; error?: ReturnType<typeof publicGiftImageError> }>>();
        for (let index = 0; index < 3; index += 1) {
          tasks.set(index, generateGiftImages(prompt, 1, monochromeColor, { requestId: reservation.requestId, stage: 'render', slot: index }).then(async (generated) => {
            const image = generated[0];
            if (!image) throw new GiftAiError('Image provider did not return an image.');
            await updateGiftAiUsageModel(reservation.requestId, image.model || configuredModel);
            if (image.providerJobId) await markGiftAiUsageRunning(reservation.requestId, image.providerJobId);
            const saved = local
              ? { ...image, assetId: index + 1 }
              : await persistGiftDraftGeneratedImage({ actor: employee!, requestId: draft.id, image, filename: `gift-render-${index + 1}.png`, metadata: { source: 'ai', stage: 'render', sequence: index + 1, usageRequestId: reservation.requestId } });
            return { index, image: saved };
          }).catch((error) => {
            console.warn('Gift render slot failed after provider fallback:', { index, requestId: reservation.requestId, error });
            return { index, error: publicGiftImageError(error) };
          }));
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
              send({ type: 'slot-error', index: result.index, error: result.error?.code || 'upstream', message: result.error?.message || 'Image generation is temporarily unavailable.', elapsedMs: Date.now() - startedAt });
            }
          }
          if (readyCount === 3) await settleGiftAiUsage(reservation.requestId, 'succeeded');
          else if (readyCount > 0) await settleGiftAiUsage(reservation.requestId, 'partial', new GiftAiError(`${3 - readyCount} of 3 gift concepts failed to generate.`));
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
        ({ requestId }) => generateGiftImages(prompt, 3, monochromeColor, { requestId, stage: 'render' }),
        giftAiIdempotencyKey(request),
        { provider: 'krill-ai', model: configuredImageGenerationModel() },
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
      const generated = await generateGiftImages(prompt, 3, monochromeColor, { requestId, stage: 'render' });
      await updateGiftAiUsageModel(requestId, generated.find((image) => image.model)?.model || configuredImageGenerationModel());
      return Promise.all(generated.map((image, index) => persistGiftDraftGeneratedImage({
        actor: employee,
        requestId: draft.id,
        image,
        filename: `gift-render-${index + 1}.png`,
        metadata: { source: 'ai', stage: 'render', sequence: index + 1, usageRequestId: requestId },
      })));
    }, giftAiIdempotencyKey(request), { provider: 'krill-ai', model: configuredImageGenerationModel() });
    return NextResponse.json({ draft, images }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
