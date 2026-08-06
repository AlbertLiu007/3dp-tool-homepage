import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (hostname === 'ops.unionam.com' && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/ops', 'https://ops.unionam.com'));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
