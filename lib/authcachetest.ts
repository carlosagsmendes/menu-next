import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { lookupAuthenticatedUser, type AuthenticatedUser } from "@/data/auth";

console.log("authcachetest");

export const getCurrentUser = cache(
  async (): Promise<AuthenticatedUser | null> => {
    console.log("authcachetestexec");
    const token = (await cookies()).get("session")?.value;
    if (!token) {
      return null;
    }

    const { user } = await lookupAuthenticatedUser("render");
    return user;
  },
);
