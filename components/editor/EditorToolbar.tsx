"use client";

import type { ReactNode } from "react";
import { useTiptap, useTiptapState } from "@tiptap/react";
import {
  normalizeEditorUrl,
  validateEditorUrl,
} from "@/components/editor/editor-config";

function ToolbarButton({
  children,
  label,
  active = false,
  disabled,
  onClick,
}: {
  children: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center rounded-full border px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
          : "border-zinc-200 bg-white text-zinc-700 hover:-translate-y-0.5 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function ToolbarGroup({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-zinc-200 bg-white/90 p-1 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/90">
      {children}
    </div>
  );
}

function ToolbarBody({ disabled }: { disabled: boolean }) {
  const { editor } = useTiptap();
  const state = useTiptapState((snapshot) => ({
    canUndo: snapshot.editor.can().chain().focus().undo().run(),
    canRedo: snapshot.editor.can().chain().focus().redo().run(),
    canHardBreak: snapshot.editor.can().chain().focus().setHardBreak().run(),
    isParagraph: snapshot.editor.isActive("paragraph"),
    isHeading1: snapshot.editor.isActive("heading", { level: 1 }),
    isHeading2: snapshot.editor.isActive("heading", { level: 2 }),
    isHeading3: snapshot.editor.isActive("heading", { level: 3 }),
    isBlockquote: snapshot.editor.isActive("blockquote"),
    isBold: snapshot.editor.isActive("bold"),
    isItalic: snapshot.editor.isActive("italic"),
    isStrike: snapshot.editor.isActive("strike"),
    isOrderedList: snapshot.editor.isActive("orderedList"),
    isBulletList: snapshot.editor.isActive("bulletList"),
    isLink: snapshot.editor.isActive("link"),
  }));

  function handleLink() {
    const currentHref = editor.getAttributes("link").href;
    const nextUrl = window.prompt(
      "Link URL",
      typeof currentHref === "string" ? currentHref : ""
    );

    if (nextUrl === null) {
      return;
    }

    const trimmedUrl = nextUrl.trim();
    if (trimmedUrl === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const normalizedUrl = normalizeEditorUrl(trimmedUrl);
    if (!validateEditorUrl(normalizedUrl)) {
      window.alert("Enter a valid http or https URL.");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: normalizedUrl })
      .run();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToolbarGroup>
        <ToolbarButton
          label="Undo"
          disabled={disabled || !state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={disabled || !state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        >
          Redo
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="Paragraph"
          active={state.isParagraph}
          disabled={disabled}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          P
        </ToolbarButton>
        <ToolbarButton
          label="Heading 1"
          active={state.isHeading1}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={state.isHeading2}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={state.isHeading3}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={state.isBlockquote}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="Bold"
          active={state.isBold}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          Bold
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={state.isItalic}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </ToolbarButton>
        <ToolbarButton
          label="Strike"
          active={state.isStrike}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          Strike
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label="Ordered list"
          active={state.isOrderedList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          OL
        </ToolbarButton>
        <ToolbarButton
          label="Unordered list"
          active={state.isBulletList}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          UL
        </ToolbarButton>
        <ToolbarButton
          label="Line break"
          disabled={disabled || !state.canHardBreak}
          onClick={() => editor.chain().focus().setHardBreak().run()}
        >
          Break
        </ToolbarButton>
      </ToolbarGroup>

      <ToolbarGroup>
        <ToolbarButton
          label={state.isLink ? "Edit link" : "Add link"}
          active={state.isLink}
          disabled={disabled}
          onClick={handleLink}
        >
          Link
        </ToolbarButton>
      </ToolbarGroup>
    </div>
  );
}

export function EditorToolbar({ disabled = false }: { disabled?: boolean }) {
  return <ToolbarBody disabled={disabled} />;
}
