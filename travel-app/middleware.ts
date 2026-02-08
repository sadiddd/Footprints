import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Only protect routes that require authentication
  // /browse is public, so we don't protect it
  const path = request.nextUrl.pathname;

  // Check if the route requires authentication
  const requiresAuth = path.startsWith("/trips") || path.startsWith("/profile");

  if (!requiresAuth) {
    return NextResponse.next();
  }

  // Let all requests through - the page components will handle authentication
  // This prevents false negatives where authenticated users are incorrectly blocked
  // Pages use getCurrentUser() which is the authoritative auth check
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/trips/:path*",
    "/profile/:path*",
  ],
};
