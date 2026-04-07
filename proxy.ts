import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  AUTH_HEADERS,
  lookupAuthenticatedUser,
} from "@/data/auth";

function createNonce() {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}

function createContentSecurityPolicy(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  const styleSrc = `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ""};`;

  return `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    ${styleSrc}
    style-src-attr 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  // Run simulated auth lookup only for /context* requests
  const { pathname } = request.nextUrl;
  if (pathname === "/context" || pathname.startsWith("/context/")) {
    const result = await lookupAuthenticatedUser("proxy");
    requestHeaders.set(AUTH_HEADERS.userId, result.user.userId);
    requestHeaders.set(AUTH_HEADERS.proxyLookupId, result.lookupId);
    requestHeaders.set(AUTH_HEADERS.proxyDurationMs, String(result.durationMs));
    requestHeaders.set(AUTH_HEADERS.proxyAuthRan, "1");
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
