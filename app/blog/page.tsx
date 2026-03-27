import { Suspense } from "react";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { getPostsPage } from "@/lib/posts";
import { BlogPostList } from "@/components/BlogPostList";
import { BlogPostListSkeleton } from "@/components/BlogPostListSkeleton";

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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <BlogPostList />
    </HydrationBoundary>
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
