import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getCommentsServer } from "@/lib/posts";
import { commentsQueryKey } from "@/lib/comments-query";
import { CommentsErrorBoundary } from "@/components/blog/CommentsErrorBoundary";
import { CommentsClient } from "@/components/blog/CommentsClient";
import { makeQueryClient } from "@/lib/query-client";
import type { CommentSort } from "@/data/dto";

export function CommentsShell({ postId }: { postId: string }) {
  const queryClient = makeQueryClient();
  const sort: CommentSort = "newest";

  // No await — pending query streams to the client via HydrationBoundary.
  // See makeQueryClient() JSDoc for mechanism details.
  queryClient.prefetchQuery({
    queryKey: commentsQueryKey(postId, sort),
    queryFn: () => getCommentsServer(postId, sort),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommentsErrorBoundary>
        <CommentsClient postId={postId} initialSort={sort} />
      </CommentsErrorBoundary>
    </HydrationBoundary>
  );
}
