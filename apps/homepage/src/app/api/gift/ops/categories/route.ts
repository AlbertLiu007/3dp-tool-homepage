import { NextRequest, NextResponse } from 'next/server';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';
import { createGiftOpsCategory, listGiftOpsCategories } from '@/lib/gift-ops-db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await authorizeGiftOpsRequest(request);
    return NextResponse.json({ categories: await listGiftOpsCategories() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load model categories.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { employee, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    const result = await createGiftOpsCategory(employee, await request.json() as Record<string, unknown>, requestIp);
    return NextResponse.json(result, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to create model category.');
  }
}
