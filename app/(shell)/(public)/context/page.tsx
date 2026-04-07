import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { Providers } from "@/components/Providers";
import { BlogPostList } from "@/components/BlogPostList";
import { BlogPostListSkeleton } from "@/components/BlogPostListSkeleton";
import { AuthDebugPanel, AuthDedupeProof } from "@/components/AuthDebugPanel";
import { getPostsPage } from "@/lib/posts";
import { startBenchmarkRequest } from "@/lib/perf/request-metrics";
import { postsQueryKey } from "@/lib/posts-query";
import { makeQueryClient } from "@/lib/query-client";

export const metadata = {
  title: "Context",
  description: "Server Components and streaming experiments.",
};

async function PrefetchedContextPostList() {
  const queryClient = makeQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: postsQueryKey,
    queryFn: ({ pageParam }) => getPostsPage(pageParam),
    initialPageParam: 0,
  });

  return (
    <Providers>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <BlogPostList detailHrefBase="/context" />
      </HydrationBoundary>
    </Providers>
  );
}

export default function ContextPage() {
  startBenchmarkRequest({
    routeLabel: "/context",
    phase: "page",
  });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col p-8 pb-0"
      data-perf-page="context-list"
      data-perf-route-mode="partial-prerender"
    >
      <h1 className="shrink-0 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Context
      </h1>
      <p className="mt-2 shrink-0 text-zinc-600 dark:text-zinc-400">
        Server Components and streaming experiments live here.
      </p>
      <div className="mt-6 grid gap-4">
        <Suspense fallback={null}>
          <AuthDebugPanel />
          <AuthDedupeProof />
        </Suspense>
      </div>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<BlogPostListSkeleton />}>
          <PrefetchedContextPostList />
        </Suspense>
      </div>
    </div>
  );
}
