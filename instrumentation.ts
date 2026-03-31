import type { Instrumentation } from "next";
import {
  isPerfBenchmarkEnabled,
} from "./lib/perf/benchmark-env";

export async function register() {
  if (
    !isPerfBenchmarkEnabled() ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }

  const { registerPerfInstrumentation } = await import("./instrumentation.node");
  await registerPerfInstrumentation();
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (
    !isPerfBenchmarkEnabled() ||
    process.env.NEXT_RUNTIME !== "nodejs"
  ) {
    return;
  }

  const errorWithMetadata = error as Error & { digest?: string };
  const { appendPerfJsonLine } = await import("./lib/perf/file-utils");
  await appendPerfJsonLine("errors.ndjson", {
    timestamp: new Date().toISOString(),
    message: errorWithMetadata.message,
    digest: errorWithMetadata.digest ?? null,
    name: errorWithMetadata.name,
    stack: errorWithMetadata.stack ?? null,
    request,
    context,
  });
};
