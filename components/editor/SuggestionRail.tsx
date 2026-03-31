"use client";

import { useEffect, useRef } from "react";
import type {
  ProofreadReviewState,
  ProofreadRunStatus,
  ProofreadSuggestion,
} from "@/data/editor";

function statusTone(status: ProofreadSuggestion["status"]) {
  switch (status) {
    case "pending":
      return {
        border:
          "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/60",
        badge:
          "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300",
      };
    case "accepted":
      return {
        border:
          "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
      };
    case "rejected":
      return {
        border:
          "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30",
        badge:
          "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
      };
    default:
      return {
        border:
          "border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-950/60",
        badge:
          "border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300",
      };
  }
}

function statusLabel(status: ProofreadSuggestion["status"]) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function suggestionSummaryText(suggestion: ProofreadSuggestion) {
  return suggestion.status === "rejected"
    ? "Rejected"
    : suggestion.status === "accepted"
      ? "Accepted"
      : "Pending";
}

function emptyStateCopy(runStatus: ProofreadRunStatus) {
  switch (runStatus) {
    case "streaming":
      return {
        title: "Review running",
        body: "The local AI review is running. Suggestions will appear here as soon as they are ready.",
      };
    case "review":
    case "complete":
      return {
        title: "Review ready",
        body: "The review finished without active suggestions yet. Review the snapshot, or finish once you are satisfied.",
      };
    case "error":
      return {
        title: "Review paused",
        body: "The last review hit a problem. Capture a fresh snapshot after fixing the draft and try again.",
      };
    default:
      return {
        title: "No suggestions yet",
        body: "Freeze a snapshot, then start review to see suggestions in this rail.",
      };
  }
}

export function SuggestionRail({
  review,
  selectedSuggestionId,
  onSelectSuggestion,
  onAcceptSuggestion,
  onRejectSuggestion,
  runStatus,
}: {
  review: ProofreadReviewState;
  selectedSuggestionId: string | null;
  onSelectSuggestion: (suggestionId: string | null) => void;
  onAcceptSuggestion: (suggestionId: string) => void;
  onRejectSuggestion: (suggestionId: string) => void;
  runStatus: ProofreadRunStatus;
}) {
  const itemRefs = useRef(new Map<string, HTMLDivElement | null>());

  useEffect(() => {
    if (selectedSuggestionId === null) {
      return;
    }

    const activeItem = itemRefs.current.get(selectedSuggestionId);
    if (activeItem === null || activeItem === undefined) {
      return;
    }

    activeItem.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [selectedSuggestionId, review.suggestions.length]);

  const pendingCount = review.pendingSuggestionIds.length;
  const acceptedCount = review.acceptedSuggestionIds.length;
  const rejectedCount = review.rejectedSuggestionIds.length;
  const emptyState = emptyStateCopy(runStatus);

  return (
    <aside className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-4 shadow-[0_12px_40px_-28px_rgba(24,24,27,0.35)] dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-950">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Review rail
            </p>
            <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Suggestions in arrival order
            </h3>
            <p className="mt-1 max-w-md text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Select a suggestion here or in the document to keep the review
              rail and inline surface aligned.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-300">
              {review.suggestions.length} item
              {review.suggestions.length === 1 ? "" : "s"}
            </span>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              {pendingCount} pending
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
              {acceptedCount} accepted
            </span>
            <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
              {rejectedCount} rejected
            </span>
          </div>
        </div>
      </div>

      <div className="max-h-[42rem] space-y-3 overflow-y-auto pr-1">
        {review.suggestions.length === 0 ? (
          <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
              {emptyState.title}
            </p>
            <p className="mt-2 leading-6">{emptyState.body}</p>
            <ul className="mt-3 space-y-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              <li>• Freeze a snapshot before starting review.</li>
              <li>• Suggestions appear here and in the inline surface.</li>
              <li>• Accept or reject each change, then finish the review.</li>
            </ul>
          </div>
        ) : (
          review.suggestions.map((suggestion) => {
            const active = suggestion.id === selectedSuggestionId;
            const tones = statusTone(suggestion.status);
            const originalClass =
              suggestion.status === "rejected"
                ? "line-through decoration-rose-500 decoration-2 text-zinc-500 dark:text-zinc-400"
                : suggestion.status === "accepted"
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-900 dark:text-zinc-100";

            return (
              <div
                key={suggestion.id}
                ref={(node) => {
                  itemRefs.current.set(suggestion.id, node);
                }}
                role="button"
                tabIndex={0}
                aria-current={active ? "true" : undefined}
                data-suggestion-id={suggestion.id}
                data-suggestion-status={suggestion.status}
                data-selected={active ? "true" : "false"}
                onClick={() => onSelectSuggestion(suggestion.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectSuggestion(suggestion.id);
                  }
                }}
                className={`cursor-pointer rounded-[1.5rem] border px-3 py-3 text-left transition-all outline-none ${
                  active
                    ? "border-zinc-950 ring-2 ring-zinc-950 ring-offset-2 ring-offset-white dark:border-zinc-100 dark:ring-zinc-100 dark:ring-offset-zinc-950"
                    : tones.border
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ${tones.badge}`}
                    >
                      {statusLabel(suggestion.status)}
                    </span>
                    <span className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                      {suggestion.kind}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {suggestion.startOffset} - {suggestion.endOffset}
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                  {suggestion.reason}
                </p>

                <div className="mt-3 grid gap-2">
                  <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      Original
                    </p>
                    <p className={`mt-1 whitespace-pre-wrap break-words ${originalClass}`}>
                      {suggestion.originalText || "∅"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
                      Replacement
                    </p>
                    <p
                      className={`mt-1 whitespace-pre-wrap break-words ${
                        suggestion.status === "accepted"
                          ? "font-medium text-emerald-700 dark:text-emerald-300"
                          : suggestion.status === "rejected"
                            ? "text-zinc-500 dark:text-zinc-400"
                            : suggestion.kind === "delete"
                              ? "text-rose-700 dark:text-rose-300"
                              : "text-emerald-700 dark:text-emerald-300"
                      }`}
                    >
                      {suggestion.replacementText || "∅"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                    {suggestionSummaryText(suggestion)}
                  </span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAcceptSuggestion(suggestion.id);
                    }}
                    disabled={suggestion.status !== "pending"}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRejectSuggestion(suggestion.id);
                    }}
                    disabled={suggestion.status !== "pending"}
                    className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
