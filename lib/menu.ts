export type MenuItemId =
  | "home"
  | "blog"
  | "context"
  | "blogNoStreaming"
  | "editor"
  | "events"
  | "adminCommunity"
  | "adminSite";

export type SideNavMatchMode = "exact" | "section";

export type SideNavItem = {
  id: MenuItemId;
  href: string;
  label: string;
  matchMode: SideNavMatchMode;
};

export const PUBLIC_SIDE_NAV_ITEMS = [
  {
    id: "home",
    href: "/",
    label: "Home",
    matchMode: "exact",
  },
  {
    id: "blog",
    href: "/blog",
    label: "Blog",
    matchMode: "section",
  },
  {
    id: "context",
    href: "/context",
    label: "Context",
    matchMode: "section",
  },
  {
    id: "blogNoStreaming",
    href: "/blog-no-streaming",
    label: "Blog No Streaming",
    matchMode: "section",
  },
  {
    id: "editor",
    href: "/editor",
    label: "Editor",
    matchMode: "section",
  },
  {
    id: "events",
    href: "/events",
    label: "Events",
    matchMode: "section",
  },
] satisfies SideNavItem[];

export const COMMUNITY_ADMIN_SIDE_NAV_ITEM = {
  id: "adminCommunity",
  href: "/admin/community",
  label: "Community Admin",
  matchMode: "section",
} satisfies SideNavItem;

export const SITE_ADMIN_SIDE_NAV_ITEM = {
  id: "adminSite",
  href: "/admin/site",
  label: "Site Admin",
  matchMode: "section",
} satisfies SideNavItem;

export function matchesSideNavItem(item: SideNavItem, pathname: string) {
  if (item.matchMode === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getActiveSideNavItemId(
  items: readonly SideNavItem[],
  pathname: string
) {
  return items.find((item) => matchesSideNavItem(item, pathname))?.id ?? null;
}
