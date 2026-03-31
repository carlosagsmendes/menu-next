"use client";

import dynamic from "next/dynamic";

const EditorWorkspace = dynamic(
  () =>
    import("@/components/editor/EditorWorkspace").then(
      (module) => module.EditorWorkspace
    ),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-[2rem] border border-dashed border-zinc-200 bg-white/85 p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
        <div className="max-w-xl space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Loading workspace
          </p>
          <p className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Bringing the editor shell online
          </p>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Restoring the draft, toolbar, and review panels. The page will settle
            into the editor as soon as the client bundle is ready.
          </p>
        </div>
      </div>
    ),
  }
);

export function EditorWorkspaceGate() {
  return <EditorWorkspace />;
}
