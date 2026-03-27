# Foundation Hardening — Implementation Plan

## Context

The `menu-next` project is a Next.js 16.2.1 App Router starter with mock data, stub auth, and zero testing/observability. The root layout wraps **everything** (including public routes) in QueryClientProvider + Toolbar + SideNav. Admin routes use `forbidden()` but `authInterrupts` isn't enabled. There's no CI, no tests, no analytics, placeholder metadata, and no mobile nav.

This plan turns it into a server-first, Vercel-native starter with proper boundaries: public vs authenticated route groups, a typed auth DAL, scoped client state, real observability, and a quality gate.

---

## Phase 1: Config & Auth Foundation

**Goal**: Make `forbidden()` actually work and establish the auth type system.

### 1.1 Enable authInterrupts
- **File**: `next.config.ts`
- Add `experimental: { authInterrupts: true }`
- **Verify**: set a permission stub to `false`, confirm 403 renders

### 1.2 Create `data/auth.ts` — typed auth DAL
- **New file**: `data/auth.ts` (with `import "server-only"`)
- Define `Permission` union: `"community:admin" | "site:admin"`
- Define `Session` type: `{ userId: string; permissions: Permission[] } | null`
- `getSession()` — `React.cache()` wrapped, returns mock session with all permissions (stub)
- `hasPermission(p: Permission): Promise<boolean>` — for conditional UI (sidebar)
- `verifyPermission(p: Permission): Promise<void>` — calls `forbidden()` if denied

### 1.3 Create `data/dto.ts` — shared types
- **New file**: `data/dto.ts` (no `server-only` — types are shared)
- Move `Post`, `PostsPage` from `lib/posts.ts`
- Move `Task` from `lib/tasks.ts`
- Move `SearchResult` from `lib/search.ts`
- Update `lib/posts.ts`, `lib/tasks.ts`, `lib/search.ts` to import from `data/dto.ts`

### 1.4 Create env module
- **New file**: `lib/env.ts` (server-only) — manual `required()` / `optional()` helpers, empty for now but pattern is in place
- **New file**: `lib/env.client.ts` — for `NEXT_PUBLIC_*` vars

### 1.5 Migrate consumers off `lib/permissions.ts`
- `components/SideNavAdminLinks.tsx` → import `hasPermission` from `data/auth`
- `app/admin/site/page.tsx` → `await verifyPermission("site:admin")`
- `app/admin/community/page.tsx` → `await verifyPermission("community:admin")`
- **Delete** `lib/permissions.ts`

**Checkpoint**: `pnpm build` passes. Toggling session stub to `null` shows 403.

---

## Phase 2: Route Groups & Shell Restructure

**Goal**: Split app into `(public)` and `(app)` route groups. Root layout becomes lean. QueryClientProvider scoped to where it's needed.

### 2.1 Create `(public)` route group
- **Move** `app/page.tsx` → `app/(public)/page.tsx`
- **Move** `app/loading.tsx` → `app/(public)/loading.tsx`
- **Move** `app/blog/` → `app/(public)/blog/`
- **Create** `app/(public)/layout.tsx` — pass-through (just `{children}`)

### 2.2 Scope `<Providers>` to blog page
- Blog is the only consumer of QueryClientProvider
- Wrap `<HydrationBoundary>` inside `<Providers>` directly in `PrefetchedBlogPostList` in `app/(public)/blog/page.tsx`
- Remove `<Providers>` from root layout

### 2.3 Create `(app)` route group with shell layout
- **Create** `app/(app)/layout.tsx` — contains `<Toolbar>`, `<SideNav>`, flex shell (what root layout has now)
- **Move** `app/admin/` → `app/(app)/admin/`
- **Move** `app/api/tasks/count/` → `app/(app)/api/tasks/count/`
- **Create** `app/(app)/admin/layout.tsx` — auth guard: calls `getSession()`, if `null` → `forbidden()`

### 2.4 Slim down root layout
- **File**: `app/layout.tsx`
- Keep only: `<html>`, `<body>`, font classes, `globals.css` import, metadata, `<Analytics />`, `<SpeedInsights />`
- Remove: `<Providers>`, `<Toolbar>`, `<SideNav>`, flex shell

### 2.5 Keep shared error files at root
- `app/error.tsx`, `app/global-error.tsx`, `app/forbidden.tsx` stay at root (catch errors from both groups)

**Result directory structure**:
```
app/
  layout.tsx              ← lean: html, body, fonts, analytics
  error.tsx / global-error.tsx / forbidden.tsx
  globals.css / favicon.ico
  (public)/
    layout.tsx            ← pass-through
    page.tsx              ← home
    loading.tsx
    blog/
      page.tsx            ← scoped <Providers> + prefetch
      loading.tsx
  (app)/
    layout.tsx            ← Toolbar + SideNav shell
    admin/
      layout.tsx          ← auth guard (session required)
      site/page.tsx + loading.tsx
      community/page.tsx + loading.tsx
    api/tasks/count/route.ts
data/
  auth.ts                 ← Session, Permission, verifyPermission, hasPermission
  dto.ts                  ← shared types
lib/
  posts.ts / tasks.ts / search.ts / actions.ts  ← implementation (unchanged)
  simulate-page-load.ts
  env.ts / env.client.ts
```

