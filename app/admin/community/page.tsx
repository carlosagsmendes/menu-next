import { simulatePageLoad } from "@/lib/simulate-page-load";

export default async function CommunityAdminPage() {
  await simulatePageLoad();
  return (
    <div className="flex flex-1 flex-col p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Community Admin
      </h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Community administration area.
      </p>
    </div>
  );
}
