import { NextRequest, NextResponse } from 'next/server';
import { listGiftEmployees, type GiftApprovalStatus } from '@/lib/gift-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const approvalStatuses = new Set<GiftApprovalStatus>(['pending', 'approved', 'rejected', 'suspended']);

export async function GET(request: NextRequest) {
  const requestedStatus = request.nextUrl.searchParams.get('status') as GiftApprovalStatus | null;
  const status = requestedStatus && approvalStatuses.has(requestedStatus) ? requestedStatus : undefined;

  try {
    const { session } = await authorizeGiftOpsRequest(request);
    const employees = await listGiftEmployees(session, status);
    return NextResponse.json({ employees }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to list employees.');
  }
}