**Checkpoint**: `pnpm dev` — all routes load at same URLs. Navigation between public and app routes works without full-page reloads. Blog infinite scroll works. Admin 403 works.

---

## Phase 3: SEO & Not-Found

**Goal**: Replace template metadata, add proper SEO files, add not-found.

### 3.1 Root metadata with template
- **File**: `app/layout.tsx`
- Replace `"Create Next App"` with: `title: { default: "Menu", template: "%s | Menu" }`, real description
- Add `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000")`

### 3.2 Add SEO files
- **New file**: `app/robots.ts` — allow all, sitemap reference
- **New file**: `app/sitemap.ts` — list `/`, `/blog`, `/admin/site`, `/admin/community`
- **New file**: `app/not-found.tsx` — styled 404 page with link home

### 3.3 Update page metadata
- Each page.tsx keeps its own `metadata` export but with real descriptions (not "Generated by create next app")

**Checkpoint**: `pnpm build` — metadata shows in page source. `/nonexistent` shows not-found page.

---

## Phase 4: Search & UX Fixes

**Goal**: Fix search edge cases, add empty states.

### 4.1 Search: stale-request protection
- **File**: `components/SearchBox.tsx`
- Add a request counter ref. In the `startTransition` callback, capture current counter before await. After await, only set results if counter still matches (prevents stale results from overwriting newer ones).

### 4.2 Search: empty-results state
- **File**: `components/SearchBox.tsx`
- When `results.length === 0 && !isPending && query.trim()`, show "No results found" in the dropdown
- Change `showDropdown` logic: `open && (results.length > 0 || isPending || (query.trim() && results.length === 0))`

### 4.3 Keyboard navigation for search results
- The current SearchBox handles Escape but doesn't support arrow-key navigation through results
- Add `activeIndex` state, ArrowDown/ArrowUp handlers, Enter to select, update `aria-selected` on active item
- Scroll active item into view

### 4.4 Loading states
- Replace `PageLoadingFallback` "Loading..." text with a proper skeleton matching each page's structure
- Blog skeleton (`BlogPostListSkeleton`) is already good — leave it

**Checkpoint**: Rapid typing in search doesn't show stale results. Empty query shows message. Arrow keys navigate results.

---

## Phase 5: Observability

**Goal**: Add Vercel Analytics, Speed Insights, and structured error logging.

### 5.1 Install packages
```
pnpm add @vercel/analytics @vercel/speed-insights
```

### 5.2 Add to root layout
- **File**: `app/layout.tsx`
- Add `<Analytics />` from `@vercel/analytics/next` and `<SpeedInsights />` from `@vercel/speed-insights/next` inside `<body>` after `{children}`

### 5.3 Add instrumentation.ts
- **New file**: `instrumentation.ts` (at project root, same level as `app/`)
```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Future: add @vercel/otel here when ready
    // const { registerOTel } = await import('@vercel/otel');
    // registerOTel('menu-next');
  }
}
```
- Don't add `@vercel/otel` dependency yet — the hook is ready for when it's needed

### 5.4 Wire error boundaries to structured logging
- **File**: `app/error.tsx` — add `useEffect` that calls `console.error(JSON.stringify({ level: "error", msg: "client-error", error: error.message, digest: error.digest }))`
- **File**: `app/global-error.tsx` — same pattern

**Checkpoint**: Deploy preview shows Analytics and Speed Insights loading. Error boundary errors appear in Vercel runtime logs as structured JSON.

---

## Phase 6: Testing Infrastructure

**Goal**: Vitest for units, Playwright for E2E, quality-gate scripts.

### 6.1 Install test dependencies
```
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @playwright/test
```

### 6.2 Vitest config
- **New file**: `vitest.config.mts`
- jsdom environment, `@/*` path alias, exclude `e2e/`

### 6.3 Package.json scripts
- **File**: `package.json`
- Add: `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:e2e": "playwright test"`, `"check": "pnpm lint && pnpm typecheck && pnpm test"`

### 6.4 Unit tests (Vitest)
- **New file**: `lib/__tests__/search.test.ts` — test `searchContent` filtering: exact match, partial match, case insensitive, no results, empty query
- **New file**: `lib/__tests__/posts.test.ts` — test `getPostsPage` pagination: first page, middle page, last page, cursor bounds (mock `server-only`, `connection()`, `React.cache()`)

### 6.5 Playwright config
- **New file**: `playwright.config.ts` — Chromium only, `webServer` runs `pnpm build && pnpm start`
- **New file**: `e2e/navigation.spec.ts` — home loads, blog loads, admin loads, client navigation works
- **New file**: `e2e/admin-auth.spec.ts` — when permissions deny, 403 page renders (requires a way to toggle stubs — can use env var or skip initially)
- **New file**: `e2e/search.spec.ts` — type query, results appear, Escape closes, keyboard nav works

