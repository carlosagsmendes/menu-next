import { connection } from "next/server";

/**
 * Artificial server render delay so each route behaves like slow RSC work.
 * Adjust `SIMULATED_PAGE_LOAD_MS` if you meant a different duration than 150ms.
 */
export const SIMULATED_PAGE_LOAD_MS = 150;

export async function simulatePageLoad(): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  await connection();
  await new Promise<void>((resolve) => {
    setTimeout(resolve, SIMULATED_PAGE_LOAD_MS);
  });
}
