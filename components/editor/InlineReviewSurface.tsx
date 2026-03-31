"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";
import type {
  ProofreadFrozenSnapshot,
  ProofreadReviewState,
  ProofreadSuggestion,
} from "@/data/editor";
import { getProofreadSuggestionSegmentIds } from "@/components/editor/editor-review";

type SerializedNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: SerializedMark[];
  content?: SerializedNode[];
};

type SerializedMark = {
  type?: string;
  attrs?: Record<string, unknown>;
};

function getNodeType(node: SerializedNode) {
  return node.type ?? "";
}

function getNodeChildren(node: SerializedNode) {
  return Array.isArray(node.content) ? node.content : [];
}

function getNodeText(node: SerializedNode) {
  return typeof node.text === "string" ? node.text : "";
}

function getNodeMarks(node: SerializedNode) {
  return Array.isArray(node.marks) ? node.marks : [];
}

function getHeadingLevel(node: SerializedNode) {
  const level = node.attrs?.level;
  return typeof level === "number" ? level : 2;
}

function getLinkHref(mark: SerializedMark) {
  const href = mark.attrs?.href;
  return typeof href === "string" ? href : undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function suggestionStatusClass(
  suggestion: ProofreadSuggestion,
  selected: boolean
) {
  const selectedClasses = selected
    ? "ring-2 ring-zinc-950 ring-offset-2 ring-offset-white dark:ring-zinc-100 dark:ring-offset-zinc-950"
    : "";

  switch (suggestion.status) {
    case "pending": {
      if (suggestion.kind === "delete") {
        return `rounded-md cursor-pointer bg-rose-100 px-1.5 py-0.5 text-rose-700 decoration-rose-500 shadow-sm outline-none transition-shadow hover:bg-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60 ${selectedClasses}`;
      }

      if (suggestion.kind === "insert") {
        return `rounded-md cursor-pointer bg-emerald-100 px-1.5 py-0.5 text-emerald-900 shadow-sm outline-none transition-shadow hover:bg-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950/60 ${selectedClasses}`;
      }

      return `rounded-md cursor-pointer border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-zinc-700 shadow-sm outline-none transition-shadow hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:bg-zinc-900 ${selectedClasses}`;
    }
    case "accepted":
      return `rounded-md cursor-pointer px-0.5 outline-none transition-shadow ${selectedClasses}`;
    case "rejected":
      return `rounded-md cursor-pointer px-0.5 text-zinc-500 outline-none transition-shadow ${selectedClasses}`;
    default:
      return `cursor-pointer outline-none ${selectedClasses}`;
  }
}

function renderTextWithBreaks(value: string) {
  const pieces = value.split("\n");

  return pieces.flatMap((piece, index) => {
    const nodes: ReactNode[] = [];

    if (index > 0) {
      nodes.push(<br key={`br-${index}`} />);
    }

    if (piece !== "") {
      nodes.push(<span key={`text-${index}`}>{piece}</span>);
    }

    return nodes;
  });
}

function activateSuggestion(
  suggestionId: string,
  onSelectSuggestion: (suggestionId: string) => void
) {
  onSelectSuggestion(suggestionId);
}

function sortSuggestions(
  suggestions: ProofreadSuggestion[],
  segmentStart: number
) {
  return [...suggestions].sort((left, right) => {
    const leftStart = clamp(left.startOffset - segmentStart, 0, Number.MAX_SAFE_INTEGER);
    const rightStart = clamp(
      right.startOffset - segmentStart,
      0,
      Number.MAX_SAFE_INTEGER
    );

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    if (left.endOffset !== right.endOffset) {
      return left.endOffset - right.endOffset;
    }

    return left.id.localeCompare(right.id);
  });
}

function renderSegmentText(
  segmentText: string,
  segmentStart: number,
  suggestions: ProofreadSuggestion[],
  selectedSuggestionId: string | null,
  onSelectSuggestion: (suggestionId: string) => void
) {
  const nodes: ReactNode[] = [];
  const orderedSuggestions = sortSuggestions(suggestions, segmentStart);
  let cursor = 0;

  for (const suggestion of orderedSuggestions) {
    const start = clamp(suggestion.startOffset - segmentStart, 0, segmentText.length);
    const end = clamp(suggestion.endOffset - segmentStart, start, segmentText.length);
    const selected = suggestion.id === selectedSuggestionId;

    if (start > cursor) {
      nodes.push(
        <span key={`${suggestion.id}-before-${cursor}`}>
          {renderTextWithBreaks(segmentText.slice(cursor, start))}
        </span>
      );
    }

    if (suggestion.status === "pending") {
      if (suggestion.kind === "insert") {
        nodes.push(
          <button
            type="button"
            key={suggestion.id}
            data-suggestion-id={suggestion.id}
            data-suggestion-status={suggestion.status}
            data-selected={selected ? "true" : "false"}
            className={suggestionStatusClass(suggestion, selected)}
            onClick={() => activateSuggestion(suggestion.id, onSelectSuggestion)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateSuggestion(suggestion.id, onSelectSuggestion);
              }
            }}
            aria-current={selected ? "true" : undefined}
          >
            {renderTextWithBreaks(suggestion.replacementText)}
          </button>
        );
        cursor = start;
      } else if (suggestion.kind === "delete") {
        nodes.push(
          <button
            type="button"
            key={suggestion.id}
            data-suggestion-id={suggestion.id}
            data-suggestion-status={suggestion.status}
            data-selected={selected ? "true" : "false"}
            className={suggestionStatusClass(suggestion, selected)}
            onClick={() => activateSuggestion(suggestion.id, onSelectSuggestion)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateSuggestion(suggestion.id, onSelectSuggestion);
              }
            }}
            aria-current={selected ? "true" : undefined}
          >
            <span className="line-through decoration-rose-500 decoration-2">
              {renderTextWithBreaks(segmentText.slice(start, end))}
            </span>
          </button>
        );
        cursor = end;
      } else {
        nodes.push(
          <button
            type="button"
            key={suggestion.id}
            data-suggestion-id={suggestion.id}
            data-suggestion-status={suggestion.status}
            data-selected={selected ? "true" : "false"}
            className={suggestionStatusClass(suggestion, selected)}
            onClick={() => activateSuggestion(suggestion.id, onSelectSuggestion)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateSuggestion(suggestion.id, onSelectSuggestion);
              }
            }}
            aria-current={selected ? "true" : undefined}
          >
            <span className="line-through decoration-rose-500 decoration-2">
              {renderTextWithBreaks(segmentText.slice(start, end))}
            </span>
            <span className="ml-1 font-medium text-emerald-800 dark:text-emerald-200">
              {renderTextWithBreaks(suggestion.replacementText)}
            </span>
          </button>
        );
        cursor = end;
      }

      continue;
    }

    if (suggestion.status === "accepted") {
      if (suggestion.kind === "insert") {
        nodes.push(
          <button
            type="button"
            key={suggestion.id}
            data-suggestion-id={suggestion.id}
            data-suggestion-status={suggestion.status}
            data-selected={selected ? "true" : "false"}
            className={suggestionStatusClass(suggestion, selected)}
            onClick={() => activateSuggestion(suggestion.id, onSelectSuggestion)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateSuggestion(suggestion.id, onSelectSuggestion);
              }
            }}
            aria-current={selected ? "true" : undefined}
          >
            {renderTextWithBreaks(suggestion.replacementText)}
          </button>
        );
        cursor = start;
      } else if (suggestion.kind === "delete") {
        cursor = end;
      } else {
        nodes.push(
          <button
            type="button"
            key={suggestion.id}
            data-suggestion-id={suggestion.id}
            data-suggestion-status={suggestion.status}
            data-selected={selected ? "true" : "false"}
            className={suggestionStatusClass(suggestion, selected)}
            onClick={() => activateSuggestion(suggestion.id, onSelectSuggestion)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateSuggestion(suggestion.id, onSelectSuggestion);
              }
            }}
            aria-current={selected ? "true" : undefined}
          >
            {renderTextWithBreaks(suggestion.replacementText)}
          </button>
        );
        cursor = end;
      }

      continue;
    }

    if (suggestion.kind === "insert") {
      cursor = start;
      continue;
    }

    nodes.push(
      <button
        type="button"
        key={suggestion.id}
        data-suggestion-id={suggestion.id}
        data-suggestion-status={suggestion.status}
        data-selected={selected ? "true" : "false"}
        className={suggestionStatusClass(suggestion, selected)}
        onClick={() => activateSuggestion(suggestion.id, onSelectSuggestion)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activateSuggestion(suggestion.id, onSelectSuggestion);
          }
        }}
        aria-current={selected ? "true" : undefined}
      >
        {renderTextWithBreaks(segmentText.slice(start, end))}
      </button>
    );
    cursor = end;
  }

  if (cursor < segmentText.length) {
    nodes.push(
      <span key={`tail-${segmentText.length}-${cursor}`}>
        {renderTextWithBreaks(segmentText.slice(cursor))}
      </span>
    );
  }

  return nodes;
}

