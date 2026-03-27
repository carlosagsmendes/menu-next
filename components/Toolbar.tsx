import { TaskCount } from "@/components/TaskCount";
import { SearchBox } from "@/components/SearchBox";

export function Toolbar() {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-200 bg-zinc-50/80 px-4 dark:border-zinc-800 dark:bg-zinc-950/80">
      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Menu
      </span>
      <div className="flex items-center gap-3">
        <TaskCount />
        <SearchBox />
      </div>
    </header>
  );
}
