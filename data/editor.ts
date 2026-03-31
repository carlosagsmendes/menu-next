import type { JSONContent } from "@tiptap/core";

export type ProofreadRunStatus =
  | "idle"
  | "streaming"
  | "review"
  | "complete"
  | "error";

export type ProofreadSuggestionStatus = "pending" | "accepted" | "rejected";

export type ProofreadSuggestionKind = "insert" | "delete" | "replace";

export type SerializedTipTapState = JSONContent;

export type ProofreadTextSegmentKind = "text" | "line-break" | "separator";

export type ProofreadTextSegment = {
  id: string;
  path: string;
  kind: ProofreadTextSegmentKind;
  text: string;
  startOffset: number;
  endOffset: number;
  proofreadable: boolean;
};

export type ProofreadDocumentSnapshot = {
  tiptapJson: SerializedTipTapState;
  plainText: string;
  html: string;
};

export type ProofreadFrozenSnapshot = {
  createdAt: string;
  document: ProofreadDocumentSnapshot;
  textSegments: ProofreadTextSegment[];
};

export type ProofreadSuggestion = {
  id: string;
  status: ProofreadSuggestionStatus;
  kind: ProofreadSuggestionKind;
  startOffset: number;
  endOffset: number;
  originalText: string;
  replacementText: string;
  reason: string;
};

export type ProofreadEvent =
  | {
      type: "run-start";
      runId: string;
      startedAt: string;
    }
  | {
      type: "suggestion";
      runId: string;
      suggestion: ProofreadSuggestion;
    }
  | {
      type: "complete";
      runId: string;
      completedAt: string;
    }
  | {
      type: "error";
      runId: string;
      message: string;
    };

export type ProofreadRequestPayload = {
  plainText: string;
  html: string;
  tiptapJson: SerializedTipTapState;
};

export type EditorDraftState = {
  document: ProofreadDocumentSnapshot;
  lastEditedAt: string | null;
};

export type EditorFrozenSnapshot = {
  snapshot: ProofreadFrozenSnapshot | null;
};

export type ProofreadReviewState = {
  suggestions: ProofreadSuggestion[];
  suggestionOrder: string[];
  pendingSuggestionIds: string[];
  acceptedSuggestionIds: string[];
  rejectedSuggestionIds: string[];
  pendingSegmentIds: string[];
  resolvedPlainText: string;
};

export type ProofreadRunState = {
  status: ProofreadRunStatus;
  runId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
};

export type EditorWorkspaceState = {
  draft: EditorDraftState;
  frozenSnapshot: EditorFrozenSnapshot;
  review: ProofreadReviewState;
  selectedSuggestionId: string | null;
  run: ProofreadRunState;
};

const INITIAL_TIPTAP_STATE = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
} satisfies SerializedTipTapState;

const INITIAL_DOCUMENT: ProofreadDocumentSnapshot = {
  tiptapJson: INITIAL_TIPTAP_STATE,
  plainText: "",
  html: "<p></p>",
};

export function createProofreadRequestPayload(
  document: ProofreadDocumentSnapshot
): ProofreadRequestPayload {
  return {
    plainText: document.plainText,
    html: document.html,
    tiptapJson: document.tiptapJson,
  };
}

export function createInitialProofreadRunState(): ProofreadRunState {
  return {
    status: "idle",
    runId: null,
    startedAt: null,
    finishedAt: null,
    errorMessage: null,
  };
}

export function createInitialEditorWorkspaceState(): EditorWorkspaceState {
  return {
    draft: {
      document: INITIAL_DOCUMENT,
      lastEditedAt: null,
    },
    frozenSnapshot: {
      snapshot: null,
    },
    review: {
      suggestions: [],
      suggestionOrder: [],
      pendingSuggestionIds: [],
      acceptedSuggestionIds: [],
      rejectedSuggestionIds: [],
      pendingSegmentIds: [],
      resolvedPlainText: INITIAL_DOCUMENT.plainText,
    },
    selectedSuggestionId: null,
    run: createInitialProofreadRunState(),
  };
}
