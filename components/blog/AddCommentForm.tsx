"use client";

import { useState } from "react";
import type { NewCommentInput } from "@/data/dto";

export function AddCommentForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  onSubmit: (input: NewCommentInput) => Promise<void>;
}) {
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");

  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!author.trim() || !body.trim()) return;
        await onSubmit({ author: author.trim(), body: body.trim() });
        setAuthor("");
        setBody("");
      }}
    >
      <input
        type="text"
        placeholder="Your name"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        required
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      <textarea
        placeholder="Write a comment…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
        rows={2}
        className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="justify-self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
