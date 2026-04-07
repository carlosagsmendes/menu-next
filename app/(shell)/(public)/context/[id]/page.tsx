import { Suspense } from "react";
import { notFound } from "next/navigation";

import { Providers } from "@/components/Providers";
import { CommentsClientOnly } from "@/components/blog/CommentsClientOnly";
import { CommentsShell } from "@/components/blog/CommentsShell";
import { CommentsSkeleton } from "@/components/blog/CommentsSkeleton";
import { PostContent } from "@/components/blog/PostContent";
import { RelatedPosts } from "@/components/blog/RelatedPosts";
import { RelatedPostsSkeleton } from "@/components/blog/RelatedPostsSkeleton";
import {
  ContextClientLikesDemo,
  ContextLikesProvider,
  ContextTitleLikesControl,
} from "@/components/context/ContextLikes";
import { AuthDiagnostics } from "@/components/AuthDebugPanel";
import { getPost, getRelatedPosts } from "@/lib/posts";
import { startBenchmarkRequest } from "@/lib/perf/request-metrics";

export default async function ContextPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const benchmarkRequest = startBenchmarkRequest({
    routeLabel: "/context/[id]",
    phase: "page",
  });
  const { id } = await params;
  benchmarkRequest.update({ entityId: id });

  const postPromise = getPost(id);
  const relatedPostsPromise = getRelatedPosts(id);
  const post = await postPromise;

  if (!post) {
    benchmarkRequest.markOutcome("not-found");
    notFound();
  }

  return (
    <div
      className="mx-auto max-w-3xl space-y-8 p-8"
      data-perf-page="context-detail"
      data-perf-post-id={id}
      data-perf-route-mode="partial-prerender"
    >
      <ContextLikesProvider initialLikes={post.likes} postId={id}>
        <PostContent
          post={post}
          backHref="/context"
          backLabel="Back to context"
          titleAccessory={<ContextTitleLikesControl />}
        />
        <ContextClientLikesDemo />
      </ContextLikesProvider>

      <Suspense fallback={<RelatedPostsSkeleton />}>
        <RelatedPosts
          relatedPostsPromise={relatedPostsPromise}
          detailHrefBase="/context"
        />
      </Suspense>

      <Providers>
        <Suspense fallback={<CommentsSkeleton />}>
          <CommentsShell postId={id} />
        </Suspense>
      </Providers>

      <Providers>
        <CommentsClientOnly postId={id} />
      </Providers>

      <AuthDiagnostics />
    </div>
  );
}
