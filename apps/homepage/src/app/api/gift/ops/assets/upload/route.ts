import { NextRequest, NextResponse } from 'next/server';
import { uploadGiftOpsAsset } from '@/lib/gift-oss';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    const formData = await request.formData();
    const file = formData.get('file');
    const modelId = Number(formData.get('modelId'));
    const kind = formData.get('kind');
    if (!(file instanceof File) || !Number.isInteger(modelId) || modelId <= 0 || typeof kind !== 'string') return NextResponse.json({ error: 'validation' }, { status: 400 });
    const asset = await uploadGiftOpsAsset(employee, modelId, file, kind, requestIp);
    return NextResponse.json({ asset }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to upload model asset.');
  }
}
