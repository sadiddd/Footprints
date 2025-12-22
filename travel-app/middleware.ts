import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Check for Cognito auth tokens in cookies
  const cookies = request.cookies;
  
  // Cognito stores tokens with these patterns
  const hasIdToken = Array.from(cookies.getAll()).some(
    cookie => cookie.name.includes('idToken') || cookie.name.includes('CognitoIdentityServiceProvider')
  );

  if (!hasIdToken) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/trips/:path*",
    "/profile/:path*",
  ],
};
