"use server";

import type { SearchResult } from "@/data/dto";
export type { SearchResult } from "@/data/dto";

const SEARCHABLE_ITEMS: SearchResult[] = [
  {
    id: "page-home",
    title: "Home",
    description: "Welcome page with getting-started links",
    href: "/",
  },
  {
    id: "page-blog",
    title: "Blog",
    description: "Blog posts and articles",
    href: "/blog",
  },
  {
    id: "page-community-admin",
    title: "Community Admin",
    description: "Manage community settings and members",
    href: "/admin/community",
  },
  {
    id: "page-site-admin",
    title: "Site Admin",
    description: "Site-wide configuration and permissions",
    href: "/admin/site",
  },
  {
    id: "task-1",
    title: "Review community guidelines",
    description: "Pending task — review and update guidelines",
    href: "/admin/community",
  },
  {
    id: "task-2",
    title: "Update site navigation links",
    description: "Pending task — fix broken nav links",
    href: "/admin/site",
  },
  {
    id: "task-3",
    title: "Write blog post about Next.js 16",
    description: "Pending task — draft a new blog entry",
    href: "/blog",
  },
  {
    id: "task-5",
    title: "Add analytics tracking",
    description: "Pending task — integrate analytics",
    href: "/admin/site",
  },
  {
    id: "post-nextjs",
    title: "Getting Started with Next.js",
    description: "A beginner's guide to building with Next.js",
    href: "/blog",
  },
  {
    id: "post-rsc",
    title: "React Server Components Explained",
    description: "Deep dive into RSC architecture and streaming",
    href: "/blog",
  },
];

export async function searchContent(query: string): Promise<SearchResult[]> {
  await new Promise<void>((resolve) => setTimeout(resolve, 80));

  const q = query.toLowerCase().trim();
  if (!q) return [];

  return SEARCHABLE_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q),
  );
}
