# Next.js + Vercel Review

Date: 2026-03-31  
Project: `menu-next`  
Review mode: static audit + runtime verification, no code changes

## Scope

This review was grounded in the installed Next.js 16 docs and the relevant Vercel plugin guidance for:

- `nextjs`
- `react-best-practices`
- `vercel-functions`
- `observability`
- `verification`
- `agent-browser` / `agent-browser-verify`
- `ai-sdk`

## Executive Summary

The app is in a healthy exploratory state: `npm run lint` and `npm run build` both pass, and the main routes I checked in the browser (`/`, `/blog`, `/blog/1`, `/editor`, `/admin/community`) all rendered without an error overlay.

The biggest issues are not compile-time problems. They are production-readiness gaps:

- failures will be hard to diagnose because the app has almost no observability surface
- the app enables Next 16 Cache Components but still relies heavily on older client-cache patterns for read paths
- a few user-visible template leftovers are still present, including the blog detail title inheriting `Create Next App`

## Findings

### P1. Production failures are mostly invisible today

Files:

- `app/api/posts/[id]/comments/route.ts:5-25`
- `app/api/proofread/route.ts:41-73`
- `app/(app)/api/tasks/count/route.ts:3-5`
- `app/error.tsx:3-25`
- `app/global-error.tsx:6-35`
- `package.json:11-38`

Why this matters:

- The route handlers do not log request starts, completions, failures, or request IDs.
- The comments `POST` handler trusts `request.json()` via a type cast instead of validating the payload at the edge of the system.
- The segment error boundaries render fallback UI but never log or report the actual exception.
- The repo does not currently include `@vercel/otel`, `@vercel/analytics`, or `@vercel/speed-insights`, and there is no root `instrumentation.ts`.

Impact:

- A malformed request or runtime exception will be hard to distinguish from an application bug, platform issue, or bad client payload.
- In production, users can see fallback UI while the team gets very little diagnostic signal back.

Why this is a Next/Vercel mismatch:

- Next's error-handling docs explicitly show logging inside `error.tsx` via `useEffect`.
- Vercel's observability guidance strongly favors a baseline of structured logs plus `instrumentation.ts` / OTel for route-level visibility.

Recommendation:

- Treat route handlers and server actions as the logging boundary.
- Validate external input with `zod` before mutation.
- Add a root `instrumentation.ts` with `@vercel/otel`.
- Add `Analytics` and `SpeedInsights` to the root layout once the app is meant to be measured in real environments.

### P2. `cacheComponents: true` is enabled, but the app still uses a mixed data model

Files:

- `next.config.ts:3-9`
- `app/(public)/blog/page.tsx:15-30`
- `components/blog/CommentsShell.tsx:9-25`
- `components/TaskCount.tsx:10-31`
- `lib/posts.ts:106-117`
- `lib/posts.ts:139-163`
- `lib/query-client.ts:7-50`
- `components/BlogPostList.tsx:32-70`

Why this matters:

- The app has opted into Next 16 Cache Components, but the main read paths still mix:
  - React Query server prefetch + hydration
  - `react` `cache(...)`
  - `connection()`
  - manual polling in `useEffect`
- That means the codebase pays the complexity cost of both Next 16's cache model and a client cache layer, without a clear rule for when each one should be used.

Current pattern examples:

- `/blog` hydrates React Query from the server for the initial list.
- comments use both server-prefetched React Query and a separate client-only React Query example on the same page.
- task count bypasses the app's chosen query layer entirely and hand-rolls polling with `fetch` + `setInterval`.

Impact:

- Harder reasoning about cache invalidation and freshness.
- More client JavaScript than necessary for read-mostly surfaces.
- Harder to take full advantage of Partial Prerendering and `use cache` / `cacheLife`.

Recommendation:

- Pick a default:
  - Server Components + `Suspense` + `use cache` / `cacheLife` for read-heavy data
  - React Query only where client-side mutation, refetch, optimistic UI, or background polling is genuinely needed
- If `cacheComponents` stays on, migrate stable read helpers from `react cache(...)` to the Next 16 cache model so the intent is explicit and aligned with the framework.

### P2. The search box can race and show stale results

Files:

- `components/SearchBox.tsx:44-62`
- `lib/search.ts:69-80`

Why this matters:

- The debounce clears pending timers, but once a request starts there is no abort or sequence guard.
- A slower response for an older query can overwrite a newer query's results.
- Because `searchContent` is a server function, every settled search roundtrip is also a server call.

Impact:

- The UI can show stale or flickering results under real latency.
- The component has no back-pressure or cancellation strategy if search becomes more expensive later.

Recommendation:

