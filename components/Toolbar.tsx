import { CurrentUserBadge } from "@/components/CurrentUserBadge";
import { TaskCount } from "@/components/TaskCount";
import { SearchBox } from "@/components/SearchBox";

export function Toolbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-zinc-50/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
      <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Menu
          </p>
          <p className="hidden text-sm font-medium text-zinc-900 sm:block dark:text-zinc-100">
            Workspace shell
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-3">
          <CurrentUserBadge />
          <TaskCount />
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
