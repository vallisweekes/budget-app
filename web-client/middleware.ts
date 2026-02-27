import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CANONICAL_HOST = "budgetingcheck.com";
const REDIRECT_HOSTS = new Set([
  "www.budgetingcheck.com",
  "budgetingcheck.co.uk",
  "www.budgetingcheck.co.uk",
]);

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";

  if (!REDIRECT_HOSTS.has(host)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.protocol = "https:";
  url.host = CANONICAL_HOST;

  return NextResponse.redirect(url, 308);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*|robots.txt|sitemap.xml).*)",
  ],
};
