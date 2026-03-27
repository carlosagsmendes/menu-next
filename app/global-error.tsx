"use client";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body className="flex min-h-screen items-center justify-center bg-white font-sans dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4 p-8">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Something went wrong
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {error.message || "A critical error occurred."}
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
