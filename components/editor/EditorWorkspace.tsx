"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import { Tiptap, useEditor } from "@tiptap/react";
import type {
  EditorWorkspaceState,
  ProofreadEvent,
  ProofreadFrozenSnapshot,
  ProofreadReviewState,
  ProofreadRunStatus,
  ProofreadSuggestion,
  ProofreadTextSegment,
} from "@/data/editor";
import {
  createInitialEditorWorkspaceState,
  createInitialProofreadRunState,
  createProofreadRequestPayload,
} from "@/data/editor";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import {
  createEditorExtensions,
  EDITOR_CONTENT_CLASS_NAME,
} from "@/components/editor/editor-config";
import {
  captureEditorSnapshot,
  captureProofreadSnapshot,
} from "@/components/editor/editor-serialization";
import {
  acceptAllProofreadSuggestions,
  commitProofreadReview,
  rebuildProofreadReviewState,
  setProofreadSuggestionStatus,
  updateProofreadSuggestions,
} from "@/components/editor/editor-review";
import { InlineReviewSurface } from "@/components/editor/InlineReviewSurface";
import { SuggestionRail } from "@/components/editor/SuggestionRail";

const REVIEW_ENGINE_LABEL = "LM Studio";
const REVIEW_MODEL_LABEL = "qwen/qwen3.5-35b-a3b";

function StatePill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
      <span className="text-zinc-400 dark:text-zinc-500">{label}:</span> {value}
    </div>
  );
}

function runStatusMessage(
  runStatus: EditorWorkspaceState["run"]["status"],
  errorMessage: string | null
) {
  switch (runStatus) {
    case "streaming":
      return "The local AI review is running from the frozen snapshot. The editor stays locked until it finishes.";
    case "review":
      return "Review is ready. Accept or reject suggestions individually, or accept all and apply every fix at once.";
    case "error":
      return errorMessage
        ? `Proofread failed: ${errorMessage} The original draft has been restored and the editor unlocked.`
        : "Proofread failed. The original draft has been restored and the editor unlocked.";
    case "idle":
    default:
      return "Freeze the current draft to begin a local AI proofread pass.";
  }
}

function runStatusToneClass(run: EditorWorkspaceState["run"]) {
  if (run.status === "error") {
    return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200";
  }

  if (run.status === "streaming") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
  }

  if (run.status === "review") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300";
}

function runStatusDotClass(run: EditorWorkspaceState["run"]) {
  if (run.status === "error") {
    return "bg-rose-500";
  }

  if (run.status === "streaming") {
    return "bg-amber-500";
  }

  if (run.status === "review") {
    return "bg-emerald-500";
  }

  return "bg-zinc-400 dark:bg-zinc-600";
}

