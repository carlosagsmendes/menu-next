"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import type { AuthenticatedUser } from "@/data/auth";

const UserContext = createContext<AuthenticatedUser | null>(null);

export function UserProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: AuthenticatedUser | null;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useCurrentUser() {
  return useContext(UserContext);
}
