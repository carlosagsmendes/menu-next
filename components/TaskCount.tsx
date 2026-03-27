"use client";

import { useState, useEffect } from "react";

const POLL_INTERVAL_MS = 30_000;

export function TaskCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch("/api/tasks/count");
        if (!res.ok) return;
        const data: { count: number } = await res.json();
        if (!cancelled) setCount(data.count);
      } catch {
        // Silently ignore network errors; stale count is acceptable
      }
    }

    fetchCount();
    const id = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (count === null) {
    return (
      <span className="inline-block h-5 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
    );
  }

  if (count === 0) {
    return (
      <span className="text-xs text-zinc-400 dark:text-zinc-500">
        No tasks
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 text-xs dark:border-zinc-700 dark:bg-zinc-900">
      <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
        {count}
      </span>
      <span className="text-zinc-500 dark:text-zinc-400">pending</span>
    </span>
  );
}
