import { NextResponse, type NextRequest } from "next/server";

/**
 * Passes the admin page path to Server Components, which can't read it
 * themselves. requireAdmin() uses it so the Security page stays reachable for
 * an admin who still has to set up two-factor sign-in (src/lib/auth/two-factor.ts).
 * Always overwritten here, so a client can't supply its own value.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-myt-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
