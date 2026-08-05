import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (hostname === 'ops.unionam.com' && request.nextUrl.pathname === '/') {
    const destination = request.nextUrl.clone();
    destination.pathname = '/ops';
    return NextResponse.rewrite(destination);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
