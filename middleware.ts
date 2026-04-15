import { NextRequest, NextResponse } from "next/server";
import { ADMIN_AUTH_COOKIE, isAdminAuthenticatedValue } from "@/lib/admin-auth";

export function middleware(req: NextRequest) {
  const cookieValue = req.cookies.get(ADMIN_AUTH_COOKIE)?.value;
  if (isAdminAuthenticatedValue(cookieValue)) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", `${req.nextUrl.pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
