"use client";

import { useQuery } from "@tanstack/react-query";
import { commentsQuery } from "@/lib/comments-query";

export function CommentsClientOnly({ postId }: { postId: string }) {
  const { data: comments, isLoading, error } = useQuery(
    commentsQuery(postId, "newest"),
  );

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        Pattern 3 &middot; React Query client-only (no server prefetch)
      </p>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Comments (client-only)
      </h2>

      {isLoading && (
        <div className="mt-4 grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
            />
          ))}
        </div>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-500">Failed to load comments</p>
      )}

      {comments && (
        <ul className="mt-4 grid gap-3">
          {comments.map((comment) => (
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
