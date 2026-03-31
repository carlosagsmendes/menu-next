import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Providers } from "@/components/Providers";
import { PostContent } from "@/components/blog/PostContent";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { CommentsShell } from "@/components/blog/CommentsShell";
import { CommentsClientOnly } from "@/components/blog/CommentsClientOnly";
import { getPost, getRelatedPosts } from "@/lib/posts";

function RelatedPostsSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        Pattern 1 &middot; Server-side streamed via Suspense
      </p>
      <div className="mb-4 h-5 w-32 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />

      <ul className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
          >
            <div className="h-4 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CommentsSkeleton() {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Pattern 2 &middot; React Query + Suspense (server-prefetched)
          </p>
          <div className="h-5 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
          <div className="h-8 w-20 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
        </div>
      </div>

      {/* Form placeholder */}
      <div className="mt-4 grid gap-3">
        <div className="h-9 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
        <div className="h-9 w-28 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-700" />
      </div>

      {/* Comment card placeholders */}
      <ul className="mt-4 grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
              <div className="h-3 w-24 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            </div>
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Kick off both fetches in parallel
  const postPromise = getPost(id);
  const relatedPostsPromise = getRelatedPosts(id);

  // Await the post (fast, ~200ms) — blocks initial render
  const post = await postPromise;

  if (!post) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      {/* ── Pattern 1: Pure server-side (awaited, no client JS) ── */}
      <PostContent post={post} />

      {/* ── Pattern 1: Server-side streamed via Suspense ── */}
      <Suspense fallback={<RelatedPostsSkeleton />}>
        <RelatedPosts relatedPostsPromise={relatedPostsPromise} />
      </Suspense>

      <Providers>
        {/* ── Pattern 2: React Query + Suspense (server-prefetched) ── */}
        <Suspense fallback={<CommentsSkeleton />}>
          <CommentsShell postId={id} />
        </Suspense>

        {/* ── Pattern 3: React Query client-only (no server prefetch) ── */}
        <CommentsClientOnly postId={id} />
      </Providers>
    </div>
  );
}
