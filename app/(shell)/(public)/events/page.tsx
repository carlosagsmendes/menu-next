import type { Metadata } from "next";

import { EventMenuButtons } from "@/components/EventMenuButtons";

export const metadata: Metadata = {
  title: "Events",
  description: "Event-driven menu selection overrides.",
};

export default function EventsPage() {
  return (
    <div
      className="flex min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[linear-gradient(180deg,rgba(250,250,250,0.98),rgba(244,244,245,0.9))] px-4 py-5 sm:px-6 lg:px-8 dark:bg-[linear-gradient(180deg,rgba(9,9,11,0.98),rgba(9,9,11,0.94))]"
      data-perf-page="events"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-40px_rgba(24,24,27,0.32)] dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
                Aggregate Surface
              </p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-[2.25rem] dark:text-zinc-50">
                  Menu Selection Via Events
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  This page keeps the route on <code>/events</code> while
                  firing events that temporarily move the sidebar highlight to a
                  different menu item.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs lg:max-w-md lg:justify-end">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                Route-driven by default
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                In-memory override
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                No navigation
              </span>
            </div>
          </div>
        </header>

        <section className="rounded-[1.75rem] border border-zinc-200/80 bg-white/90 p-5 shadow-[0_18px_50px_-40px_rgba(24,24,27,0.32)] dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="max-w-3xl space-y-2">
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
              Fire menu-selection events
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Use the buttons below to switch the selected sidebar item. The
              current URL does not change, and normal route selection returns as
              soon as you navigate elsewhere.
            </p>
          </div>

          <div className="mt-6">
            <EventMenuButtons />
          </div>
        </section>
      </div>
    </div>
  );
}
