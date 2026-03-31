import type { Extensions } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";

export const EDITOR_PLACEHOLDER =
  "Start writing here. Shape the draft before you freeze it for review.";

export const EDITOR_CONTENT_CLASS_NAME =
  "min-h-[24rem] cursor-text px-5 py-4 text-sm leading-7 text-zinc-950 outline-none dark:text-zinc-50 [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-zinc-400 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] dark:[&_.is-editor-empty:first-child::before]:text-zinc-600 [&_p]:mb-3 [&_p]:leading-7 [&_p:last-child]:mb-0 [&_h1]:mb-4 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-50/70 [&_blockquote]:px-4 [&_blockquote]:py-3 [&_blockquote]:text-zinc-700 dark:[&_blockquote]:border-amber-500/60 dark:[&_blockquote]:bg-amber-500/10 dark:[&_blockquote]:text-zinc-200 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6 [&_li]:leading-7 [&_a]:text-sky-600 [&_a]:underline [&_a]:decoration-sky-500/40 [&_a]:underline-offset-2 dark:[&_a]:text-sky-400 [&_strong]:font-semibold [&_strong]:text-zinc-950 dark:[&_strong]:text-zinc-50 [&_em]:italic [&_s]:decoration-zinc-400/80";

export function normalizeEditorUrl(url: string) {
  const trimmedUrl = url.trim();

  if (trimmedUrl === "") {
    return "";
  }

  if (/^[a-z]+:\/\//i.test(trimmedUrl)) {
    return trimmedUrl;
  }

  return `https://${trimmedUrl}`;
}

export function validateEditorUrl(url: string) {
  try {
    const parsed = new URL(normalizeEditorUrl(url));
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function createStaticEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      code: false,
      codeBlock: false,
      heading: {
        levels: [1, 2, 3],
      },
      horizontalRule: false,
      link: false,
      underline: false,
    }),
    Link.configure({
      autolink: false,
      defaultProtocol: "https",
      enableClickSelection: true,
      HTMLAttributes: {
        class:
          "text-sky-600 underline decoration-sky-500/40 underline-offset-2 dark:text-sky-400",
        rel: null,
        target: null,
      },
      isAllowedUri: (url) => validateEditorUrl(url),
      linkOnPaste: true,
      openOnClick: false,
    }),
  ];
}

export function createEditorExtensions(
  placeholder = EDITOR_PLACEHOLDER
): Extensions {
  return [
    ...createStaticEditorExtensions(),
    Placeholder.configure({
      emptyEditorClass: "is-editor-empty",
      placeholder,
      showOnlyCurrent: false,
    }),
  ];
}
