# Foundation Hardening — Implementation Plan

## Overview

Turn the `menu-next` starter into a server-first, Vercel-native app with proper boundaries: public vs authenticated route groups, a typed auth DAL, scoped client state, real observability, and a quality gate.

## Current State Analysis

- **Root layout** wraps everything (including public routes) in `<Providers>` + `<Toolbar>` + `<SideNav>`
- **Auth**: `forbidden()` is called in admin pages but `authInterrupts` isn't enabled — it's dead code
- **Permissions**: Two separate `cache()`-wrapped stubs in `lib/permissions.ts`
- **Types**: Scattered across `lib/posts.ts`, `lib/tasks.ts`, `lib/search.ts`
- **Client state**: `QueryClientProvider` wraps entire app but only blog uses it
- **Search**: No stale-request protection, no empty-results state, no keyboard navigation
- **Metadata**: Boilerplate "Create Next App"
- **Testing/CI**: None
- **Analytics**: None

### Key Discoveries:
- `next.config.ts:3-7` — has `cacheComponents: true` but no `authInterrupts`
- `app/layout.tsx:25-33` — `<Providers>` wraps `<Toolbar>` + `<SideNav>` + children for every route
- `components/BlogPostList.tsx:35` — `useInfiniteQuery` is the only React Query consumer
- `lib/search.ts:1` — `"use server"` directive makes `searchContent` a server action
- `components/SearchBox.tsx:77` — `showDropdown` logic doesn't handle empty-results case

## Desired End State

A cleanly separated app with:
1. `(public)` routes (home, blog) with no auth shell
2. `(app)` routes (admin) wrapped in Toolbar + SideNav with auth guard
3. Typed auth DAL with `verifyPermission()` / `hasPermission()` backed by `forbidden()`
4. Shared DTO types in `data/dto.ts`
5. Blog-scoped `QueryClientProvider` (not app-wide)
6. Search with stale-request protection, empty state, keyboard nav
7. Real metadata, robots.txt, sitemap, not-found page
8. Vercel Analytics + Speed Insights
9. Vitest + Playwright + CI

### Verification:
1. `pnpm build` — clean build, no type errors
2. `pnpm check` — lint + typecheck + unit tests pass
3. `pnpm test:e2e` — navigation, auth, search tests pass
4. Toggle `getSession()` to return `null` → admin routes show 403
5. `/nonexistent` shows not-found page
6. Search handles rapid typing, shows empty state, supports keyboard nav

## What We're NOT Doing

- **proxy.ts**: No real auth provider yet — no cookies/tokens to validate
- **Zod env validation**: Manual validation is sufficient for zero env vars
- **`unauthorized()` / login flow**: No login page until a real auth provider is chosen
- **`'use cache'` directives**: All data is mock — add when real data sources exist
- **OG image generation**: Defer until real content/branding exists
- **Mobile nav**: Prerequisite (route groups) is in this plan; mobile nav is a follow-up

---

## Phase 1: Config & Auth Foundation

### Overview
Make `forbidden()` actually work and establish the auth type system.

### Changes Required:

#### 1.1 Enable authInterrupts
**File**: `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { authInterrupts: true },
};

export default nextConfig;
```

#### 1.2 Create typed auth DAL
**New file**: `data/auth.ts`

```ts
import "server-only";
import { cache } from "react";
import { forbidden } from "next/navigation";

export type Permission = "community:admin" | "site:admin";

export type Session = {
  userId: string;
  permissions: Permission[];
} | null;

/** Stub session — replace with real auth provider lookup. */
export const getSession = cache(async (): Promise<Session> => {
  return {
    userId: "user_1",
    permissions: ["community:admin", "site:admin"],
  };
});

/** For conditional UI (e.g., sidebar links). */
export async function hasPermission(p: Permission): Promise<boolean> {
  const session = await getSession();
  return session?.permissions.includes(p) ?? false;
}

/** For route protection — calls forbidden() if denied. */
export async function verifyPermission(p: Permission): Promise<void> {
  const allowed = await hasPermission(p);
  if (!allowed) forbidden();
}
```

