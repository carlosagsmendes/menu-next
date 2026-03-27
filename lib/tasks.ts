import "server-only";
import { cache } from "react";
import { connection } from "next/server";

export type Task = {
  id: string;
  title: string;
  status: "pending" | "done";
};

const MOCK_TASKS: Task[] = [
  { id: "1", title: "Review community guidelines", status: "pending" },
  { id: "2", title: "Update site navigation links", status: "pending" },
  { id: "3", title: "Write blog post about Next.js 16", status: "pending" },
  { id: "4", title: "Fix dark mode contrast issues", status: "done" },
  { id: "5", title: "Add analytics tracking", status: "pending" },
];

export const getPendingTaskCount = cache(async (): Promise<number> => {
  await connection();
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  return MOCK_TASKS.filter((t) => t.status === "pending").length;
});

export const getTasks = cache(async (): Promise<Task[]> => {
  await connection();
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  return MOCK_TASKS;
});
