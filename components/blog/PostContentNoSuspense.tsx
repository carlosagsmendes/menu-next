import Link from "next/link";

import type { PostDetail } from "@/data/dto";

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  Design: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  Product: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Culture: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  Infrastructure: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Security: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  Performance: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300",
  "Open Source": "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function PostContentNoSuspense({ post }: { post: PostDetail }) {
  return (
    <article>
      <Link
        href="/blog-no-streaming"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        &larr; Back to blog
      </Link>

      <div className="mb-4 flex items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[post.category] ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"}`}
        >
          {post.category}
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {post.readTime} read
        </span>
      </div>

      <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        {post.title}
      </h1>

      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        {post.author} &middot; {post.date}
      </p>

      <div className="mt-6 space-y-4">
        {post.content.map((paragraph, i) => (
          <p
            key={i}
            className="leading-relaxed text-zinc-700 dark:text-zinc-300"
          >
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
