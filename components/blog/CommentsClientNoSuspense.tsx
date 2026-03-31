"use client";

import { startTransition, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { AddCommentForm } from "@/components/blog/AddCommentForm";
import { commentsQuery } from "@/lib/comments-query";
import type { Comment, CommentSort, NewCommentInput } from "@/data/dto";

async function createComment(
  postId: string,
  input: NewCommentInput,
): Promise<Comment> {
  const response = await fetch(`/api/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Failed to create comment");
  }

  return (await response.json()) as Comment;
}

function CommentsListSkeleton() {
  return (
    <div className="mt-4 grid gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
        />
      ))}
    </div>
  );
}

export function CommentsClientNoSuspense({
  postId,
  initialSort,
}: {
  postId: string;
  initialSort: CommentSort;
}) {
  const [sort, setSort] = useState<CommentSort>(initialSort);
  const queryClient = useQueryClient();
  const { data: comments, error, isFetching, isLoading } = useQuery(
    commentsQuery(postId, sort),
  );

  if (error && !isFetching) {
    throw error;
  }

  const addCommentMutation = useMutation({
    mutationFn: (input: NewCommentInput) => createComment(postId, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["post", postId, "comments"],
      });
    },
  });

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Pattern 2 &middot; React Query (server-prefetched, no Suspense)
          </p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Comments
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => startTransition(() => setSort("newest"))}
            disabled={sort === "newest"}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              sort === "newest"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            Newest
          </button>
          <button
            type="button"
            onClick={() => startTransition(() => setSort("oldest"))}
            disabled={sort === "oldest"}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              sort === "oldest"
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            Oldest
          </button>
          {isFetching && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Refreshing…
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <AddCommentForm
          isPending={addCommentMutation.isPending}
          onSubmit={async (input) => {
            await addCommentMutation.mutateAsync(input);
          }}
        />
      </div>

      {isLoading && !comments ? (
        <CommentsListSkeleton />
      ) : (
        <ul className="mt-4 grid gap-3">
          {comments?.map((comment) => (
            <li
              key={comment.id}
              className="rounded-lg border border-zinc-100 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {comment.author}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {comment.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
