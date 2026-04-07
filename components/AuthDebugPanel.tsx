import { headers } from "next/headers";
import { AUTH_HEADERS, getAuthenticatedUser } from "@/data/auth";

/**
 * Server component that displays proxy + render auth diagnostics.
 * Consumes `getAuthenticatedUser()` (React.cache) so placing this alongside
 * another caller proves render-tree deduplication.
 */
export async function AuthDebugPanel() {
  const [h, renderResult] = await Promise.all([
    headers(),
    getAuthenticatedUser(),
  ]);

  const proxyAuthRan = h.get(AUTH_HEADERS.proxyAuthRan) === "1";
  const proxyLookupId = h.get(AUTH_HEADERS.proxyLookupId);
  const proxyDurationMs = h.get(AUTH_HEADERS.proxyDurationMs);
  const proxyUserId = h.get(AUTH_HEADERS.userId);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-800 dark:bg-indigo-950/40">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-400">
        Auth Debug Panel
      </p>

      {/* User profile */}
      <div className="mb-4 rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-indigo-950/60">
        <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
          Authenticated User
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">userId</dt>
          <dd className="font-mono text-zinc-800 dark:text-zinc-200">{renderResult.user.userId}</dd>
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">name</dt>
          <dd className="text-zinc-800 dark:text-zinc-200">{renderResult.user.name}</dd>
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">email</dt>
          <dd className="text-zinc-800 dark:text-zinc-200">{renderResult.user.email}</dd>
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">permissions</dt>
          <dd className="font-mono text-zinc-800 dark:text-zinc-200">
            {renderResult.user.permissions.join(", ")}
          </dd>
        </dl>
      </div>

      {/* Proxy diagnostics */}
      <div className="mb-3 rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-indigo-950/60">
        <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
          Proxy Lookup
        </p>
        {proxyAuthRan ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">lookupId</dt>
            <dd className="font-mono text-zinc-800 dark:text-zinc-200">{proxyLookupId}</dd>
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">userId</dt>
            <dd className="font-mono text-zinc-800 dark:text-zinc-200">{proxyUserId}</dd>
            <dt className="font-medium text-zinc-500 dark:text-zinc-400">duration</dt>
            <dd className="font-mono text-zinc-800 dark:text-zinc-200">{proxyDurationMs} ms</dd>
          </dl>
        ) : (
          <p className="text-sm text-zinc-400 italic">Proxy auth did not run for this request</p>
        )}
      </div>

      {/* Render diagnostics */}
      <div className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-indigo-950/60">
        <p className="mb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">
          Render Lookup (React.cache)
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">lookupId</dt>
          <dd className="font-mono text-zinc-800 dark:text-zinc-200">{renderResult.lookupId}</dd>
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">source</dt>
          <dd className="font-mono text-zinc-800 dark:text-zinc-200">{renderResult.source}</dd>
          <dt className="font-medium text-zinc-500 dark:text-zinc-400">duration</dt>
          <dd className="font-mono text-zinc-800 dark:text-zinc-200">{renderResult.durationMs} ms</dd>
        </dl>
      </div>
    </div>
  );
}

/**
 * A second consumer of `getAuthenticatedUser()` — renders the same render
 * lookupId, proving React.cache deduped within this request.
 */
export async function AuthDedupeProof() {
  const renderResult = await getAuthenticatedUser();

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/40">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-500 dark:text-emerald-400">
        Dedupe Proof (second call site)
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Render lookupId:{" "}
        <code className="font-mono font-medium text-zinc-800 dark:text-zinc-200">
          {renderResult.lookupId}
        </code>
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
        If this matches the panel above, React.cache deduped the backend lookup.
      </p>
    </div>
  );
}
