import { Suspense } from "react";
import Link from "next/link";
import { SideNavAdminLinks } from "@/components/SideNavAdminLinks";

const linkClass =
  "inline-flex shrink-0 items-center rounded-full px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:w-full md:rounded-xl";

export function SideNav() {
  return (
    <aside className="w-full border-b border-zinc-200/80 bg-zinc-50/85 backdrop-blur md:w-52 md:shrink-0 md:border-b-0 md:border-r dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="px-4 py-3 md:p-4">
        <div className="md:rounded-[1.5rem] md:border md:border-zinc-200 md:bg-white/80 md:p-3 md:shadow-sm md:dark:border-zinc-800 md:dark:bg-zinc-950/70">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 md:mb-3">
            Menu
          </p>
          <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            <Link href="/" className={linkClass}>
              Home
            </Link>
            <Link href="/blog" className={linkClass}>
              Blog
            </Link>
            <Link href="/editor" className={linkClass}>
              Editor
            </Link>
            <Suspense fallback={null}>
              <SideNavAdminLinks className={linkClass} />
            </Suspense>
          </nav>
        </div>
      </div>
    </aside>
  );
}