#### 1.3 Create shared DTO types
**New file**: `data/dto.ts`

```ts
export type Post = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  readTime: string;
  category: string;
};

export type PostsPage = {
  posts: Post[];
  nextCursor: number | null;
};

export type Task = {
  id: string;
  title: string;
  status: "pending" | "done";
};

export type SearchResult = {
  id: string;
  title: string;
  description: string;
  href: string;
};
```

**Update imports** in consumers:

`lib/posts.ts` — remove `Post` and `PostsPage` type definitions, add:
```ts
import type { Post, PostsPage } from "@/data/dto";
```

`lib/tasks.ts` — remove `Task` type definition, add:
```ts
import type { Task } from "@/data/dto";
```

`lib/search.ts` — remove `SearchResult` type definition, add:
```ts
import type { SearchResult } from "@/data/dto";
```

`lib/actions.ts` — update import:
```ts
import type { PostsPage } from "@/data/dto";
```

`components/SearchBox.tsx` — update import:
```ts
import { searchContent } from "@/lib/search";
import type { SearchResult } from "@/data/dto";
```

#### 1.4 Create env modules
**New file**: `lib/env.ts`

```ts
import "server-only";

export function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export function optional(key: string, fallback: string = ""): string {
  return process.env[key] ?? fallback;
}
```

**New file**: `lib/env.client.ts`

```ts
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
```

#### 1.5 Migrate consumers off `lib/permissions.ts`

**File**: `components/SideNavAdminLinks.tsx`
```ts
import Link from "next/link";
import { hasPermission } from "@/data/auth";

const linkClass =
  "block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

export async function SideNavAdminLinks() {
  const [communityAdmin, siteAdmin] = await Promise.all([
    hasPermission("community:admin"),
    hasPermission("site:admin"),
  ]);

  return (
    <>
      {communityAdmin && (
        <Link href="/admin/community" className={linkClass}>
          Community Admin
        </Link>
      )}
      {siteAdmin && (
        <Link href="/admin/site" className={linkClass}>
          Site Admin
        </Link>
      )}
    </>
  );
}
```

**File**: `app/admin/site/page.tsx` — replace permission check:
```ts
import { verifyPermission } from "@/data/auth";
// Remove: import { getSiteAdminAllowed } from "@/lib/permissions";

export default async function SiteAdminPage() {
  await verifyPermission("site:admin");
  // ... rest unchanged
}
```

**File**: `app/admin/community/page.tsx` — same pattern:
```ts
import { verifyPermission } from "@/data/auth";
// Remove: import { getCommunityAdminAllowed } from "@/lib/permissions";

export default async function CommunityAdminPage() {
  await verifyPermission("community:admin");
  // ... rest unchanged
}
```

**Delete**: `lib/permissions.ts`

### Success Criteria:

#### Automated Verification:
- [x] `pnpm build` passes with no type errors
- [x] `pnpm lint` passes
- [x] No imports of `lib/permissions` remain: `grep -r "lib/permissions" --include="*.ts" --include="*.tsx"`

#### Manual Verification:
- [x] Toggle `getSession()` return to `null` → admin routes show 403
- [x] Toggle back → admin routes load normally
- [x] Sidebar links appear/disappear based on session

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Route Groups & Shell Restructure

### Overview
Split app into `(public)` and `(app)` route groups. Root layout becomes lean. QueryClientProvider scoped to blog only.

### Changes Required:

#### 2.1 Create `(public)` route group

**Move files**:
- `app/page.tsx` → `app/(public)/page.tsx`
- `app/loading.tsx` → `app/(public)/loading.tsx`
- `app/blog/` → `app/(public)/blog/` (entire directory)

