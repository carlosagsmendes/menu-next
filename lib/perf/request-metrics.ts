import { performance } from "node:perf_hooks";
import { after } from "next/server";
import {
  appendPerfJsonLine,
} from "@/lib/perf/file-utils";
import {
  getPerfScenario,
  isPerfBenchmarkEnabled,
} from "@/lib/perf/benchmark-env";

type BenchmarkRequestPhase = "page" | "api";
type BenchmarkRequestOutcome = "ok" | "not-found" | "error" | "unknown";

type SerializableMemoryUsage = {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
};

type MutableBenchmarkContext = {
  routeLabel: string;
  routePath?: string;
  entityId?: string;
  phase: BenchmarkRequestPhase;
  outcome?: BenchmarkRequestOutcome;
  status?: number;
  extra?: Record<string, unknown>;
};

export type BenchmarkRequestTracker = {
  update: (next: Partial<MutableBenchmarkContext>) => void;
  markOutcome: (outcome: BenchmarkRequestOutcome) => void;
};

const noopTracker: BenchmarkRequestTracker = {
  update() {},
  markOutcome() {},
};

function toSerializableMemoryUsage(
  usage: NodeJS.MemoryUsage,
): SerializableMemoryUsage {
  return {
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers,
  };
}

function diffMemoryUsage(
  before: SerializableMemoryUsage,
  after: SerializableMemoryUsage,
) {
  return {
    rss: after.rss - before.rss,
    heapTotal: after.heapTotal - before.heapTotal,
    heapUsed: after.heapUsed - before.heapUsed,
    external: after.external - before.external,
    arrayBuffers: after.arrayBuffers - before.arrayBuffers,
  };
}

export function startBenchmarkRequest(
  context: MutableBenchmarkContext,
): BenchmarkRequestTracker {
  if (!isPerfBenchmarkEnabled()) {
    return noopTracker;
  }

  const startedAt = new Date().toISOString();
  const highResolutionStart = process.hrtime.bigint();
  const performanceStart = performance.now();
  const cpuBefore = process.cpuUsage();
  const memoryBefore = toSerializableMemoryUsage(process.memoryUsage());
  const mutableContext: MutableBenchmarkContext = { ...context };

  after(async () => {
    const highResolutionEnd = process.hrtime.bigint();
    const memoryAfter = toSerializableMemoryUsage(process.memoryUsage());
    const cpuDelta = process.cpuUsage(cpuBefore);

    await appendPerfJsonLine("requests.ndjson", {
      timestamp: startedAt,
      completedAt: new Date().toISOString(),
      scenario: getPerfScenario(),
      routeLabel: mutableContext.routeLabel,
      routePath: mutableContext.routePath ?? mutableContext.routeLabel,
      entityId: mutableContext.entityId ?? null,
      phase: mutableContext.phase,
      outcome: mutableContext.outcome ?? "ok",
      status: mutableContext.status ?? null,
      durationMs: Number(highResolutionEnd - highResolutionStart) / 1_000_000,
      performanceDurationMs: performance.now() - performanceStart,
      memoryBefore,
      memoryAfter,
      memoryDelta: diffMemoryUsage(memoryBefore, memoryAfter),
      cpuUserMicros: cpuDelta.user,
      cpuSystemMicros: cpuDelta.system,
      ...(mutableContext.extra ?? {}),
    });
  });

  return {
    update(next) {
      Object.assign(mutableContext, next);
    },
    markOutcome(outcome) {
      mutableContext.outcome = outcome;
    },
  };
}
