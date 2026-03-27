import Link from "next/link";
import { hasPermission } from "@/data/auth";

const linkClass =
  "block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

export async function SideNavAdminLinks() {
  const [communityAdmin, siteAdmin] = await Promise.all([
    hasPermission("community:admin"),
    hasPermission("site:admin"),
  ]);

  return (
    <>
      {communityAdmin && (
        <Link href="/admin/community" className={linkClass}>
          Community Admin
        </Link>
      )}
      {siteAdmin && (
        <Link href="/admin/site" className={linkClass}>
          Site Admin
        </Link>
      )}
    </>
  );
}