**New file**: `app/(public)/layout.tsx`
```ts
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

#### 2.2 Scope `<Providers>` to blog page

**File**: `app/(public)/blog/page.tsx` — wrap HydrationBoundary inside Providers:
```ts
import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getPostsPage } from "@/lib/posts";
import { BlogPostList } from "@/components/BlogPostList";
import { BlogPostListSkeleton } from "@/components/BlogPostListSkeleton";
import { Providers } from "@/components/Providers";

export const metadata = {
  title: "Blog",
  description: "Blog posts and articles.",
};

async function PrefetchedBlogPostList() {
  const queryClient = new QueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: ["posts"],
    queryFn: ({ pageParam }) => getPostsPage(pageParam),
    initialPageParam: 0,
  });

  return (
    <Providers>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <BlogPostList />
      </HydrationBoundary>
    </Providers>
  );
}

export default function BlogPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col p-8 pb-0">
      <h1 className="shrink-0 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Blog
      </h1>
      <p className="mt-2 shrink-0 text-zinc-600 dark:text-zinc-400">
        Blog content goes here.
      </p>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<BlogPostListSkeleton />}>
          <PrefetchedBlogPostList />
        </Suspense>
      </div>
    </div>
  );
}
```

#### 2.3 Create `(app)` route group with shell layout

**New file**: `app/(app)/layout.tsx`
```ts
import { Toolbar } from "@/components/Toolbar";
import { SideNav } from "@/components/SideNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Toolbar />
      <div className="flex min-h-0 flex-1">
        <SideNav />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {children}
        </div>
      </div>
    </>
  );
}
```

**New file**: `app/(app)/admin/layout.tsx`
```ts
import { getSession } from "@/data/auth";
import { forbidden } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) forbidden();
  return children;
}
```

**Move files**:
- `app/admin/` → `app/(app)/admin/` (site/ and community/ with their pages + loading files)
- `app/api/tasks/count/` → `app/(app)/api/tasks/count/`

#### 2.4 Slim down root layout

**File**: `app/layout.tsx`
```ts
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex h-full flex-col">{children}</body>
    </html>
  );
}
```

Remove imports of `Providers`, `Toolbar`, `SideNav`. (Metadata updated in Phase 3.)

#### 2.5 Keep shared error files at root
`app/error.tsx`, `app/global-error.tsx`, `app/forbidden.tsx` stay at root — no changes needed.

### Result directory structure:
```
app/
  layout.tsx              ← lean: html, body, fonts
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
  auth.ts
  dto.ts
lib/
  posts.ts / tasks.ts / search.ts / actions.ts
  simulate-page-load.ts
  env.ts / env.client.ts
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] No imports of `Providers`, `Toolbar`, or `SideNav` in `app/layout.tsx`

#### Manual Verification:
- [ ] All routes load at same URLs (`/`, `/blog`, `/admin/site`, `/admin/community`)
- [ ] Navigation between public and app routes works without full-page reloads
- [ ] Blog infinite scroll still works
- [ ] Home page loads without Toolbar/SideNav
- [ ] Admin pages load with Toolbar/SideNav
- [ ] Admin 403 works when session is null

**Implementation Note**: Pause for manual verification after this phase — route group changes are the highest-risk restructure.

---

## Phase 3: SEO & Not-Found

### Overview
Replace template metadata, add proper SEO files, add not-found.

### Changes Required:

#### 3.1 Root metadata with template
**File**: `app/layout.tsx` — update metadata:
```ts
import { SITE_URL } from "@/lib/env.client";

export const metadata: Metadata = {
  title: { default: "Menu", template: "%s | Menu" },
  description: "A server-first Next.js starter with proper boundaries.",
  metadataBase: new URL(SITE_URL),
};
```

#### 3.2 Add SEO files

**New file**: `app/robots.ts`
```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env.client";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
```

