import type { Metadata } from "next";
import { EditorWorkspaceGate } from "@/components/editor/EditorWorkspaceGate";

export const metadata: Metadata = {
  title: "Editor",
  description: "TipTap proofreading editor workspace.",
};

export default function EditorPage() {
  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(250,250,250,0.96),rgba(244,244,245,0.88))] px-4 py-5 sm:px-6 lg:px-8 dark:bg-[linear-gradient(180deg,rgba(9,9,11,0.98),rgba(9,9,11,0.94))]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <header className="rounded-[1.5rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-40px_rgba(24,24,27,0.32)] dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <p className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
              Workspace
            </p>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-zinc-950 sm:text-[2.25rem] dark:text-zinc-50">
                Proofreading Editor
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                Draft in rich text, freeze only when the copy is ready, then
                resolve suggestions without losing the structure of the original
                draft.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs lg:max-w-md lg:justify-end">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Shape
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Freeze
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Review
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                Commit
              </span>
            </div>
          </div>
        </header>

        <EditorWorkspaceGate />
      </div>
    </div>
  );
}
