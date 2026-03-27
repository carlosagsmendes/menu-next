import "server-only";
import { cache } from "react";
import { forbidden } from "next/navigation";
import { connection } from "next/server";

export type Permission = "community:admin" | "site:admin";

export type Session = {
  userId: string;
  permissions: Permission[];
} | null;

export const getSession = cache(async (): Promise<Session> => {
  await connection();
  return {
    userId: "user_1",
    permissions: ["community:admin", "site:admin"],
  };
});

export async function hasPermission(p: Permission): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  return session.permissions.includes(p);
}

export async function verifyPermission(p: Permission): Promise<void> {
  const allowed = await hasPermission(p);
  if (!allowed) forbidden();
}
