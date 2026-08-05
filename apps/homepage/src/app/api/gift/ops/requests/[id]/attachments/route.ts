import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';
import { uploadGiftRequestAttachment } from '@/lib/gift-oss';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    const data = await request.formData();
    const file = data.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'validation', message: 'A file is required.' }, { status: 400 });
    const result = await uploadGiftRequestAttachment(
      employee,
      Number(context.params.id),
      file,
      String(data.get('role') || 'production'),
      String(data.get('visibleToRequester') || 'true') !== 'false',
      requestIp,
    );
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to upload print request attachment.');
  }
}
