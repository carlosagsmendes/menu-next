import { Suspense } from "react";
import { forbidden } from "next/navigation";
import { getCommunityAdminAllowed } from "@/lib/permissions";
import { DelayedContent } from "@/components/DelayedContent";
import { PageLoadingFallback } from "@/components/PageLoadingFallback";

export const metadata = {
  title: "Community Admin",
  description: "Community administration area.",
};

export default async function CommunityAdminPage() {
  const allowed = await getCommunityAdminAllowed();
  if (!allowed) forbidden();

  return (
    <div className="flex flex-1 flex-col p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Community Admin
      </h1>
      <Suspense fallback={<PageLoadingFallback />}>
        <DelayedContent>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Community administration area.
          </p>
        </DelayedContent>
      </Suspense>
    </div>
  );
}
