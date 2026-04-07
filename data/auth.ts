import "server-only";
import { cache } from "react";
import { forbidden } from "next/navigation";
import { connection } from "next/server";

export type Permission = "community:admin" | "site:admin";

export type Session = {
  userId: string;
  permissions: Permission[];
} | null;

export const getSession = cache(async (): Promise<Session> => {
  await connection();
  return {
    userId: "user_1",
    permissions: ["community:admin", "site:admin"],
  };
});

export async function hasPermission(p: Permission): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return session.permissions.includes(p);
}

export async function verifyPermission(p: Permission): Promise<void> {
  const allowed = await hasPermission(p);
  if (!allowed) forbidden();
}

// ---------------------------------------------------------------------------
// Simulated authenticated-user lookup for the /context experiment
// ---------------------------------------------------------------------------

export type AuthenticatedUser = {
  userId: string;
  name: string;
  email: string;
  permissions: Permission[];
};

export type AuthLookupResult = {
  user: AuthenticatedUser;
  lookupId: string;
  source: "proxy" | "render";
  durationMs: number;
};

/** Header keys shared between proxy.ts and render code. */
export const AUTH_HEADERS = {
  userId: "x-ctx-user-id",
  proxyLookupId: "x-ctx-proxy-lookup-id",
  proxyDurationMs: "x-ctx-proxy-duration-ms",
  proxyAuthRan: "x-ctx-proxy-auth",
} as const;

const MOCK_USER: AuthenticatedUser = {
  userId: "ctx_user_42",
  name: "Jane Context",
  email: "jane@example.com",
  permissions: ["community:admin", "site:admin"],
};

/**
 * Low-level uncached helper. Each call simulates a backend round-trip
 * and returns a unique lookupId so callers can prove deduplication.
 */
export async function lookupAuthenticatedUser(
  source: "proxy" | "render",
): Promise<AuthLookupResult> {
  const start = performance.now();
  await new Promise((r) => setTimeout(r, 15 + Math.random() * 15));
  return {
    user: MOCK_USER,
    lookupId: crypto.randomUUID().slice(0, 8),
    source,
    durationMs: Math.round(performance.now() - start),
  };
}

/**
 * Render-tree helper — `React.cache` ensures a single lookup per request
 * no matter how many server components call it in the same render pass.
 * Calls `connection()` to opt out of static prerendering.
 */
export const getAuthenticatedUser = cache(async () => {
  await connection();
  return lookupAuthenticatedUser("render");
});
