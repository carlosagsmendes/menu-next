"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useState } from "react";

import {
  getActiveSideNavItemId,
  type MenuItemId,
  type SideNavItem,
} from "@/lib/menu";
import { subscribeToMenuSelectionOverride } from "@/lib/menu-selection";

const baseLinkClassName =
  "inline-flex shrink-0 items-center rounded-full px-3 py-2 text-sm font-medium transition-colors md:w-full md:rounded-xl";

function linkClassName(active: boolean) {
  if (active) {
    return `${baseLinkClassName} bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200`;
  }

  return `${baseLinkClassName} text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`;
}

export function SideNavClient({
  items,
}: {
  items: readonly SideNavItem[];
}) {
  const pathname = usePathname();
  const [overrideId, setOverrideId] = useState<{
    id: MenuItemId;
    pathname: string;
  } | null>(null);
  const visibleItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);
  const handleMenuSelectionOverride = useEffectEvent((nextId: MenuItemId) => {
    if (!visibleItemIds.has(nextId)) {
      return;
    }

    setOverrideId({
      id: nextId,
      pathname,
    });
  });

  useEffect(() => {
    return subscribeToMenuSelectionOverride(handleMenuSelectionOverride);
  }, []);

  const activeOverrideId =
    overrideId !== null &&
    overrideId.pathname === pathname &&
    visibleItemIds.has(overrideId.id)
      ? overrideId.id
      : null;
  const activeItemId = activeOverrideId ?? getActiveSideNavItemId(items, pathname);

  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
      {items.map((item) => {
        const active = item.id === activeItemId;

        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? "page" : undefined}
            data-selected={active ? "true" : "false"}
            className={linkClassName(active)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
