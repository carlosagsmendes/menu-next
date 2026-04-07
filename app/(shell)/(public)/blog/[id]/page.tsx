import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Providers } from "@/components/Providers";
import { PostContent } from "@/components/blog/PostContent";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { RelatedPostsSkeleton } from "@/components/blog/RelatedPostsSkeleton";
import { CommentsSkeleton } from "@/components/blog/CommentsSkeleton";
import { CommentsShell } from "@/components/blog/CommentsShell";
import { CommentsClientOnly } from "@/components/blog/CommentsClientOnly";
import { getPost, getRelatedPosts } from "@/lib/posts";
import { startBenchmarkRequest } from "@/lib/perf/request-metrics";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const benchmarkRequest = startBenchmarkRequest({
    routeLabel: "/blog/[id]",
    phase: "page",
  });
  const { id } = await params;
  benchmarkRequest.update({ entityId: id });

  // Kick off both fetches in parallel
  const postPromise = getPost(id);
  const relatedPostsPromise = getRelatedPosts(id);

  // Await the post (fast, ~200ms) — blocks initial render
  const post = await postPromise;

  if (!post) {
    benchmarkRequest.markOutcome("not-found");
    notFound();
  }

  return (
    <div
      className="mx-auto max-w-3xl space-y-8 p-8"
      data-perf-page="blog-detail"
      data-perf-post-id={id}
      data-perf-route-mode="partial-prerender"
    >
      {/* ── Pattern 1: Pure server-side (awaited, no client JS) ── */}
      <PostContent post={post} />

      {/* ── Pattern 1: Server-side streamed via Suspense ── */}
      <Suspense fallback={<RelatedPostsSkeleton />}>
        <RelatedPosts relatedPostsPromise={relatedPostsPromise} />
      </Suspense>

      {/* ── Pattern 2: React Query + Suspense (server-prefetched) ── */}
      <Providers>
        <Suspense fallback={<CommentsSkeleton />}>
          <CommentsShell postId={id} />
        </Suspense>
      </Providers>

      {/* ── Pattern 3: React Query client-only (no server prefetch) ── */}
      <Providers>
        <CommentsClientOnly postId={id} />
      </Providers>
    </div>
  );
}
