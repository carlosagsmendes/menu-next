import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Providers } from "@/components/Providers";
import { CommentsClientOnly } from "@/components/blog/CommentsClientOnly";
import { CommentsClientNoSuspense } from "@/components/blog/CommentsClientNoSuspense";
import { CommentsErrorBoundary } from "@/components/blog/CommentsErrorBoundary";
import { PostContentNoSuspense } from "@/components/blog/PostContentNoSuspense";
import { RelatedPostsNoSuspense } from "@/components/blog/RelatedPostsNoSuspense";
import type { CommentSort } from "@/data/dto";
import { commentsQueryKey } from "@/lib/comments-query";
import {
  getCommentsServer,
  getPost,
  getRelatedPosts,
} from "@/lib/posts";
import { startBenchmarkRequest } from "@/lib/perf/request-metrics";
import { makeQueryClient } from "@/lib/query-client";

export default async function BlogNoStreamingPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const benchmarkRequest = startBenchmarkRequest({
    routeLabel: "/blog-no-streaming/[id]",
    phase: "page",
  });

  await connection();

  const { id } = await params;
  benchmarkRequest.update({ entityId: id });
  const queryClient = makeQueryClient();
  const sort: CommentSort = "newest";

  const postPromise = getPost(id);
  const relatedPostsPromise = getRelatedPosts(id);
  const commentsPromise = queryClient.prefetchQuery({
    queryKey: commentsQueryKey(id, sort),
    queryFn: () => getCommentsServer(id, sort),
  });

  const [post, relatedPosts] = await Promise.all([
    postPromise,
    relatedPostsPromise,
  ]);
  await commentsPromise;

  if (!post) {
    benchmarkRequest.markOutcome("not-found");
    notFound();
  }

  return (
    <div
      className="mx-auto max-w-3xl space-y-8 p-8"
      data-perf-page="blog-detail-no-streaming"
      data-perf-post-id={id}
      data-perf-route-mode="partial-prerender"
    >
      <PostContentNoSuspense post={post} />
      <RelatedPostsNoSuspense relatedPosts={relatedPosts} />

      <Providers>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CommentsErrorBoundary>
            <CommentsClientNoSuspense postId={id} initialSort={sort} />
          </CommentsErrorBoundary>
        </HydrationBoundary>
      </Providers>

      <Providers>
        <CommentsClientOnly postId={id} />
      </Providers>
    </div>
  );
}
