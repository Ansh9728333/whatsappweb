import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/signup", "/api/webhook"];
const ADMIN_PATHS = ["/dashboard/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow API v1 routes (use their own API key auth)
  if (pathname.startsWith("/api/v1")) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/"
  ) {
    return NextResponse.next();
  }

  // Protect dashboard routes
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/")) {
    const token = request.cookies.get("whatsify-session")?.value;
    const session = await decrypt(token);

    if (!session) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Admin-only routes
    if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
      if (session.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
    }

    // Add session info to headers for server components
    const response = NextResponse.next();
    response.headers.set("x-user-id", session.userId);
    response.headers.set("x-user-role", session.role);
    if (session.customerId) {
      response.headers.set("x-customer-id", session.customerId);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
