import { NextResponse } from 'next/server';
import { generateGiftImages, GiftAiError } from '@/lib/gift-ai';
import { giftAiErrorResponse, giftAiIdempotencyKey, requireGiftEmployee, withGiftAiUsage } from '@/lib/gift-ai-route';
import { requireGiftEmployeeAccess } from '@/lib/gift-db';
import { ensureGiftAiDraft } from '@/lib/gift-library-db';
import { persistGiftDraftGeneratedImage } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireGiftEmployee({ approved: true });
    const body = await request.json() as Record<string, unknown>;
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) throw new GiftAiError('Prompt must contain 1 to 4000 characters.', 400, 'validation');
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
      return Promise.all(generated.map((image, index) => persistGiftDraftGeneratedImage({
        actor: employee,
        requestId: draft.id,
        image,
        filename: `gift-render-${index + 1}.png`,
        metadata: { source: 'ai', stage: 'render', sequence: index + 1, usageRequestId: requestId },
      })));
    }, giftAiIdempotencyKey(request), { provider: 'krill-ai', model: process.env.GPT_IMAGE_MODEL || 'wan2.7-image-pro' });
    return NextResponse.json({ draft, images }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
