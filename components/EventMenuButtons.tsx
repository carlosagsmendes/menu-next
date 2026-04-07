"use client";

import type { MenuItemId } from "@/lib/menu";
import { dispatchMenuSelectionOverride } from "@/lib/menu-selection";

const eventButtons: Array<{
  id: MenuItemId;
  label: string;
  description: string;
}> = [
  {
    id: "home",
    label: "Highlight Home",
    description: "Show the Home item as selected while the URL stays on /events.",
  },
  {
    id: "blog",
    label: "Highlight Blog",
    description: "Point the sidebar at the blog section without navigating away.",
  },
  {
    id: "context",
    label: "Highlight Context",
    description: "Preview the new streaming experiments route in the sidebar.",
  },
  {
    id: "blogNoStreaming",
    label: "Highlight Blog No Streaming",
    description: "Simulate an aggregate page that belongs to the blocking shell flow.",
  },
  {
    id: "editor",
    label: "Highlight Editor",
    description: "Reflect editor context from an events-driven surface.",
  },
  {
    id: "events",
    label: "Highlight Events",
    description: "Return the visual selection to the current route item.",
  },
];

export function EventMenuButtons() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {eventButtons.map((button) => (
        <button
          key={button.id}
          type="button"
          onClick={() => dispatchMenuSelectionOverride(button.id)}
          className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 text-left shadow-[0_18px_40px_-32px_rgba(24,24,27,0.35)] transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/70 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {button.label}
          </span>
          <span className="mt-2 block text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {button.description}
          </span>
        </button>
      ))}
    </div>
  );
}