function DiagnosticsDisclosure({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <details className="group rounded-[1.35rem] border border-zinc-200 bg-white/90 p-4 shadow-[0_12px_40px_-32px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:bg-zinc-950/85">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            {title}
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 transition-colors group-open:bg-zinc-900 group-open:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:group-open:bg-zinc-100 dark:group-open:text-zinc-950">
          Toggle
        </span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

function OutputCard({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "muted";
}) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white/90 p-4 shadow-[0_12px_40px_-32px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:bg-zinc-950/90">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <pre
        className={`mt-3 max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-2xl border px-4 py-3 text-xs leading-6 ${
          tone === "muted"
            ? "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300"
            : "border-zinc-200 bg-zinc-50 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </pre>
    </div>
  );
}

function editorHeading(locked: boolean) {
  return locked ? "Proofread snapshot frozen" : "TipTap rich-text editor";
}

function editorHint(locked: boolean) {
  return locked
    ? "The draft is locked while this snapshot is active for review."
    : "Draft and format the copy here, then freeze it when the structure and wording feel ready for review.";
}

function canonicalPrimaryLabel(locked: boolean) {
  return locked ? "Frozen snapshot JSON" : "TipTap JSON";
}

function formatSegmentPreview(segment: ProofreadTextSegment) {
  const previewText = segment.text.replace(/\n/g, "\\n");
  return `${segment.startOffset}-${segment.endOffset} ${segment.kind}${
    segment.proofreadable ? "" : " (locked)"
  } ${previewText}`;
}

function SnapshotSummary({
  snapshot,
}: {
  snapshot: ProofreadFrozenSnapshot | null;
}) {
  if (snapshot === null) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-zinc-50/80 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        <p className="font-medium text-zinc-700 dark:text-zinc-200">
          No snapshot yet
        </p>
        <p className="mt-2 leading-6">
          Freeze the current draft to preview normalized plain text and offset
          mapping before the review starts.
        </p>
      </div>
    );
  }

  const proofreadableSegments = snapshot.textSegments.filter(
    (segment) => segment.proofreadable
  );

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-zinc-200 bg-white/90 p-4 shadow-[0_12px_40px_-32px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Frozen snapshot
          </p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Captured for local AI review
          </h3>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {snapshot.createdAt}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatePill
          label="Plain text"
          value={`${snapshot.document.plainText.length} chars`}
        />
        <StatePill label="Segments" value={String(snapshot.textSegments.length)} />
        <StatePill
          label="Proofreadable"
          value={String(proofreadableSegments.length)}
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
        <p className="font-semibold text-zinc-500 dark:text-zinc-400">
          Normalized plain text
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words">
          {snapshot.document.plainText || "Empty"}
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
          Mapping preview
        </p>
        <div className="mt-3 space-y-2">
          {snapshot.textSegments.slice(0, 6).map((segment) => (
            <div
              key={segment.id}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-950 dark:text-zinc-50">
                  {segment.path}
                </span>
                <span className="rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                  {segment.kind}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
                    segment.proofreadable
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {segment.proofreadable ? "proofreadable" : "locked"}
                </span>
              </div>
              <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">
                {formatSegmentPreview(segment)}
              </p>
            </div>
          ))}
          {snapshot.textSegments.length > 6 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              +{snapshot.textSegments.length - 6} more segments
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReviewSummary({
  review,
}: {
  review: ProofreadReviewState;
}) {
  const pendingCount = review.pendingSuggestionIds.length;
  const acceptedCount = review.acceptedSuggestionIds.length;
  const rejectedCount = review.rejectedSuggestionIds.length;

  return (
    <div className="space-y-4 rounded-[1.5rem] border border-zinc-200 bg-white/90 p-4 shadow-[0_12px_40px_-32px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Review state
          </p>
          <h3 className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Reconstruction from the frozen snapshot and suggestion status
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <StatePill label="Pending" value={String(pendingCount)} />
          <StatePill label="Accepted" value={String(acceptedCount)} />
          <StatePill label="Rejected" value={String(rejectedCount)} />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
        <p className="font-semibold text-zinc-500 dark:text-zinc-400">
          Resolved plain text
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words">
          {review.resolvedPlainText || "Empty"}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
        <p className="font-semibold text-zinc-500 dark:text-zinc-400">
          Pending highlight segments
        </p>
        <p className="mt-2 font-mono text-[11px]">
          {pendingCount === 0 ? "None" : review.pendingSegmentIds.join(", ")}
        </p>
      </div>
    </div>
  );
}

function editorSurfaceSummary(locked: boolean) {
  if (locked) {
    return "Snapshot frozen. Review suggestions or discard the snapshot to edit again.";
  }

  return "Freeze the current draft when the structure and wording feel ready for review.";
}

function reviewActionLabel(runStatus: ProofreadRunStatus) {
  if (runStatus === "streaming") {
    return "Reviewing...";
  }

  if (runStatus === "review") {
    return "Review ready";
  }

  return "Start Review";
}

async function readProofreadStream(
  response: Response,
  onEvent: (event: ProofreadEvent) => void
) {
  if (response.body === null) {
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line !== "") {
        onEvent(JSON.parse(line) as ProofreadEvent);
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  const trailing = buffer.trim();
  if (trailing !== "") {
    onEvent(JSON.parse(trailing) as ProofreadEvent);
  }
}

function EditorLoadingState() {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-zinc-200 bg-white/85 p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="max-w-xl space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
          Loading editor
        </p>
        <p className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Bringing the TipTap workspace online
        </p>
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Restoring the editor shell, toolbar, and review panels. The page will
          settle into the editor as soon as the client editor instance is ready.
        </p>
      </div>
    </div>
  );
}

function EditorSurface({
  editor,
  locked,
  onPrepareSnapshot,
  onClearSnapshot,
  onStartReview,
  onAcceptAllSuggestions,
  onAcceptSuggestion,
  onRejectSuggestion,
  onFinishReview,
  onSelectSuggestion,
  selectedSuggestionId,
  review,
  run,
  snapshot,
}: {
  editor: Editor;
  locked: boolean;
  onPrepareSnapshot: (editor: Editor) => void;
  onClearSnapshot: () => void;
  onStartReview: () => void;
  onAcceptAllSuggestions: (editor: Editor) => void;
  onAcceptSuggestion: (suggestionId: string) => void;
  onRejectSuggestion: (suggestionId: string) => void;
  onFinishReview: (editor: Editor) => void;
  onSelectSuggestion: (suggestionId: string | null) => void;
  selectedSuggestionId: string | null;
  review: ProofreadReviewState;
  run: EditorWorkspaceState["run"];
  snapshot: ProofreadFrozenSnapshot | null;
}) {
  const runStatus = run.status;
  const statusMessage = runStatusMessage(run.status, run.errorMessage);
  const statusToneClass = runStatusToneClass(run);
  const statusDotClass = runStatusDotClass(run);
  const canAcceptAll = locked && runStatus === "review" && review.suggestions.length > 0;

  return (
    <>
      <div className={`space-y-3 rounded-[1.35rem] border px-4 py-4 ${statusToneClass}`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
              <p className="text-sm font-medium">
                Review: {run.status.charAt(0).toUpperCase() + run.status.slice(1)}
              </p>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">
                {run.runId ?? "No run yet"}
              </span>
            </div>
            <p className="max-w-3xl text-sm leading-6">
              {runStatus === "idle" ? editorSurfaceSummary(locked) : statusMessage}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPrepareSnapshot(editor)}
              disabled={locked}
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Prepare Snapshot
            </button>
            <button
              type="button"
              onClick={onClearSnapshot}
              disabled={!locked}
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Discard Snapshot
            </button>
            <button
              type="button"
              onClick={onStartReview}
              disabled={!locked || runStatus === "streaming" || runStatus === "review"}
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              {reviewActionLabel(runStatus)}
            </button>
            <button
              type="button"
              onClick={() => onAcceptAllSuggestions(editor)}
              disabled={!canAcceptAll}
              className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/60"
            >
              Accept All & Apply
            </button>
            <button
              type="button"
              onClick={() => onFinishReview(editor)}
              disabled={!locked || runStatus !== "review"}
              className="inline-flex h-9 items-center justify-center rounded-full border border-zinc-200 bg-white px-4 text-xs font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
            >
              Finish Review
            </button>
          </div>
        </div>
      </div>

      {locked ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.75fr)]">
          <InlineReviewSurface
            snapshot={snapshot}
            review={review}
            selectedSuggestionId={selectedSuggestionId}
            onSelectSuggestion={onSelectSuggestion}
          />
          <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <ReviewSummary review={review} />
            <SuggestionRail
              review={review}
              selectedSuggestionId={selectedSuggestionId}
              onSelectSuggestion={onSelectSuggestion}
              onAcceptSuggestion={onAcceptSuggestion}
              onRejectSuggestion={onRejectSuggestion}
              runStatus={runStatus}
            />
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-[1.5rem] border border-zinc-200 bg-white/90 p-4 shadow-[0_14px_48px_-36px_rgba(24,24,27,0.34)] dark:border-zinc-800 dark:bg-zinc-950/85">
          <EditorToolbar disabled={locked} />
          <div className="relative overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-zinc-800 dark:bg-zinc-950">
            <Tiptap.Content
              aria-label="TipTap editor"
              className={EDITOR_CONTENT_CLASS_NAME}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function EditorWorkspace({
  nonce,
}: {
  nonce?: string;
}) {
  const [seedState] = useState(createInitialEditorWorkspaceState);
  const [document, setDocument] = useState(seedState.draft.document);
  const [frozenSnapshot, setFrozenSnapshot] = useState(seedState.frozenSnapshot);
  const [reviewSuggestions, setReviewSuggestions] = useState<ProofreadSuggestion[]>(
    seedState.review.suggestions
  );
  const [selectedSuggestionId, setSelectedSuggestionId] = useState<string | null>(
    seedState.selectedSuggestionId
  );
  const [run, setRun] = useState(seedState.run);
  const editor = useEditor(
    {
      autofocus: "start",
      content: seedState.draft.document.tiptapJson,
      editorProps: {
        attributes: {
          class: EDITOR_CONTENT_CLASS_NAME,
        },
      },
      extensions: createEditorExtensions(),
      injectNonce: nonce,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
    },
    [nonce]
  );

  const locked = frozenSnapshot.snapshot !== null;
  const runIsActive = run.status === "streaming" || run.status === "review";
  const activeDocument = frozenSnapshot.snapshot?.document ?? document;
  const review = useMemo(
    () => rebuildProofreadReviewState(frozenSnapshot.snapshot, reviewSuggestions),
    [frozenSnapshot.snapshot, reviewSuggestions]
  );

  useEffect(() => {
    if (editor === null) {
      return;
    }

    const handleUpdate = () => {
      setDocument(captureEditorSnapshot(editor));
    };

    handleUpdate();
    editor.on("update", handleUpdate);

    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (editor === null) {
      return;
    }

    editor.setEditable(!locked, false);
  }, [editor, locked]);

  function resetReviewSession(nextRun = createInitialProofreadRunState()) {
    setReviewSuggestions([]);
    setSelectedSuggestionId(null);
    setRun(nextRun);
  }

  function recoverFromProofreadFailure(message: string) {
    setReviewSuggestions([]);
    setSelectedSuggestionId(null);
    setFrozenSnapshot({ snapshot: null });
    setRun({
      status: "error",
      runId: null,
      startedAt: null,
      finishedAt: new Date().toISOString(),
      errorMessage: message,
    });
  }

  function handlePrepareSnapshot(currentEditor: Editor) {
    if (locked) {
      return;
    }

    resetReviewSession();
    setFrozenSnapshot({
      snapshot: captureProofreadSnapshot(currentEditor),
    });
  }

  function handleClearSnapshot() {
    setFrozenSnapshot({ snapshot: null });
    resetReviewSession();
  }

  async function handleStartReview() {
    const snapshot = frozenSnapshot.snapshot;
    if (snapshot === null || runIsActive) {
      return;
    }

    resetReviewSession({
      status: "streaming",
      runId: null,
      startedAt: null,
      finishedAt: null,
      errorMessage: null,
    });

    try {
      const response = await fetch("/api/proofread", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createProofreadRequestPayload(snapshot.document)),
      });

      if (!response.ok || response.body === null) {
        throw new Error("Proofread request failed.");
      }

      await readProofreadStream(response, (event) => {
        if (event.type === "run-start") {
          setRun({
            status: "streaming",
            runId: event.runId,
            startedAt: event.startedAt,
            finishedAt: null,
            errorMessage: null,
          });
          return;
        }

        if (event.type === "suggestion") {
          setReviewSuggestions((current) =>
            updateProofreadSuggestions(current, event.suggestion)
          );
          setSelectedSuggestionId((current) => current ?? event.suggestion.id);
          return;
        }

        if (event.type === "complete") {
          setRun((current) => ({
            ...current,
            status: "review",
            finishedAt: event.completedAt,
            errorMessage: null,
          }));
          return;
        }

        if (event.type === "error") {
          recoverFromProofreadFailure(event.message);
        }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Proofread stream failed.";
      recoverFromProofreadFailure(message);
    }
  }

  function handleSuggestionStatusChange(
    suggestionId: string,
    status: ProofreadSuggestion["status"]
  ) {
    setReviewSuggestions((current) =>
      setProofreadSuggestionStatus(current, suggestionId, status)
    );
  }

  function commitReviewToEditor(
    currentEditor: Editor,
    snapshot: ProofreadFrozenSnapshot,
    nextReview: ProofreadReviewState
  ) {
    const committedDocument = commitProofreadReview(snapshot, nextReview);

    currentEditor.commands.setContent(committedDocument.tiptapJson, {
      emitUpdate: false,
    });

    const capturedDocument = captureEditorSnapshot(currentEditor);
    setDocument(capturedDocument);
    setFrozenSnapshot({ snapshot: null });
    resetReviewSession(createInitialProofreadRunState());
  }

  function handleAcceptAllSuggestions(currentEditor: Editor) {
    if (frozenSnapshot.snapshot === null || run.status !== "review") {
      return;
    }

    const nextSuggestions = acceptAllProofreadSuggestions(review.suggestions);
    const nextReview = rebuildProofreadReviewState(
      frozenSnapshot.snapshot,
      nextSuggestions
    );

    commitReviewToEditor(currentEditor, frozenSnapshot.snapshot, nextReview);
  }

  function handleFinishReview(currentEditor: Editor) {
    if (frozenSnapshot.snapshot === null) {
      return;
    }

    commitReviewToEditor(currentEditor, frozenSnapshot.snapshot, review);
  }

  function handleSelectSuggestion(suggestionId: string | null) {
    setSelectedSuggestionId(suggestionId);
  }

  return (
    <section className="flex w-full flex-col gap-4 rounded-[1.75rem] border border-zinc-200 bg-white/95 p-4 shadow-[0_20px_70px_-48px_rgba(24,24,27,0.4)] dark:border-zinc-800 dark:bg-zinc-900/95 lg:p-5">
      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-zinc-200 bg-zinc-50/70 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
            {editorHeading(locked)}
          </p>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {editorHint(locked)}
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap gap-2">
            <StatePill label="Surface" value="Rich text" />
            <StatePill label="Snapshot" value={locked ? "Frozen" : "Draft"} />
            <StatePill label="Run" value={run.status} />
            <StatePill label="Editor" value="TipTap" />
            <StatePill label="Engine" value={REVIEW_ENGINE_LABEL} />
            <StatePill label="Model" value={REVIEW_MODEL_LABEL} />
          </div>
        </div>
      </div>

      {editor === null ? (
        <EditorLoadingState />
      ) : (
        <Tiptap editor={editor}>
          <div className="flex flex-col gap-4">
            <EditorSurface
              editor={editor}
              locked={locked}
              onPrepareSnapshot={handlePrepareSnapshot}
              onClearSnapshot={handleClearSnapshot}
              onStartReview={handleStartReview}
              onAcceptAllSuggestions={handleAcceptAllSuggestions}
              onAcceptSuggestion={(suggestionId) =>
                handleSuggestionStatusChange(suggestionId, "accepted")
              }
              onRejectSuggestion={(suggestionId) =>
                handleSuggestionStatusChange(suggestionId, "rejected")
              }
              onFinishReview={handleFinishReview}
              onSelectSuggestion={handleSelectSuggestion}
              selectedSuggestionId={selectedSuggestionId}
              review={review}
              run={run}
              snapshot={frozenSnapshot.snapshot}
            />
          </div>
        </Tiptap>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DiagnosticsDisclosure
          title="Document exports"
          description="Open this panel when you want the synced JSON, HTML, or plain-text views."
        >
          <div className="grid gap-4 xl:grid-cols-3">
            <OutputCard
              label={canonicalPrimaryLabel(locked)}
              value={JSON.stringify(activeDocument.tiptapJson, null, 2)}
            />
            <OutputCard
              label="HTML export"
              value={activeDocument.html || "Empty"}
              tone="muted"
            />
            <OutputCard
              label="Normalized plain text"
              value={activeDocument.plainText || "Empty"}
              tone="muted"
            />
          </div>
        </DiagnosticsDisclosure>
        <DiagnosticsDisclosure
          title="Snapshot diagnostics"
          description={
            locked
              ? "The frozen snapshot and review reconstruction stay available here while you work through suggestions."
              : "Freeze a snapshot when you want to inspect the normalized text and segment mapping."
          }
        >
          <div className="space-y-4">
            <SnapshotSummary snapshot={frozenSnapshot.snapshot} />
            {frozenSnapshot.snapshot !== null ? <ReviewSummary review={review} /> : null}
          </div>
        </DiagnosticsDisclosure>
      </div>
    </section>
  );
}
