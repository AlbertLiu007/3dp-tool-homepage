import { NextRequest, NextResponse } from 'next/server';
import { reviewGiftEmployee, type GiftApprovalStatus, type GiftEmployeeRole } from '@/lib/gift-db';
import { getGiftEmployeeOpsDetail } from '@/lib/gift-ops-db';
import { authorizeGiftOpsRequest, giftOpsErrorResponse } from '@/lib/gift-ops-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const approvalStatuses = new Set<GiftApprovalStatus>(['pending', 'approved', 'rejected', 'suspended']);

type ReviewBody = {
  approvalStatus?: unknown;
  note?: unknown;
  renderDailyLimit?: unknown;
  editDailyLimit?: unknown;
  modelDailyLimit?: unknown;
  maxConcurrentJobs?: unknown;
  role?: unknown;
};

function optionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    await authorizeGiftOpsRequest(request);
    const detail = await getGiftEmployeeOpsDetail(Number(context.params.id));
    return NextResponse.json(detail, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to load employee detail.');
  }
}

export async function PATCH(request: NextRequest, context: { params: { id: string } }) {

  try {
    const { session, employee: actor, requestIp } = await authorizeGiftOpsRequest(request, { mutation: true });
    const body = await request.json() as ReviewBody;
    const approvalStatus = body.approvalStatus as GiftApprovalStatus;
    if (!approvalStatuses.has(approvalStatus)) {
      return NextResponse.json({ error: 'validation', message: 'Invalid approval status.' }, { status: 400 });
    }
    const employee = await reviewGiftEmployee(session, Number(context.params.id), {
      approvalStatus,
      note: typeof body.note === 'string' ? body.note : undefined,
      renderDailyLimit: optionalNumber(body.renderDailyLimit),
      editDailyLimit: optionalNumber(body.editDailyLimit),
      modelDailyLimit: optionalNumber(body.modelDailyLimit),
      maxConcurrentJobs: optionalNumber(body.maxConcurrentJobs),
      role: typeof body.role === 'string' && ['employee', 'operator', 'admin'].includes(body.role) ? body.role as GiftEmployeeRole : undefined,
      requestIp,
    });
    return NextResponse.json({ employee }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return giftOpsErrorResponse(error, 'Unable to review employee.');
  }
}
