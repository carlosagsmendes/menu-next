"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SideNav() {
  const [communityAllowed, setCommunityAllowed] = useState(false);
  const [siteAllowed, setSiteAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkPermissions() {
      try {
        const [communityRes, siteRes] = await Promise.all([
          fetch("/api/permissions/community-admin"),
          fetch("/api/permissions/site-admin"),
        ]);
        const [communityJson, siteJson] = await Promise.all([
          communityRes.json() as Promise<{ allowed?: boolean }>,
          siteRes.json() as Promise<{ allowed?: boolean }>,
        ]);
        if (!cancelled) {
          setCommunityAllowed(communityJson.allowed === true);
          setSiteAllowed(siteJson.allowed === true);
        }
      } catch {
        if (!cancelled) {
          setCommunityAllowed(false);
          setSiteAllowed(false);
        }
      }
    }

    void checkPermissions();
    return () => {
      cancelled = true;
    };
  }, []);

  const linkClass =
    "block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Menu
        </p>
        <nav className="flex flex-col gap-1">
          <Link href="/" className={linkClass}>
            Home
          </Link>
          <Link href="/blog" className={linkClass}>
            Blog
          </Link>
          {communityAllowed ? (
            <Link href="/admin/community" className={linkClass}>
              Community Admin
            </Link>
          ) : null}
          {siteAllowed ? (
            <Link href="/admin/site" className={linkClass}>
              Site Admin
            </Link>
          ) : null}
        </nav>
      </div>
    </aside>
  );
}