function buildSegmentSuggestionMap(
  snapshot: ProofreadFrozenSnapshot,
  review: ProofreadReviewState
) {
  const map = new Map<string, ProofreadSuggestion[]>();

  for (const suggestion of review.suggestions) {
    const segmentId = getProofreadSuggestionSegmentIds(snapshot, suggestion)[0];
    if (segmentId === undefined) {
      continue;
    }

    const currentSuggestions = map.get(segmentId) ?? [];
    currentSuggestions.push(suggestion);
    map.set(segmentId, currentSuggestions);
  }

  return map;
}

function applyMarks(
  content: ReactNode,
  marks: SerializedMark[],
  keyBase: string
) {
  return marks.reduceRight<ReactNode>((children, mark, index) => {
    switch (mark.type) {
      case "bold":
        return (
          <strong key={`${keyBase}-bold-${index}`} className="font-semibold">
            {children}
          </strong>
        );
      case "italic":
        return (
          <em key={`${keyBase}-italic-${index}`} className="italic">
            {children}
          </em>
        );
      case "strike":
        return (
          <s
            key={`${keyBase}-strike-${index}`}
            className="decoration-zinc-400/80"
          >
            {children}
          </s>
        );
      case "link":
        return (
          <span
            key={`${keyBase}-link-${index}`}
            title={getLinkHref(mark)}
            className="text-sky-600 underline decoration-sky-500/40 underline-offset-2 dark:text-sky-400"
          >
            {children}
          </span>
        );
      default:
        return children;
    }
  }, content);
}

