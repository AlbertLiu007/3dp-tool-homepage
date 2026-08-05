import { NextRequest, NextResponse } from 'next/server';
import { createGiftOpsModel, listGiftOpsModels } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    const models = await listGiftOpsModels(request.nextUrl.searchParams.get('search') || undefined);
    return NextResponse.json({ models }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load models.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    const result = await createGiftOpsModel(employee, await request.json() as Record<string, unknown>, requestIp);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to create model.');
  }
}
