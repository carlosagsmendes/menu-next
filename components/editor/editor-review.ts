import type { JSONContent } from "@tiptap/core";
import type {
  ProofreadDocumentSnapshot,
  ProofreadFrozenSnapshot,
  ProofreadReviewState,
  ProofreadSuggestion,
} from "@/data/editor";
import {
  buildDocumentSnapshotFromTipTapJson,
  createTipTapJsonFromPlainText,
} from "@/components/editor/editor-serialization";

type SuggestionWithIndex = ProofreadSuggestion & { sourceIndex: number };

function normalizeText(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getOrderedSuggestions(suggestions: ProofreadSuggestion[]) {
  return suggestions
    .map((suggestion, sourceIndex) => ({
      ...suggestion,
      sourceIndex,
    }))
    .sort((left, right) => {
      if (left.startOffset !== right.startOffset) {
        return left.startOffset - right.startOffset;
      }

      if (left.endOffset !== right.endOffset) {
        return left.endOffset - right.endOffset;
      }

      return left.sourceIndex - right.sourceIndex;
    });
}

function getSuggestionSegmentIds(
  snapshot: ProofreadFrozenSnapshot,
  suggestion: ProofreadSuggestion
) {
  const start = clamp(suggestion.startOffset, 0, snapshot.document.plainText.length);
  const end = clamp(suggestion.endOffset, start, snapshot.document.plainText.length);
  const textSegments = snapshot.textSegments.filter(
    (segment) => segment.proofreadable && segment.kind === "text"
  );

  const overlappingSegments = textSegments.filter((segment) => {
    if (start === end) {
      return start >= segment.startOffset && start <= segment.endOffset;
    }

    return start < segment.endOffset && end > segment.startOffset;
  });

  if (overlappingSegments.length > 0) {
    return overlappingSegments.map((segment) => segment.id);
  }

  if (textSegments.length === 0) {
    return [];
  }

  if (start === end) {
    const precedingSegment = [...textSegments]
      .reverse()
      .find((segment) => segment.endOffset <= start);

    if (precedingSegment) {
      return [precedingSegment.id];
    }
  }

  const nearestSegment =
    textSegments.find((segment) => segment.startOffset >= start) ??
    textSegments[textSegments.length - 1];

  return nearestSegment ? [nearestSegment.id] : [];
}

export function getProofreadSuggestionSegmentIds(
  snapshot: ProofreadFrozenSnapshot,
  suggestion: ProofreadSuggestion
) {
  return getSuggestionSegmentIds(snapshot, suggestion);
}

function applyAcceptedSuggestions(
  baseText: string,
  suggestions: SuggestionWithIndex[]
) {
  let cursor = 0;
  let resolvedText = "";

  for (const suggestion of suggestions) {
    if (suggestion.status !== "accepted") {
      continue;
    }

    const start = clamp(suggestion.startOffset, 0, baseText.length);
    const end = clamp(suggestion.endOffset, start, baseText.length);

    if (start < cursor) {
      continue;
    }

    resolvedText += baseText.slice(cursor, start);
    resolvedText += suggestion.replacementText;
    cursor = end;
  }

  resolvedText += baseText.slice(cursor);
  return normalizeText(resolvedText);
}

function isSuggestionInsideSegment(
  suggestion: ProofreadSuggestion,
  startOffset: number,
  endOffset: number
) {
  if (suggestion.startOffset === suggestion.endOffset) {
    return (
      suggestion.startOffset >= startOffset && suggestion.startOffset < endOffset
    );
  }

  return (
    suggestion.startOffset >= startOffset && suggestion.endOffset <= endOffset
  );
}

function parsePathPart(value: string) {
  const match = /^content\[(\d+)\]$/.exec(value);
  if (!match) {
    return null;
  }

  return Number(match[1]);
}

function getNodeChildren(node: JSONContent) {
  return Array.isArray(node.content) ? node.content : null;
}

function setSerializedNodeText(
  tiptapJson: JSONContent,
  path: string,
  text: string
) {
  const parts = path.split("/").slice(1);
  let node = tiptapJson;

  for (const part of parts) {
    const index = parsePathPart(part);
    const children = getNodeChildren(node);

    if (index === null || children === null) {
      return false;
    }

    const child = children[index];
    if (child === undefined) {
      return false;
    }

    node = child;
  }

  if (node.type !== "text") {
    return false;
  }

  node.text = text;
  return true;
}

function getSuggestionTargetSegment(
  segments: ProofreadFrozenSnapshot["textSegments"],
  suggestion: ProofreadSuggestion
) {
  const proofreadableSegments = segments.filter(
    (segment) => segment.proofreadable && segment.kind === "text"
  );

  const containingSegments = proofreadableSegments.filter((segment) =>
    isSuggestionInsideSegment(
      suggestion,
      segment.startOffset,
      segment.endOffset
    )
  );

  if (containingSegments.length === 1) {
    return containingSegments[0];
  }

  if (suggestion.startOffset === suggestion.endOffset) {
    return (
      proofreadableSegments.find(
        (segment) =>
          suggestion.startOffset >= segment.startOffset &&
          suggestion.startOffset < segment.endOffset
      ) ??
      proofreadableSegments.find(
        (segment) => suggestion.startOffset === segment.endOffset
      ) ??
      null
    );
  }

  return null;
}

function buildSegmentPatchedTipTapJson(
  snapshot: ProofreadFrozenSnapshot,
  reviewState: ProofreadReviewState
) {
  const acceptedSuggestions = getOrderedSuggestions(reviewState.suggestions).filter(
    (suggestion) => suggestion.status === "accepted"
  );
  const textSegments = snapshot.textSegments.filter(
    (segment) => segment.proofreadable && segment.kind === "text"
  );
  const suggestionsByPath = new Map<string, SuggestionWithIndex[]>();

  for (const suggestion of acceptedSuggestions) {
    const targetSegment = getSuggestionTargetSegment(textSegments, suggestion);

    if (targetSegment === null) {
      continue;
    }

    const localizedSuggestion = {
      ...suggestion,
      startOffset: suggestion.startOffset - targetSegment.startOffset,
      endOffset: suggestion.endOffset - targetSegment.startOffset,
    };

    suggestionsByPath.set(targetSegment.path, [
      ...(suggestionsByPath.get(targetSegment.path) ?? []),
      localizedSuggestion,
    ]);
  }

  const patchEntries: Array<{ path: string; text: string }> = [];

  for (const segment of textSegments) {
    const segmentSuggestions = suggestionsByPath.get(segment.path);
    if (segmentSuggestions === undefined || segmentSuggestions.length === 0) {
      continue;
    }

    patchEntries.push({
      path: segment.path,
      text: applyAcceptedSuggestions(segment.text, segmentSuggestions),
    });
  }

  const tiptapJson = structuredClone(snapshot.document.tiptapJson);

  for (const entry of patchEntries) {
    if (!setSerializedNodeText(tiptapJson, entry.path, entry.text)) {
      return null;
    }
  }

  return tiptapJson;
}

export function createEmptyReviewState(): ProofreadReviewState {
  return {
    suggestions: [],
    suggestionOrder: [],
    pendingSuggestionIds: [],
    acceptedSuggestionIds: [],
    rejectedSuggestionIds: [],
    pendingSegmentIds: [],
    resolvedPlainText: "",
  };
}

export function updateProofreadSuggestions(
  suggestions: ProofreadSuggestion[],
  suggestion: ProofreadSuggestion
) {
  const index = suggestions.findIndex((item) => item.id === suggestion.id);

  if (index === -1) {
    return [...suggestions, suggestion];
  }

  const nextSuggestions = suggestions.slice();
  nextSuggestions[index] = suggestion;
  return nextSuggestions;
}

export function setProofreadSuggestionStatus(
  suggestions: ProofreadSuggestion[],
  suggestionId: string,
  status: ProofreadSuggestion["status"]
) {
  let changed = false;
  const nextSuggestions = suggestions.map((suggestion) => {
    if (suggestion.id !== suggestionId || suggestion.status === status) {
      return suggestion;
    }

    changed = true;
    return {
      ...suggestion,
      status,
    };
  });

  return changed ? nextSuggestions : suggestions;
}

export function acceptAllProofreadSuggestions(
  suggestions: ProofreadSuggestion[]
): ProofreadSuggestion[] {
  let changed = false;
  const nextSuggestions = suggestions.map<ProofreadSuggestion>((suggestion) => {
    if (suggestion.status === "accepted") {
      return suggestion;
    }

    changed = true;
    return {
      ...suggestion,
      status: "accepted",
    };
  });

  return changed ? nextSuggestions : suggestions;
}

export function rebuildProofreadReviewState(
  snapshot: ProofreadFrozenSnapshot | null,
  suggestions: ProofreadSuggestion[]
): ProofreadReviewState {
  if (snapshot === null) {
    return createEmptyReviewState();
  }

  const orderedSuggestions = getOrderedSuggestions(suggestions);
  const suggestionOrder = suggestions.map((suggestion) => suggestion.id);
  const pendingSuggestionIds = suggestions
    .filter((suggestion) => suggestion.status === "pending")
    .map((suggestion) => suggestion.id);
  const acceptedSuggestionIds = suggestions
    .filter((suggestion) => suggestion.status === "accepted")
    .map((suggestion) => suggestion.id);
  const rejectedSuggestionIds = suggestions
    .filter((suggestion) => suggestion.status === "rejected")
    .map((suggestion) => suggestion.id);
  const pendingSegmentIds = unique(
    suggestions
      .filter((suggestion) => suggestion.status === "pending")
      .flatMap((suggestion) => getSuggestionSegmentIds(snapshot, suggestion))
  );
  const resolvedPlainText = applyAcceptedSuggestions(
    snapshot.document.plainText,
    orderedSuggestions
  );

  return {
    suggestions,
    suggestionOrder,
    pendingSuggestionIds,
    acceptedSuggestionIds,
    rejectedSuggestionIds,
    pendingSegmentIds,
    resolvedPlainText,
  };
}

export function commitProofreadReview(
  snapshot: ProofreadFrozenSnapshot,
  reviewState: ProofreadReviewState
): ProofreadDocumentSnapshot {
  const normalizedPlainText = normalizeText(reviewState.resolvedPlainText);
  const patchedTipTapJson = buildSegmentPatchedTipTapJson(snapshot, reviewState);

  if (patchedTipTapJson !== null) {
    return buildDocumentSnapshotFromTipTapJson(patchedTipTapJson);
  }

  return buildDocumentSnapshotFromTipTapJson(
    createTipTapJsonFromPlainText(normalizedPlainText)
  );
}
