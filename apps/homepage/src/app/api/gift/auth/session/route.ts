import { NextResponse } from 'next/server';
import { getGiftSession } from '@/lib/gift-auth';

export const dynamic = 'force-dynamic';

export function GET() {
  const session = getGiftSession();

  if (!session) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        userId: session.userId,
        name: session.name,
        departments: session.departments,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
