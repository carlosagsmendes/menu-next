import {
  QueryClient,
  defaultShouldDehydrateQuery,
  environmentManager,
} from "@tanstack/react-query";

/**
 * Shared QueryClient factory — ensures every QueryClient in the app
 * (server prefetch instances AND the browser singleton) uses identical
 * defaults for staleTime and dehydration behavior.
 *
 * Key settings:
 *  - staleTime 60s: prevents the client from refetching immediately
 *    after hydration (the "double-fetch" anti-pattern).
 *  - shouldDehydrateQuery includes pending queries: enables the
 *    fire-and-forget prefetch pattern where a Server Component kicks
 *    off a prefetch without `await`, and the still-pending promise is
 *    serialized into the HydrationBoundary. React streams the resolved
 *    data to the client once it completes — no extra client HTTP round-trip.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // Include pending queries so fire-and-forget prefetches in Server
        // Components are serialized into the HydrationBoundary and streamed
        // to the client as they resolve (TanStack Query v5.40+).
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns a QueryClient appropriate for the current environment:
 *  - Server: always creates a fresh instance (avoids cross-request leaks).
 *  - Browser: returns a stable singleton (avoids recreation on Suspense
 *    re-renders, which would reset the cache and cause repeated fetches).
 */
export function getQueryClient() {
  if (environmentManager.isServer()) return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