function renderNode(
  node: SerializedNode,
  path: string,
  segmentMap: Map<string, ProofreadSuggestion[]>,
  snapshot: ProofreadFrozenSnapshot,
  selectedSuggestionId: string | null,
  onSelectSuggestion: (suggestionId: string) => void,
  index: number
): ReactNode {
  const nodeType = getNodeType(node);

  if (nodeType === "text") {
    const segment = snapshot.textSegments.find((entry) => entry.path === path);
    const segmentText = getNodeText(node);
    const marks = getNodeMarks(node);
    const children =
      segment === undefined || !segment.proofreadable || segment.kind !== "text"
        ? renderTextWithBreaks(segmentText)
        : renderSegmentText(
            segment.text,
            segment.startOffset,
            segmentMap.get(segment.id) ?? [],
            selectedSuggestionId,
            onSelectSuggestion
          );

    return <span key={path}>{applyMarks(children, marks, path)}</span>;
  }

  if (nodeType === "hardBreak") {
    return <br key={path} />;
  }

  const children = getNodeChildren(node).map((child, childIndex) =>
    renderNode(
      child,
      `${path}/content[${childIndex}]`,
      segmentMap,
      snapshot,
      selectedSuggestionId,
      onSelectSuggestion,
      childIndex
    )
  );

  switch (nodeType) {
    case "doc":
      return <div key={path}>{children}</div>;
    case "paragraph":
      return (
        <p key={path} className="whitespace-pre-wrap break-words leading-7">
          {children.length > 0 ? children : <br />}
        </p>
      );
    case "heading": {
      const level = getHeadingLevel(node);
      const Tag = `h${Math.min(Math.max(level, 1), 3)}` as ElementType;
      return (
        <Tag
          key={path}
          className={
            level === 1
              ? "mb-3 text-3xl font-semibold tracking-tight"
              : level === 2
                ? "mb-3 text-2xl font-semibold tracking-tight"
                : "mb-2 text-xl font-semibold tracking-tight"
          }
        >
          {children}
        </Tag>
      );
    }
    case "blockquote":
      return (
        <blockquote
          key={path}
          className="border-l-4 border-zinc-200 pl-4 italic text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
        >
          {children}
        </blockquote>
      );
    case "bulletList":
      return (
        <ul key={path} className="list-disc space-y-2 pl-6">
          {children}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={path} className="list-decimal space-y-2 pl-6">
          {children}
        </ol>
      );
    case "listItem":
      return (
        <li key={path} className="leading-7">
          {children}
        </li>
      );
    default:
      return <span key={`${path}-${index}`}>{children}</span>;
  }
}

export function InlineReviewSurface({
  snapshot,
  review,
  selectedSuggestionId,
  onSelectSuggestion,
}: {
  snapshot: ProofreadFrozenSnapshot | null;
  review: ProofreadReviewState;
  selectedSuggestionId: string | null;
  onSelectSuggestion: (suggestionId: string | null) => void;
}) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (snapshot === null || selectedSuggestionId === null) {
      return;
    }

    const activeNode = surfaceRef.current?.querySelector(
      `[data-suggestion-id="${selectedSuggestionId}"]`
    ) as HTMLElement | null;

    if (activeNode === null) {
      return;
    }

    activeNode.scrollIntoView({
      block: "center",
      inline: "nearest",
    });
    activeNode.focus({ preventScroll: true });
  }, [selectedSuggestionId, snapshot, review.suggestions.length]);

  if (snapshot === null) {
    return null;
  }

  const segmentMap = buildSegmentSuggestionMap(snapshot, review);

  return (
    <div
      ref={surfaceRef}
      data-review-surface
      className="space-y-4 rounded-[1.75rem] border border-zinc-200 bg-gradient-to-b from-white to-zinc-50 p-5 shadow-[0_12px_40px_-32px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-950"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
            Review surface
          </p>
          <h3 className="text-base font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Inline suggestions inside the document flow
          </h3>
          <p className="max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Pending changes appear inline. Deletions are struck in rose, insertions
            are highlighted in emerald, and the selected suggestion gets a stronger
            frame.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 font-medium text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            Delete
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Insert
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            Selected
          </span>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-zinc-200 bg-white/90 px-5 py-5 text-sm leading-7 text-zinc-950 shadow-inner dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-50">
        <div className="space-y-4">
          {renderNode(
            snapshot.document.tiptapJson as SerializedNode,
            "doc",
            segmentMap,
            snapshot,
            selectedSuggestionId,
            (nextSuggestionId) => onSelectSuggestion(nextSuggestionId),
            0
          )}
        </div>
      </div>
    </div>
  );
}
