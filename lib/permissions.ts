import "server-only";
import { cache } from "react";

/**
 * Server-side permission checks wrapped with React.cache() for per-request
 * deduplication. If checked in both the sidebar and an admin page during the
 * same render, the underlying work only runs once.
 * Replace stubs with real auth logic as needed.
 */
export const getCommunityAdminAllowed = cache(
  async (): Promise<boolean> => {
    return true;
  },
);

export const getSiteAdminAllowed = cache(
  async (): Promise<boolean> => {
    return true;
  },
);
