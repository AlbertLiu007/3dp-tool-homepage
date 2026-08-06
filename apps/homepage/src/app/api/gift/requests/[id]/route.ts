import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { cancelMyGiftPrintRequest, getMyGiftPrintRequestDetail, submitGiftAiDraft } from '@/lib/gift-library-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { session } = await authorizeGiftRequest(request);
    return NextResponse.json(await getMyGiftPrintRequestDetail(session, Number(context.params.id)), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to load print request detail.');
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { session } = await authorizeGiftRequest(request, true);
    const body = await request.json() as Record<string, unknown>;
    if (body.action === 'cancel') {
      await cancelMyGiftPrintRequest(session, Number(context.params.id), typeof body.reason === 'string' ? body.reason : '');
      return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (body.action === 'submit') {
      const result = await submitGiftAiDraft(session, Number(context.params.id), body);
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'validation', message: 'Unsupported request action.' }, { status: 400 });
  } catch (error) {
    return giftApiError(error, 'Unable to update print request.');
  }
}
