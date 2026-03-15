import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Debug: Log environment variable status
  const secretExists = !!process.env.JWT_SECRET;
  const secretLength = process.env.JWT_SECRET?.length || 0;
  console.log(`[MW] Path: ${pathname}, JWT_SECRET exists: ${secretExists}, length: ${secretLength}`);

  const isAdminRoute = pathname.startsWith('/api/admin') || pathname.startsWith('/admin');
  const isAffiliateRoute = pathname.startsWith('/api/affiliate') || pathname.startsWith('/affiliate');

  if (!isAdminRoute && !isAffiliateRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token')?.value;
  console.log(`[MW] Token exists: ${!!token}, length: ${token?.length || 0}`);

  if (!token) {
    console.log('[MW] No token, redirecting to login');
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Check if secret exists before trying to verify
  if (!process.env.JWT_SECRET) {
    console.error('[MW] CRITICAL: JWT_SECRET is undefined in Edge Runtime!');
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    
    console.log(`[MW] JWT verified! userId: ${payload.userId}, role: ${payload.role}`);
    
    const userRole = payload.role as string;

    if (isAdminRoute && userRole !== 'ADMIN') {
      console.log('[MW] User is not admin, redirecting');
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId as string);
    response.headers.set('x-user-role', userRole);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MW] JWT verification failed: ${errorMessage}`);
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/admin/:path*', '/affiliate/:path*', '/api/admin/:path*', '/api/affiliate/:path*', '/api/auth/me'],
};
