import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = await getToken({ req: request, secret: process.env.AUTH_SECRET });

  const isLoggedIn = !!token;
  const role = token?.role;

  if (path.startsWith("/login")) {
    if (isLoggedIn) {
      return NextResponse.redirect(
        new URL(role === "PLATFORM_ADMIN" ? "/admin" : "/dashboard", request.nextUrl)
      );
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.nextUrl);
    loginUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(loginUrl);
  }

  if (role === "PLATFORM_ADMIN" && path.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }

  if (role !== "PLATFORM_ADMIN" && path.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/login"],
};
