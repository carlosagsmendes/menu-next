import { SideNavClient } from "@/components/SideNavClient";
import { hasPermission } from "@/data/auth";
import {
  COMMUNITY_ADMIN_SIDE_NAV_ITEM,
  PUBLIC_SIDE_NAV_ITEMS,
  SITE_ADMIN_SIDE_NAV_ITEM,
  type SideNavItem,
} from "@/lib/menu";

export async function SideNav() {
  const [communityAdmin, siteAdmin] = await Promise.all([
    hasPermission("community:admin"),
    hasPermission("site:admin"),
  ]);

  const items: SideNavItem[] = [...PUBLIC_SIDE_NAV_ITEMS];

  if (communityAdmin) {
    items.push(COMMUNITY_ADMIN_SIDE_NAV_ITEM);
  }

  if (siteAdmin) {
    items.push(SITE_ADMIN_SIDE_NAV_ITEM);
  }

  return (
    <aside className="w-full border-b border-zinc-200/80 bg-zinc-50/85 backdrop-blur md:w-52 md:shrink-0 md:border-b-0 md:border-r dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="px-4 py-3 md:p-4">
        <div className="md:rounded-[1.5rem] md:border md:border-zinc-200 md:bg-white/80 md:p-3 md:shadow-sm md:dark:border-zinc-800 md:dark:bg-zinc-950/70">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400 md:mb-3">
            Menu
          </p>
          <SideNavClient items={items} />
        </div>
      </div>
    </aside>
  );
}
