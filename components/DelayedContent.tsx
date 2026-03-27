import type { ReactNode } from "react";
import { simulatePageLoad } from "@/lib/simulate-page-load";

type Props = { children: ReactNode };

/** Runs simulated server delay, then renders children (for Suspense streaming). */
export async function DelayedContent({ children }: Props) {
  await simulatePageLoad();
  return children;
}
