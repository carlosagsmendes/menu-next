import Link from "next/link";
import { hasPermission } from "@/data/auth";

const defaultLinkClass =
  "inline-flex shrink-0 items-center rounded-full px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:w-full md:rounded-xl";

export async function SideNavAdminLinks({
  className = defaultLinkClass,
}: {
  className?: string;
}) {
  const [communityAdmin, siteAdmin] = await Promise.all([
    hasPermission("community:admin"),
    hasPermission("site:admin"),
  ]);

  return (
    <>
      {communityAdmin && (
        <Link href="/admin/community" className={className}>
          Community Admin
        </Link>
      )}
      {siteAdmin && (
        <Link href="/admin/site" className={className}>
          Site Admin
        </Link>
      )}
    </>
  );
}
