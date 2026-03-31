import { type Editor, type JSONContent } from "@tiptap/core";
import { generateHTML, generateJSON } from "@tiptap/html";
import type {
  ProofreadDocumentSnapshot,
  ProofreadFrozenSnapshot,
  ProofreadTextSegment,
} from "@/data/editor";
import { createStaticEditorExtensions } from "@/components/editor/editor-config";

type SnapshotBuilderState = {
  plainText: string;
  textSegments: ProofreadTextSegment[];
};

function getNodeChildren(node: JSONContent) {
  return Array.isArray(node.content) ? node.content : [];
}

function getNodeType(node: JSONContent) {
  return node.type ?? "";
}

function getNodeText(node: JSONContent) {
  return typeof node.text === "string" ? node.text : "";
}

export function normalizeProofreadText(value: string) {
  return value.replace(/\r\n?/g, "\n");
}

function createSnapshotBuilder() {
  const state: SnapshotBuilderState = {
    plainText: "",
    textSegments: [],
  };
  let nextSegmentId = 0;

  function appendSegment(segment: Omit<ProofreadTextSegment, "id">) {
    const normalizedText = normalizeProofreadText(segment.text);
    const startOffset = state.plainText.length;
    state.plainText += normalizedText;
    state.textSegments.push({
      ...segment,
      id: `segment-${nextSegmentId += 1}`,
      text: normalizedText,
      startOffset,
      endOffset: startOffset + normalizedText.length,
    });
  }

  function childSeparatorForNodeType(type: string) {
    switch (type) {
      case "doc":
        return "\n\n";
      case "blockquote":
      case "bulletList":
      case "orderedList":
      case "listItem":
        return "\n";
      default:
        return "";
    }
  }

  function visitNode(
    node: JSONContent,
    path: string,
    proofreadable = true
  ) {
    const nodeType = getNodeType(node);

    if (nodeType === "text") {
      const text = getNodeText(node);
      if (text.length === 0) {
        return;
      }

      appendSegment({
        path,
        kind: "text",
        text,
        startOffset: 0,
        endOffset: 0,
        proofreadable,
      });
      return;
    }

    if (nodeType === "hardBreak") {
      appendSegment({
        path,
        kind: "line-break",
        text: "\n",
        startOffset: 0,
        endOffset: 0,
        proofreadable: false,
      });
      return;
    }

    const children = getNodeChildren(node);
    if (children.length === 0) {
      return;
    }

    const separator = childSeparatorForNodeType(nodeType);
    const nextProofreadable = proofreadable && nodeType !== "codeBlock";

    children.forEach((child, index) => {
      if (index > 0 && separator !== "") {
        appendSegment({
          path: `${path}/separator[${index - 1}]`,
          kind: "separator",
          text: separator,
          startOffset: 0,
          endOffset: 0,
          proofreadable: false,
        });
      }

      visitNode(child, `${path}/content[${index}]`, nextProofreadable);
    });
  }

  return {
    appendRoot(root: JSONContent) {
      visitNode(root, "doc");
    },
    build() {
      return state;
    },
  };
}

function collectSnapshotParts(tiptapJson: JSONContent) {
  const builder = createSnapshotBuilder();
  builder.appendRoot(tiptapJson);
  return builder.build();
}

export function buildHtmlFromPlainText(text: string) {
  return normalizeProofreadText(text)
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function createTipTapJsonFromPlainText(text: string) {
  return generateJSON(
    buildHtmlFromPlainText(text),
    createStaticEditorExtensions()
  );
}

export function buildDocumentSnapshotFromTipTapJson(
  tiptapJson: JSONContent,
  htmlOverride?: string
): ProofreadDocumentSnapshot {
  const normalizedJson = structuredClone(tiptapJson);
  const { plainText } = collectSnapshotParts(normalizedJson);

  return {
    tiptapJson: normalizedJson,
    plainText,
    html:
      htmlOverride ??
      normalizeProofreadText(
        generateHTML(normalizedJson, createStaticEditorExtensions())
      ),
  };
}

export function captureEditorSnapshot(editor: Editor): ProofreadDocumentSnapshot {
  return buildDocumentSnapshotFromTipTapJson(
    editor.getJSON(),
    normalizeProofreadText(editor.getHTML())
  );
}

export function captureProofreadSnapshot(
  editor: Editor,
  createdAt = new Date().toISOString()
): ProofreadFrozenSnapshot {
  const document = captureEditorSnapshot(editor);

  return {
    createdAt,
    document,
    textSegments: collectProofreadTextSegments(document.tiptapJson),
  };
}

export function collectProofreadTextSegments(tiptapJson: JSONContent) {
  return collectSnapshotParts(tiptapJson).textSegments;
}
