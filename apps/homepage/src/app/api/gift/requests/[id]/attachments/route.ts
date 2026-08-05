import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftRequest, giftApiError } from '@/lib/gift-api';
import { uploadGiftRequestAttachment } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee } = await authorizeGiftRequest(request, true);
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'validation', message: 'A file is required.' }, { status: 400 });
    const result = await uploadGiftRequestAttachment(employee, Number(context.params.id), file, String(data.get('role') || 'reference'), true);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftApiError(error, 'Unable to upload request attachment.');
  }
}
