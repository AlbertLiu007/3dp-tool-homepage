import { NextRequest, NextResponse } from 'next/server';
import { createTrustedRequestId, INTERNAL_REQUEST_ID_HEADER } from '@/lib/request-id';

function componentFor(pathname: string) {
  if (pathname === '/ops' || pathname.startsWith('/api/gift/ops/')) return 'gift-ops';
  if (pathname === '/gift' || pathname.startsWith('/api/gift/')) return 'gift';
  return 'homepage';
}

export function middleware(request: NextRequest) {
  const startedAt = Date.now();
  // The public X-Request-ID is deliberately ignored: correlation IDs are minted
  // only after the request crosses this trusted application boundary.
  const requestId = createTrustedRequestId(request.headers.get('x-request-id'));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(INTERNAL_REQUEST_ID_HEADER, requestId);
  const hostname = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (hostname === 'ops.unionam.com' && request.nextUrl.pathname === '/') {
    const response = NextResponse.redirect(new URL('/ops', 'https://ops.unionam.com'));
    response.headers.set('X-Request-ID', requestId);
    return response;
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('X-Request-ID', requestId);
  if (request.nextUrl.pathname.startsWith('/api/')) {
    console.log(JSON.stringify({
      time: new Date().toISOString(), level: 'info', service: 'unionam-homepage',
      environment: process.env.NODE_ENV || 'development', component: componentFor(request.nextUrl.pathname),
      event: 'http.request.accepted', result: 'accepted', request_id: requestId,
      duration_ms: Math.max(0, Date.now() - startedAt), error_code: null,
      details: { method: request.method, route: request.nextUrl.pathname.slice(0, 255) },
    }));
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt)$).*)'],
};