**New file**: `app/sitemap.ts`
```ts
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/env.client";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: new Date() },
    { url: `${SITE_URL}/blog`, lastModified: new Date() },
    { url: `${SITE_URL}/admin/site`, lastModified: new Date() },
    { url: `${SITE_URL}/admin/community`, lastModified: new Date() },
  ];
}
```

**New file**: `app/not-found.tsx`
```ts
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Page Not Found
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Go home
      </Link>
    </div>
  );
}
```

#### 3.3 Update page metadata

**File**: `app/(public)/page.tsx` — update metadata:
```ts
export const metadata = {
  title: "Home",
  description: "Welcome to Menu — a server-first Next.js starter.",
};
```

Admin pages already have decent metadata (`"Site Admin"`, `"Community Admin"`). Blog has `"Blog"`. Leave those as-is.

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Page source shows `<title>Home | Menu</title>` on home, `<title>Blog | Menu</title>` on blog
- [ ] `/nonexistent` shows "Page Not Found" with link home
- [ ] `/robots.txt` returns valid robots file
- [ ] `/sitemap.xml` returns valid sitemap

---

## Phase 4: Search & UX Fixes

### Overview
Fix search edge cases, add empty states, improve loading states.

### Changes Required:

#### 4.1–4.3 SearchBox overhaul
**File**: `components/SearchBox.tsx` — full replacement:

