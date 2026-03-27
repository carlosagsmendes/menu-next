import { Suspense } from "react";
import Link from "next/link";
import { SideNavAdminLinks } from "@/components/SideNavAdminLinks";

const linkClass =
  "block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

export function SideNav() {
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
          <Suspense>
            <SideNavAdminLinks />
          </Suspense>
        </nav>
      </div>
    </aside>
  );
}