### 6.6 CI workflow
- **New file**: `.github/workflows/ci.yml`
- Jobs: `quality` (lint + typecheck + vitest), `build` (next build), `e2e` (depends on build, runs playwright)
- Node 22, pnpm, `--frozen-lockfile`, concurrency cancel-in-progress
- Upload Playwright report as artifact

**Checkpoint**: `pnpm check` passes. `pnpm test:e2e` passes. GitHub Actions runs on PR.

---

## Phase 7: README

**Goal**: Replace boilerplate with real documentation.

- **File**: `README.md`
- Sections: project overview, architecture (route groups, auth model, data layer), local dev setup, env vars, conventions (server-first, 'use client' budget), testing (`check`, `test:e2e`), deployment

---

## Implementation Order

| Step | Phase | Risk | Depends On |
|------|-------|------|------------|
| 1 | 1.1 authInterrupts | None | — |
| 2 | 1.2–1.3 auth DAL + DTOs | Low | — |
| 3 | 1.4 env module | None | — |
| 4 | 1.5 migrate permission consumers | Low | Step 2 |
| 5 | 2.1–2.3 route groups + layouts | Medium | Step 4 |
| 6 | 2.2 scope Providers to blog | Medium | Step 5 |
| 7 | 2.4 slim root layout | Medium | Step 5 |
| 8 | 3.1–3.3 SEO + not-found | Low | Step 7 |
| 9 | 4.1–4.3 search fixes | Low | — |
| 10 | 4.4 loading states | Low | — |
| 11 | 5.1–5.4 observability | Low | Step 7 |
| 12 | 6.1–6.6 testing + CI | Low | Step 7 |
| 13 | 7 README | None | All above |

Steps 1–3 can be done in parallel. Steps 9–10 can be done in parallel with 5–8.

---

## What NOT to do yet

- **proxy.ts**: No real auth provider yet — no cookies/tokens to validate at the edge. Add when real auth is wired in.
- **Zod env validation**: Manual validation is sufficient for zero env vars. Add Zod when real secrets appear.
- **`unauthorized()` / login flow**: No login page until a real auth provider is chosen.
- **`'use cache'` directives**: Config is enabled (`cacheComponents: true`) but all data is mock. Add cache directives when real data sources exist.
- **`unstable_instant`**: Useful for instant client navigation but requires stable routes first. Consider after route groups are settled.
- **OG image generation**: Defer until real content/branding exists.
- **Mobile nav**: Listed in original plan but deprioritized — the shell restructure (Phase 2) is the prerequisite. Can be added as a follow-up once route groups are in place.

---

## Verification

1. `pnpm build` — clean build, no type errors
2. `pnpm check` — lint + typecheck + unit tests pass
3. `pnpm test:e2e` — navigation, auth, search E2E tests pass
4. Manual: toggle `getSession()` to return `null` → admin routes show 403
5. Manual: `/nonexistent` shows not-found page
6. Manual: search handles rapid typing without stale results, shows empty state, supports keyboard nav
7. Deploy preview: Analytics and SpeedInsights components load
8. Deploy preview: error boundary errors appear as structured JSON in Vercel runtime logs

## Key Files (existing, to modify)

- `next.config.ts` — add authInterrupts
- `app/layout.tsx` — slim down, add Analytics/SpeedInsights
- `lib/permissions.ts` — delete after migration
- `lib/posts.ts`, `lib/tasks.ts`, `lib/search.ts` — update type imports to `data/dto.ts`
- `components/SideNavAdminLinks.tsx` — use `hasPermission`
- `components/SearchBox.tsx` — stale-request protection, empty state, keyboard nav
- `app/admin/site/page.tsx`, `app/admin/community/page.tsx` — use `verifyPermission`
- `app/error.tsx`, `app/global-error.tsx` — structured error logging
- `app/blog/page.tsx` — scope `<Providers>` inside page
- `package.json` — new scripts and dependencies

## Key Files (new)

- `data/auth.ts` — Session, Permission, verifyPermission, hasPermission
- `data/dto.ts` — shared DTO types
- `lib/env.ts`, `lib/env.client.ts` — env validation
- `app/(public)/layout.tsx` — pass-through
- `app/(app)/layout.tsx` — Toolbar + SideNav shell
- `app/(app)/admin/layout.tsx` — auth guard
- `app/not-found.tsx`, `app/robots.ts`, `app/sitemap.ts`
- `instrumentation.ts`
- `vitest.config.mts`, `playwright.config.ts`
- `lib/__tests__/search.test.ts`, `lib/__tests__/posts.test.ts`
- `e2e/navigation.spec.ts`, `e2e/search.spec.ts`, `e2e/admin-auth.spec.ts`
- `.github/workflows/ci.yml`
