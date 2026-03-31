import { queryOptions } from "@tanstack/react-query";
import type { Comment, CommentSort } from "@/data/dto";

export function commentsQueryKey(postId: string, sort: CommentSort = "newest") {
  return ["post", postId, "comments", sort] as const;
}

async function fetchComments(postId: string, sort: CommentSort): Promise<Comment[]> {
  const response = await fetch(`/api/posts/${postId}/comments?sort=${sort}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch comments");
  }

  return (await response.json()) as Comment[];
}

export function commentsQuery(postId: string, sort: CommentSort = "newest") {
  return queryOptions({
    queryKey: commentsQueryKey(postId, sort),
    queryFn: () => fetchComments(postId, sort),
  });
}
