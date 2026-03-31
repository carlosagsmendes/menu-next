import {
  IntervalHistogram,
  monitorEventLoopDelay,
} from "node:perf_hooks";
import { appendPerfJsonLine } from "@/lib/perf/file-utils";
import {
  getPerfScenario,
  isPerfBenchmarkEnabled,
} from "@/lib/perf/benchmark-env";

type EventLoopMonitorState = {
  histogram: IntervalHistogram;
  interval: NodeJS.Timeout;
};

const globalState = globalThis as typeof globalThis & {
  __menuPerfEventLoopMonitor?: EventLoopMonitorState;
};

function nanosecondsToMilliseconds(value: number) {
  return Number.isFinite(value) ? value / 1_000_000 : null;
}

function readHistogramSnapshot(histogram: IntervalHistogram) {
  return {
    minMs: nanosecondsToMilliseconds(histogram.min),
    maxMs: nanosecondsToMilliseconds(histogram.max),
    meanMs: nanosecondsToMilliseconds(histogram.mean),
    stddevMs: nanosecondsToMilliseconds(histogram.stddev),
    p50Ms: nanosecondsToMilliseconds(histogram.percentile(50)),
    p95Ms: nanosecondsToMilliseconds(histogram.percentile(95)),
    p99Ms: nanosecondsToMilliseconds(histogram.percentile(99)),
  };
}

async function appendHistogramSnapshot(
  histogram: IntervalHistogram,
  reason: "interval" | "shutdown",
) {
  const snapshot = readHistogramSnapshot(histogram);
  histogram.reset();

  await appendPerfJsonLine("event-loop.ndjson", {
    timestamp: new Date().toISOString(),
    scenario: getPerfScenario(),
    reason,
    ...snapshot,
  });
}

export function startEventLoopMonitor(sampleIntervalMs = 5_000) {
  if (
    !isPerfBenchmarkEnabled() ||
    globalState.__menuPerfEventLoopMonitor
  ) {
    return;
  }

  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();

  const interval = setInterval(() => {
    void appendHistogramSnapshot(histogram, "interval");
  }, sampleIntervalMs);
  interval.unref();

  globalState.__menuPerfEventLoopMonitor = { histogram, interval };

  const shutdown = () => {
    const state = globalState.__menuPerfEventLoopMonitor;
    if (!state) {
      return;
    }

    clearInterval(state.interval);
    state.histogram.disable();
    globalState.__menuPerfEventLoopMonitor = undefined;
    void appendHistogramSnapshot(state.histogram, "shutdown");
  };

  process.once("beforeExit", shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