- Keep the current server-function approach only if search is intentionally server-backed, then add request sequencing or cancellation.
- Otherwise move this to a small route handler or query layer and use `useDeferredValue`, React Query, or SWR to standardize the pattern with the rest of the app.

### P3. User-visible starter-template leftovers are still in the product surface

Files:

- `app/layout.tsx:8-11`
- `app/(public)/page.tsx:11-76`
- `app/(public)/blog/[id]/page.tsx:76-117`

Runtime evidence:

- Browser verification showed the `/blog/1` title as `Create Next App`.
- Visiting `/` emitted a Next.js warning for the `/vercel.svg` image sizing.

Why this matters:

- The root metadata is still the create-next-app default.
- The home page is still starter content and starter CTAs.
- The blog detail route does not define route-specific metadata, so the browser title falls back to the default shell title.

Impact:

- Weakens perceived product completeness.
- Hurts SEO/shareability for blog detail pages.
- Leaves noisy dev warnings in the default path.

Recommendation:

- Replace the remaining starter-template surface area before shipping broader reviews of product quality.
- Add `generateMetadata` for `/blog/[id]`.
- Remove or correct the default asset usage that triggers the image warning.

## Stronger Patterns To Standardize On

### Prefer Server Components first for read paths

The codebase already has a good server-first foundation:

- layouts remain Server Components by default
- `params` are awaited correctly for Next 16
- `server-only` is used in the data layer

The next step is to make read paths consistently server-first and use client cache libraries only where they are buying something concrete.

### Make input validation non-optional at route boundaries

The project already uses `zod` and the AI proofread flow validates its payload shape. That same rule should apply to non-AI route handlers, especially mutation endpoints like comments.

### Treat observability as part of the feature, not follow-up work

This app has multiple async boundaries:

- streamed server rendering
- route handlers
- server functions
- AI generation
- client hydration

That makes Vercel-native observability unusually valuable here. Add instrumentation before the app grows more complex.

### Use one consistent story for client freshness

Right now there are three different patterns in one app:

- pure server rendering + Suspense
- React Query with server prefetch
- manual client polling

That variety is useful for learning, but expensive in production. Standardizing will make future features easier to review and maintain.

## What Is Already Good

- Next 16 async request APIs are used correctly in the dynamic page and comment route handlers.
- The client/server boundary is generally narrow and intentional; the root shell remains server-rendered.
- The proofread flow is using modern AI SDK v6 structured output correctly with `generateText` + `Output.object` in `lib/proofread.ts:358-366`.
- `notFound()` and `forbidden()` are used idiomatically in the App Router.
- `npm run lint` passed.
- `npm run build` passed.
- Browser checks for `/`, `/blog`, `/blog/1`, `/editor`, and `/admin/community` all loaded successfully with no error overlay.

## Testing Gaps

- I did not find any automated test setup in the repo: no Playwright, Vitest, Jest, or Cypress config, and no `*.test.*` / `*.spec.*` files.
- Given the amount of async UI and route-handler behavior, a small Playwright smoke suite would pay off quickly.

Recommended first smoke checks:

- `/blog` renders and paginates
- `/blog/[id]` renders comments and accepts a new comment
- `/editor` loads and can start a proofread run
- unauthorized / forbidden flows for admin routes behave correctly once real auth exists

## Verification Notes

Commands run:

- `npm run lint`
- `npm run build`
- local browser verification via `agent-browser`

Routes verified in browser:

- `/`
- `/blog`
- `/blog/1`
- `/editor`
- `/admin/community`

Observed runtime note:

- `/` emitted a Next.js image warning for `/vercel.svg`

## Suggested Next Steps

1. Add observability baseline: `instrumentation.ts`, structured route logging, error-boundary logging, and Vercel Analytics/Speed Insights.
2. Decide the default read-path strategy for the app: Server Components + Cache Components first, React Query only where interactivity justifies it.
3. Validate all mutation payloads with `zod` at the route boundary.
4. Clean up metadata and remaining create-next-app template surface.
5. Add a minimal Playwright smoke suite for the verified routes above.

## References

- [Next.js Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [Next.js Caching with Cache Components](https://nextjs.org/docs/app/getting-started/caching)
- [Next.js `use server`](https://nextjs.org/docs/app/api-reference/directives/use-server)
- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Next.js Error Handling](https://nextjs.org/docs/app/getting-started/error-handling)
- [Next.js OpenTelemetry Guide](https://nextjs.org/docs/app/guides/open-telemetry)
- [Vercel Analytics Quickstart](https://vercel.com/docs/analytics/quickstart)
- [Vercel Tracing / Instrumentation](https://vercel.com/docs/tracing/instrumentation)
- [Vercel Functions](https://vercel.com/docs/functions)
