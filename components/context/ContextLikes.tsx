"use client";

import { createContext, startTransition, useContext, useState, type ReactNode } from "react";

import { incrementContextPostLikesAction } from "@/app/(shell)/(public)/context/actions";

type ContextLikesValue = {
  displayedLikes: number;
  pendingDelta: number;
  pendingLocalLikes: number;
  isSyncing: boolean;
  errorMessage: string | null;
  incrementLocal: () => void;
  commitServerIncrement: () => Promise<void>;
  syncPendingLikes: () => Promise<void>;
};

const ContextLikesContext = createContext<ContextLikesValue | null>(null);

export function ContextLikesProvider({
  children,
  initialLikes,
  postId,
}: {
  children: ReactNode;
  initialLikes: number;
  postId: string;
}) {
  const [confirmedLikes, setConfirmedLikes] = useState(initialLikes);
  const [pendingLocalLikes, setPendingLocalLikes] = useState(0);
  const [pendingServerLikes, setPendingServerLikes] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function syncLikes(additionalLikes: number) {
    if (isSyncing) {
      return;
    }

    const localLikesToCommit = pendingLocalLikes;
    if (additionalLikes === 0 && localLikesToCommit === 0) {
      return;
    }

    const totalLikesToCommit = localLikesToCommit + additionalLikes;

    setErrorMessage(null);
    setPendingServerLikes(additionalLikes);
    setIsSyncing(true);

    try {
      const likes = await incrementContextPostLikesAction(postId, totalLikesToCommit);
      setConfirmedLikes(likes);
      setPendingLocalLikes((current) =>
        Math.max(0, current - localLikesToCommit),
      );
      setPendingServerLikes(0);
    } catch {
      setPendingLocalLikes((current) => current + additionalLikes);
      setPendingServerLikes(0);
      setErrorMessage("Couldn't sync likes. Your local likes are still queued in context.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function commitServerIncrement() {
    await syncLikes(1);
  }

  async function syncPendingLikes() {
    await syncLikes(0);
  }

  function incrementLocal() {
    setErrorMessage(null);
    setPendingLocalLikes((current) => current + 1);
  }

  const pendingDelta = pendingLocalLikes + pendingServerLikes;

  return (
    <ContextLikesContext.Provider
      value={{
        displayedLikes: confirmedLikes + pendingDelta,
        pendingDelta,
        pendingLocalLikes,
        isSyncing,
        errorMessage,
        incrementLocal,
        commitServerIncrement,
        syncPendingLikes,
      }}
    >
      {children}
    </ContextLikesContext.Provider>
  );
}

export function useContextPostLikes() {
  const context = useContext(ContextLikesContext);

  if (!context) {
    throw new Error("useContextPostLikes must be used within ContextLikesProvider");
  }

  return context;
}

export function ContextTitleLikesControl() {
  const {
    commitServerIncrement,
    displayedLikes,
    errorMessage,
    isSyncing,
    pendingLocalLikes,
  } = useContextPostLikes();

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-left dark:border-emerald-900 dark:bg-emerald-950/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
        Server Action
      </p>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {displayedLikes} likes
        </span>
        <button
          type="button"
          onClick={() => startTransition(() => void commitServerIncrement())}
          disabled={isSyncing}
          className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:disabled:bg-emerald-800"
        >
          {isSyncing ? "Saving..." : "Like + sync"}
        </button>
      </div>

      <p className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-200/80">
        {pendingLocalLikes > 0
          ? `${pendingLocalLikes} local likes are still waiting to sync.`
          : "Adds one like and persists the shared counter on the server."}
      </p>

      {errorMessage ? (
        <p className="mt-2 text-xs text-rose-700 dark:text-rose-300">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}

export function ContextClientLikesDemo() {
  const {
    displayedLikes,
    incrementLocal,
    isSyncing,
    pendingLocalLikes,
    syncPendingLikes,
  } =
    useContextPostLikes();

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
            Client Component
          </p>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Shared likes demo
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This button only updates React context in the browser, so both likes
            readouts move instantly before anything is persisted.
          </p>
        </div>

        <div className="rounded-xl bg-zinc-100 px-4 py-3 text-right dark:bg-zinc-800">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Shared Likes
          </p>
          <p className="mt-1 text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
            {displayedLikes}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={incrementLocal}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Add local like
        </button>

        <button
          type="button"
          onClick={() => startTransition(() => void syncPendingLikes())}
          disabled={isSyncing || pendingLocalLikes === 0}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {isSyncing ? "Syncing..." : "Sync pending likes"}
        </button>

        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {pendingLocalLikes > 0
            ? `${pendingLocalLikes} local likes are waiting to sync.`
            : "No local likes are waiting to be synced yet."}
        </p>

        {isSyncing ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            Server sync in flight...
          </span>
        ) : null}
      </div>
    </section>
  );
}