```tsx
"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
} from "react";
import Link from "next/link";
import { searchContent } from "@/lib/search";
import type { SearchResult } from "@/data/dto";

const DEBOUNCE_MS = 300;

export function SearchBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeIndex, setActiveIndex] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = "search-results-listbox";

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(-1);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      const id = ++requestRef.current;
      startTransition(async () => {
        const hits = await searchContent(value);
        if (requestRef.current === id) {
          setResults(hits);
          setOpen(true);
        }
      });
    }, DEBOUNCE_MS);
  }, []);

  function handleResultClick() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!showDropdown) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < results.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : results.length - 1,
      );
    } else if (e.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      e.preventDefault();
      const result = results[activeIndex];
      handleResultClick();
      window.location.href = result.href;
    }
  }

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0) return;
    const el = document.getElementById(`search-result-${activeIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const hasQuery = query.trim().length > 0;
  const showDropdown =
    open && (results.length > 0 || isPending || (hasQuery && results.length === 0));

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
            clipRule="evenodd"
          />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
          }
          placeholder="Search…"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          className="h-7 w-44 rounded-md border border-zinc-200 bg-white pl-8 pr-3 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
        />
        {isPending && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
          </div>
        )}
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 max-h-64 w-72 overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {isPending && results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-400">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-400">
              No results found
            </li>
          ) : (
            results.map((result, index) => (
              <li
                key={result.id}
                id={`search-result-${index}`}
                role="option"
                aria-selected={index === activeIndex}
              >
                <Link
                  href={result.href}
                  onClick={handleResultClick}
                  className={`block px-3 py-2 transition-colors ${
                    index === activeIndex
                      ? "bg-zinc-100 dark:bg-zinc-800"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="block text-xs font-medium text-zinc-900 dark:text-zinc-100">
                    {result.title}
                  </span>
                  <span className="block text-[11px] text-zinc-500 dark:text-zinc-400">
                    {result.description}
                  </span>
                </Link>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
```

Key changes:
- **Stale-request protection** (`requestRef`): increments on each search, only applies results if the counter still matches
- **Empty-results state**: shows "No results found" when query is non-empty and results are empty
- **Keyboard navigation**: ArrowUp/Down cycle through results, Enter navigates, active item highlighted and scrolled into view
- **`aria-activedescendant`**: proper accessibility for keyboard nav

#### 4.4 Loading states
**File**: `components/PageLoadingFallback.tsx` — replace "Loading..." with a skeleton:

```tsx
export function PageLoadingFallback() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-8">
      <div className="h-7 w-48 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-80 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </div>
  );
}
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Rapid typing in search doesn't show stale results
- [ ] Searching for nonsense (e.g., "zzzzz") shows "No results found"
- [ ] Arrow keys navigate results, Enter selects, active item is highlighted
- [ ] Escape closes dropdown
- [ ] Loading states show skeleton instead of "Loading..." text

---

## Phase 5: Observability

### Overview
Add Vercel Analytics, Speed Insights, and structured error logging.

### Changes Required:

#### 5.1 Install packages

```bash
pnpm add @vercel/analytics @vercel/speed-insights
```

#### 5.2 Add to root layout
**File**: `app/layout.tsx` — add after `{children}`:

```tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Inside <body>:
<body className="flex h-full flex-col">
  {children}
  <Analytics />
  <SpeedInsights />
</body>
```

#### 5.3 Add instrumentation.ts
**New file**: `instrumentation.ts` (project root)

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Future: add @vercel/otel here when ready
    // const { registerOTel } = await import("@vercel/otel");
    // registerOTel("menu-next");
  }
}
```

#### 5.4 Wire error boundaries to structured logging

**File**: `app/error.tsx` — add useEffect for structured logging:
```tsx
"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        level: "error",
        msg: "client-error",
        error: error.message,
        digest: error.digest,
      }),
    );
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Try again
      </button>
    </div>
  );
}
```

**File**: `app/global-error.tsx` — same pattern (add `useEffect` with `console.error` JSON).

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes

#### Manual Verification:
- [ ] Deploy preview: Analytics and Speed Insights components load (check network tab for requests)
- [ ] Error boundary errors appear as structured JSON in browser console / Vercel runtime logs

---

## Phase 6: Testing Infrastructure

### Overview
Vitest for units, Playwright for E2E, quality-gate scripts.

### Changes Required:

#### 6.1 Install test dependencies

```bash
pnpm add -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom @playwright/test
```

#### 6.2 Vitest config
**New file**: `vitest.config.mts`

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
```

#### 6.3 Package.json scripts
**File**: `package.json` — add scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "check": "pnpm lint && pnpm typecheck && pnpm test"
  }
}
```

#### 6.4 Unit tests

**New file**: `lib/__tests__/search.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { searchContent } from "@/lib/search";

describe("searchContent", () => {
  it("returns matching results for exact title", async () => {
    const results = await searchContent("Home");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.title === "Home")).toBe(true);
  });

  it("returns matching results for partial query", async () => {
    const results = await searchContent("blog");
    expect(results.length).toBeGreaterThan(0);
  });

  it("is case insensitive", async () => {
    const lower = await searchContent("home");
    const upper = await searchContent("HOME");
    expect(lower).toEqual(upper);
  });

  it("returns empty array for no matches", async () => {
    const results = await searchContent("zzzznonexistent");
    expect(results).toEqual([]);
  });

  it("returns empty array for empty query", async () => {
    const results = await searchContent("");
    expect(results).toEqual([]);
  });

  it("returns empty array for whitespace query", async () => {
    const results = await searchContent("   ");
    expect(results).toEqual([]);
  });
});
```

**New file**: `lib/__tests__/posts.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";

// Mock server-only (it throws when imported in non-server context)
vi.mock("server-only", () => ({}));

// Mock next/server connection()
vi.mock("next/server", () => ({
  connection: vi.fn().mockResolvedValue(undefined),
}));

// Must import after mocks
const { getPostsPage } = await import("@/lib/posts");

describe("getPostsPage", () => {
  it("returns first page with default size", async () => {
    const page = await getPostsPage(0);
    expect(page.posts).toHaveLength(20);
    expect(page.nextCursor).toBe(20);
    expect(page.posts[0].id).toBe("1");
  });

  it("returns correct page for cursor", async () => {
    const page = await getPostsPage(20, 10);
    expect(page.posts).toHaveLength(10);
    expect(page.posts[0].id).toBe("21");
    expect(page.nextCursor).toBe(30);
  });

  it("returns null nextCursor on last page", async () => {
    const page = await getPostsPage(190, 20);
    expect(page.posts).toHaveLength(10);
    expect(page.nextCursor).toBeNull();
  });

  it("returns empty array when cursor is beyond data", async () => {
    const page = await getPostsPage(500);
    expect(page.posts).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
  });
});
```

#### 6.5 Playwright config

**New file**: `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

**New file**: `e2e/navigation.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Menu/);
});

test("blog page loads", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();
});

