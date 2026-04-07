"use client";

import { useCurrentUser } from "@/components/UserProvider";

export function CurrentUserBadge() {
  const user = useCurrentUser();

  return (
    <div
      className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      data-user-state={user ? "authenticated" : "anonymous"}
    >
      {user ? `User: ${user.name}` : "User: no session"}
    </div>
  );
}
