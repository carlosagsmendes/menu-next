import { Suspense } from "react";
import { forbidden } from "next/navigation";
import { getSiteAdminAllowed } from "@/lib/permissions";
import { DelayedContent } from "@/components/DelayedContent";
import { PageLoadingFallback } from "@/components/PageLoadingFallback";

export const metadata = {
  title: "Site Admin",
  description: "Site administration area.",
};

export default async function SiteAdminPage() {
  const allowed = await getSiteAdminAllowed();
  if (!allowed) forbidden();

  return (
    <div className="flex flex-1 flex-col p-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Site Admin
      </h1>
      <Suspense fallback={<PageLoadingFallback />}>
        <DelayedContent>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            Site administration area.
          </p>
        </DelayedContent>
      </Suspense>
    </div>
  );
}
