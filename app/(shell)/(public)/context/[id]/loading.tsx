export default function ContextPostLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div className="h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-8 w-3/4 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-4 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800/60"
          />
        ))}
      </div>
    </div>
  );
}
