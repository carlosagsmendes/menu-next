import Link from "next/link";

import type { Post } from "@/data/dto";

export function RelatedPostsNoSuspense({
  relatedPosts,
}: {
  relatedPosts: Post[];
}) {
  if (relatedPosts.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
        Pattern 1 &middot; Server-side blocking render
      </p>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Related posts
      </h2>

      <ul className="mt-4 grid gap-3">
        {relatedPosts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/blog-no-streaming/${post.id}`}
              className="block rounded-lg border border-zinc-100 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                {post.title}
              </p>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {post.author} &middot; {post.readTime} read
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
