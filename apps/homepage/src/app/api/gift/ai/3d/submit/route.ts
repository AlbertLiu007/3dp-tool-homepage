import { NextResponse } from 'next/server';
import { submitWhiteModel } from '@/lib/gift-ai';
import { giftAiErrorResponse, requireGiftEmployee, validateImageFile } from '@/lib/gift-ai-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    requireGiftEmployee();
    const formData = await request.formData();
    const image = validateImageFile(formData.get('image'), 5 * 1024 * 1024);
    const job = await submitWhiteModel(image);
    return NextResponse.json({ job }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftAiErrorResponse(error);
  }
}
