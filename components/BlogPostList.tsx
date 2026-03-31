"use client";

import { useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fetchPostsPageAction } from "@/lib/actions";
import { postsQueryKey } from "@/lib/posts-query";

const CATEGORY_COLORS: Record<string, string> = {
  Engineering:
    "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Design:
    "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Product:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Culture:
    "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  Infrastructure:
    "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Security:
    "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  Performance:
    "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "Open Source":
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function BlogPostList() {
  const parentRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuspenseInfiniteQuery({
    queryKey: postsQueryKey,
    queryFn: ({ pageParam }) => fetchPostsPageAction(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const allPosts = useMemo(
    () => data.pages.flatMap((page) => page.posts),
    [data],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- opted out of memoization; TanStack Virtual returns unstable refs by design
  const virtualizer = useVirtualizer({
    count: hasNextPage ? allPosts.length + 1 : allPosts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem) return;

    if (
      lastItem.index >= allPosts.length - 1 &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [virtualItems, allPosts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualItems.map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allPosts.length - 1;
          const post = allPosts[virtualRow.index];

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {isLoaderRow ? (
                <div className="flex justify-center py-6 text-sm text-zinc-400 dark:text-zinc-500">
                  Loading more…
                </div>
              ) : (
                <article className="mx-auto max-w-3xl border-b border-zinc-200 px-2 py-5 dark:border-zinc-800">
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}
                    >
                      {post.category}
                    </span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {post.readTime} read
                    </span>
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                    <Link href={`/blog/${post.id}`} className="hover:underline">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {post.excerpt}
                  </p>
                  <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                    {post.author} &middot; {post.date}
                  </p>
                </article>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
