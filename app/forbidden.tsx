export default function Forbidden() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8">
      <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        Access Denied
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You don&apos;t have permission to view this page.
      </p>
    </div>
  );
}
