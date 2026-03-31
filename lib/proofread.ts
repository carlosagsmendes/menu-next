import "server-only";

import { generateText, Output } from "ai";
import { z } from "zod";

import type {
  ProofreadEvent,
  ProofreadRequestPayload,
  ProofreadSuggestion,
} from "@/data/editor";
import { getLMStudioProofreadModel } from "@/lib/ai/lmstudio";

const STREAM_DELAY_MS = 30;
const MAX_SUGGESTIONS = 3;

const proofreadSuggestionSchema = z.object({
  kind: z.enum(["insert", "delete", "replace"]),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative(),
  originalText: z.string(),
  replacementText: z.string(),
  reason: z.string().min(1),
});

const proofreadResponseSchema = z.object({
  suggestions: z.array(proofreadSuggestionSchema).max(MAX_SUGGESTIONS),
});

type ProofreadSuggestionInput = z.infer<typeof proofreadSuggestionSchema>;

type ProofreadSuggestionCandidate = ProofreadSuggestionInput & {
  sourceIndex: number;
};

class ProofreadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProofreadValidationError";
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createRunId(payload: ProofreadRequestPayload) {
  const seed = `${payload.plainText}|${payload.html}|${JSON.stringify(payload.tiptapJson)}`;
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `run_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizePlainText(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function createSuggestionId(runId: string, index: number) {
  return `${runId}_suggestion_${index + 1}`;
}

function createSuggestion(
  runId: string,
  index: number,
  suggestion: Omit<ProofreadSuggestion, "id">
) {
  return {
    id: createSuggestionId(runId, index),
    ...suggestion,
  };
}

function buildProofreadPrompt(payload: ProofreadRequestPayload) {
  const normalizedText = normalizePlainText(payload.plainText);

  return [
    "You are a careful proofreader for an editor review flow.",
    "Make only conservative changes: spelling, grammar, punctuation, agreement, and light clarity.",
    "Return at most three suggestions.",
    "Prefer the smallest possible edit and do not rewrite the whole draft.",
    "Offsets are zero-based character offsets into the plainText block below and nowhere else.",
    "For insert suggestions, originalText must be an empty string and startOffset must equal endOffset.",
    "For delete and replace suggestions, originalText must exactly match the slice of plainText covered by the offsets.",
    "Double-check every offset against plainText before responding.",
    "Keep reason short and direct. Do not include alternatives, self-corrections, or thinking-out-loud.",
    "Each suggestion must be non-overlapping, minimal, and sorted by startOffset.",
    "If no change is needed, return an empty suggestions array.",
    `plainText:\n<<<PLAINTEXT\n${normalizedText}\nPLAINTEXT`,
  ].join("\n\n");
}

function compareSuggestionCandidates(
  left: ProofreadSuggestionCandidate,
  right: ProofreadSuggestionCandidate
) {
  if (left.startOffset !== right.startOffset) {
    return left.startOffset - right.startOffset;
  }

  if (left.endOffset !== right.endOffset) {
    return left.endOffset - right.endOffset;
  }

  const kindOrder = {
    delete: 0,
    replace: 1,
    insert: 2,
  } as const;

  const leftKind = kindOrder[left.kind];
  const rightKind = kindOrder[right.kind];

  if (leftKind !== rightKind) {
    return leftKind - rightKind;
  }

  if (left.replacementText !== right.replacementText) {
    return left.replacementText.localeCompare(right.replacementText);
  }

  if (left.reason !== right.reason) {
    return left.reason.localeCompare(right.reason);
  }

  if (left.originalText !== right.originalText) {
    return left.originalText.localeCompare(right.originalText);
  }

  return left.sourceIndex - right.sourceIndex;
}

function compareValidatedSuggestions(
  left: ProofreadSuggestion,
  right: ProofreadSuggestion
) {
  if (left.startOffset !== right.startOffset) {
    return left.startOffset - right.startOffset;
  }

  if (left.endOffset !== right.endOffset) {
    return left.endOffset - right.endOffset;
  }

  const kindOrder = {
    delete: 0,
    replace: 1,
    insert: 2,
  } as const;

  const leftKind = kindOrder[left.kind];
  const rightKind = kindOrder[right.kind];

  if (leftKind !== rightKind) {
    return leftKind - rightKind;
  }

  if (left.replacementText !== right.replacementText) {
    return left.replacementText.localeCompare(right.replacementText);
  }

  if (left.reason !== right.reason) {
    return left.reason.localeCompare(right.reason);
  }

  return left.originalText.localeCompare(right.originalText);
}

function suggestionsOverlap(
  left: Pick<ProofreadSuggestion, "kind" | "startOffset" | "endOffset">,
  right: Pick<ProofreadSuggestion, "kind" | "startOffset" | "endOffset">
) {
  if (left.kind === "insert" && right.kind === "insert") {
    return left.startOffset === right.startOffset;
  }

  if (left.kind === "insert") {
    return left.startOffset >= right.startOffset && left.startOffset <= right.endOffset;
  }

  if (right.kind === "insert") {
    return right.startOffset >= left.startOffset && right.startOffset <= left.endOffset;
  }

  return left.startOffset < right.endOffset && left.endOffset > right.startOffset;
}

function findExactMatchRanges(plainText: string, originalText: string) {
  if (originalText.length === 0) {
    return [];
  }

  const matches: Array<{ startOffset: number; endOffset: number }> = [];
  let searchIndex = 0;

  while (searchIndex <= plainText.length - originalText.length) {
    const matchIndex = plainText.indexOf(originalText, searchIndex);

    if (matchIndex === -1) {
      break;
    }

    matches.push({
      startOffset: matchIndex,
      endOffset: matchIndex + originalText.length,
    });

    searchIndex = matchIndex + 1;
  }

  return matches;
}

function resolveExistingTextRange(
  plainText: string,
  originalText: string,
  suggestedStartOffset: number
) {
  if (originalText.length === 0) {
    return null;
  }

  const exactEndOffset = suggestedStartOffset + originalText.length;
  if (
    suggestedStartOffset >= 0 &&
    exactEndOffset <= plainText.length &&
    plainText.slice(suggestedStartOffset, exactEndOffset) === originalText
  ) {
    return {
      startOffset: suggestedStartOffset,
      endOffset: exactEndOffset,
    };
  }

  const matches = findExactMatchRanges(plainText, originalText);

  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const rankedMatches = matches
    .map((match) => ({
      ...match,
      distance: Math.abs(match.startOffset - suggestedStartOffset),
    }))
    .sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }

      return left.startOffset - right.startOffset;
    });

  if (rankedMatches[0].distance < rankedMatches[1].distance) {
    return rankedMatches[0];
  }

  return null;
}

function isTerminalPunctuationInsert(replacementText: string) {
  return /^[.!?]+$/.test(replacementText);
}

function buildValidatedSuggestion(
  runId: string,
  index: number,
  candidate: ProofreadSuggestionInput,
  plainText: string
) {
  const plainTextLength = plainText.length;
  const { kind, startOffset, endOffset, originalText, replacementText, reason } =
    candidate;
  const normalizedReason = reason.trim();

  if (normalizedReason.length === 0) {
    return null;
  }

  if (kind === "insert") {
    if (originalText !== "" || replacementText.length === 0) {
      return null;
    }

    const canUseExactInsert =
      startOffset === endOffset &&
      startOffset >= 0 &&
      endOffset <= plainTextLength;
    const canClampToDocumentEnd =
      startOffset >= plainTextLength &&
      endOffset >= plainTextLength &&
      isTerminalPunctuationInsert(replacementText);

    if (!canUseExactInsert && !canClampToDocumentEnd) {
      return null;
    }

    const insertionOffset = canUseExactInsert ? startOffset : plainTextLength;

    return createSuggestion(runId, index, {
      status: "pending",
      kind: "insert",
      startOffset: insertionOffset,
      endOffset: insertionOffset,
      originalText: "",
      replacementText,
      reason: normalizedReason,
    });
  }

  if (originalText.length === 0) {
    return null;
  }

  if (kind === "delete" && replacementText.length !== 0) {
    return null;
  }

  if (kind === "replace" && replacementText.length === 0) {
    return null;
  }

  const resolvedRange = resolveExistingTextRange(
    plainText,
    originalText,
    startOffset
  );

  if (resolvedRange === null) {
    return null;
  }

  return createSuggestion(runId, index, {
    status: "pending",
    kind,
    startOffset: resolvedRange.startOffset,
    endOffset: resolvedRange.endOffset,
    originalText: plainText.slice(resolvedRange.startOffset, resolvedRange.endOffset),
    replacementText,
    reason: normalizedReason,
  });
}

async function buildProofreadSuggestions(
  payload: ProofreadRequestPayload,
  runId: string
): Promise<ProofreadSuggestion[]> {
  const normalizedText = normalizePlainText(payload.plainText);
  const result = await generateText({
    model: getLMStudioProofreadModel(),
    system:
      "You are a conservative proofreader. Only suggest tiny, local edits.",
    prompt: buildProofreadPrompt(payload),
    output: Output.object({
      schema: proofreadResponseSchema,
      name: "proofread_suggestions",
    }),
    temperature: 0,
    maxOutputTokens: 512,
    maxRetries: 1,
  });

  const candidates = (result.output?.suggestions ?? [])
    .map((candidate, sourceIndex) => ({ ...candidate, sourceIndex }))
    .sort(compareSuggestionCandidates);

  const validatedSuggestions = candidates
    .map((candidate) =>
      buildValidatedSuggestion(runId, candidate.sourceIndex, candidate, normalizedText)
    )
    .filter((suggestion): suggestion is ProofreadSuggestion => suggestion !== null)
    .sort(compareValidatedSuggestions);

  const acceptedSuggestions: ProofreadSuggestion[] = [];

  for (const validatedSuggestion of validatedSuggestions) {
    const overlapsExisting = acceptedSuggestions.some((existing) =>
      suggestionsOverlap(validatedSuggestion, existing)
    );

    if (!overlapsExisting) {
      acceptedSuggestions.push(validatedSuggestion);
    }
  }

  return acceptedSuggestions.slice(0, MAX_SUGGESTIONS);
}

export function createProofreadErrorEvent(
  runId: string,
  message: string
): ProofreadEvent {
  return {
    type: "error",
    runId,
    message,
  };
}

function safeProofreadErrorMessage(error: unknown) {
  if (error instanceof ProofreadValidationError) {
    return error.message;
  }

  return "Proofread stream failed.";
}

export async function* proofreadDocumentStream(
  payload: ProofreadRequestPayload
): AsyncGenerator<ProofreadEvent> {
  const runId = createRunId(payload);

  try {
    yield {
      type: "run-start",
      runId,
      startedAt: new Date().toISOString(),
    };

    const suggestions = await buildProofreadSuggestions(payload, runId);

    for (const suggestion of suggestions) {
      await sleep(STREAM_DELAY_MS);
      yield {
        type: "suggestion",
        runId,
        suggestion,
      };
    }

    await sleep(STREAM_DELAY_MS);
    yield {
      type: "complete",
      runId,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    yield createProofreadErrorEvent(runId, safeProofreadErrorMessage(error));
  }
}

export function validateProofreadRequestPayload(
  value: unknown
): value is ProofreadRequestPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const payload = value as Partial<Record<keyof ProofreadRequestPayload, unknown>>;

  return (
    typeof payload.plainText === "string" &&
    typeof payload.html === "string" &&
    typeof payload.tiptapJson === "object" &&
    payload.tiptapJson !== null
  );
}
