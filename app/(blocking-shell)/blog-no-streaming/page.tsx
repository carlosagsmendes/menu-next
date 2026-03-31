import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { connection } from "next/server";

import { Providers } from "@/components/Providers";
import { BlogPostListNoSuspense } from "@/components/BlogPostListNoSuspense";
import { getPostsPage } from "@/lib/posts";
import { startBenchmarkRequest } from "@/lib/perf/request-metrics";
import { makeQueryClient } from "@/lib/query-client";
import { postsQueryKey } from "@/lib/posts-query";

export const metadata = {
  title: "Blog (No Streaming)",
  description: "Blog posts rendered without Suspense or streaming.",
};

export default async function BlogNoStreamingPage() {
  startBenchmarkRequest({
    routeLabel: "/blog-no-streaming",
    phase: "page",
  });

  await connection();

  const queryClient = makeQueryClient();

  await queryClient.prefetchInfiniteQuery({
    queryKey: postsQueryKey,
    queryFn: ({ pageParam }) => getPostsPage(pageParam),
    initialPageParam: 0,
  });

  return (
    <div
      className="flex min-h-0 flex-1 flex-col p-8 pb-0"
      data-perf-page="blog-list-no-streaming"
      data-perf-route-mode="dynamic"
    >
      <h1 className="shrink-0 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Blog (No Streaming)
      </h1>
      <p className="mt-2 shrink-0 text-zinc-600 dark:text-zinc-400">
        This version blocks on the initial server render and avoids Suspense.
      </p>
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <Providers>
          <HydrationBoundary state={dehydrate(queryClient)}>
            <BlogPostListNoSuspense />
          </HydrationBoundary>
        </Providers>
      </div>
    </div>
  );
}
