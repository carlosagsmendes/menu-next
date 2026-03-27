function SkeletonCard() {
  return (
    <div className="mx-auto max-w-3xl border-b border-zinc-200 px-2 py-5 dark:border-zinc-800">
      <div className="flex items-center gap-3">
        <div className="h-5 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-2 h-5 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-2 space-y-1.5">
        <div className="h-3.5 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3.5 w-5/6 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="mt-2 h-3 w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
    </div>
  );
}

export function BlogPostListSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      {Array.from({ length: 5 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