test("admin site page loads", async ({ page }) => {
  await page.goto("/admin/site");
  await expect(
    page.getByRole("heading", { name: "Site Admin" }),
  ).toBeVisible();
});

test("admin community page loads", async ({ page }) => {
  await page.goto("/admin/community");
  await expect(
    page.getByRole("heading", { name: "Community Admin" }),
  ).toBeVisible();
});

test("client navigation between routes works", async ({ page }) => {
  await page.goto("/");
  // Navigate to blog via sidebar (only visible in (app) routes)
  // or via direct URL for public routes
  await page.goto("/blog");
  await expect(page.getByRole("heading", { name: "Blog" })).toBeVisible();
});
```

**New file**: `e2e/search.spec.ts`

```ts
import { test, expect } from "@playwright/test";

test("search shows results", async ({ page }) => {
  await page.goto("/admin/site");
  const input = page.getByPlaceholder("Search…");
  await input.fill("blog");
  await expect(page.getByRole("listbox")).toBeVisible();
});

test("Escape closes search dropdown", async ({ page }) => {
  await page.goto("/admin/site");
  const input = page.getByPlaceholder("Search…");
  await input.fill("blog");
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("Escape");
  await expect(page.getByRole("listbox")).not.toBeVisible();
});

test("empty search shows no results message", async ({ page }) => {
  await page.goto("/admin/site");
  const input = page.getByPlaceholder("Search…");
  await input.fill("zzzznonexistent");
  await expect(page.getByText("No results found")).toBeVisible();
});

test("keyboard navigation works", async ({ page }) => {
  await page.goto("/admin/site");
  const input = page.getByPlaceholder("Search…");
  await input.fill("admin");
  await expect(page.getByRole("listbox")).toBeVisible();
  await input.press("ArrowDown");
  const firstOption = page.getByRole("option").first();
  await expect(firstOption).toHaveAttribute("aria-selected", "true");
});
```

#### 6.6 CI workflow

**New file**: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  e2e:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

### Success Criteria:

#### Automated Verification:
- [ ] `pnpm check` passes (lint + typecheck + vitest)
- [ ] `pnpm test:e2e` passes

#### Manual Verification:
- [ ] GitHub Actions runs on PR and all jobs pass

---

## Phase 7: README

### Overview
Replace boilerplate with real documentation.

### Changes Required:

**File**: `README.md` — replace with sections:
- Project overview
- Architecture (route groups, auth model, data layer)
- Local dev setup
- Env vars
- Conventions (server-first, `'use client'` budget)
- Testing (`pnpm check`, `pnpm test:e2e`)
- Deployment

### Success Criteria:
- [ ] README describes the actual project, not "Create Next App"

---

## Implementation Order

| Step | Phase | Risk | Depends On |
|------|-------|------|------------|
| 1 | 1.1 authInterrupts | None | — |
| 2 | 1.2–1.3 auth DAL + DTOs | Low | — |
| 3 | 1.4 env module | None | — |
| 4 | 1.5 migrate permission consumers | Low | Step 2 |
| 5 | 2.1–2.3 route groups + layouts | **Medium** | Step 4 |
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

## References

- Source plan: `PLAN.md`
- `next.config.ts:3-7` — current config
- `app/layout.tsx:25-33` — current root layout with full shell
- `lib/permissions.ts` — to be deleted
- `components/SearchBox.tsx` — full overhaul in Phase 4
