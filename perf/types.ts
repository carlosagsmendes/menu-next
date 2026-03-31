import type {
  BenchmarkKind,
  BenchmarkVariant,
  ClientFlow,
} from "./config";

export type ServerRequestMetricRecord = {
  timestamp: string;
  completedAt: string;
  scenario: string | null;
  routeLabel: string;
  routePath: string;
  entityId: string | null;
  phase: "page" | "api";
  outcome: "ok" | "not-found" | "error" | "unknown";
  status: number | null;
  durationMs: number;
  performanceDurationMs: number;
  memoryBefore: Record<string, number>;
  memoryAfter: Record<string, number>;
  memoryDelta: Record<string, number>;
  cpuUserMicros: number;
  cpuSystemMicros: number;
  method?: string;
  sort?: string;
};

export type EventLoopSnapshot = {
  timestamp: string;
  scenario: string | null;
  reason: "interval" | "shutdown";
  minMs: number | null;
  maxMs: number | null;
  meanMs: number | null;
  stddevMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  p99Ms: number | null;
};

export type ClientIterationMetrics = {
  navigationType: string | null;
  routerMode: "client-router" | "document" | "unknown";
  clickToUrlMs: number | null;
  clickToReadyMs: number | null;
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadMs: number | null;
  fcpMs: number | null;
  lcpMs: number | null;
  cls: number | null;
  inpMs: number | null;
  longTaskCount: number;
  longTaskDurationMs: number;
  resourceCount: number;
  totalTransferSizeBytes: number;
  jsTransferSizeBytes: number;
  jsHeapUsedSizeBytes: number | null;
  jsHeapTotalSizeBytes: number | null;
  uaSpecificMemoryBytes: number | null;
};

export type ClientIterationResult = {
  iteration: number;
  warmup: boolean;
  scenarioId: string;
  kind: BenchmarkKind;
  variant: BenchmarkVariant;
  flow: ClientFlow;
  detailId: string | null;
  sourcePath: string | null;
  destinationPath: string;
  destinationReadySelector: string;
  capturedAt: string;
  metrics: ClientIterationMetrics;
  raw: {
    collectorMetrics: Array<{
      id: string;
      name: string;
      value: number;
      delta: number;
      rating?: string;
      navigationType?: string;
      pathname: string;
      href: string;
      timestamp: number;
    }>;
    longTasks: Array<{
      duration: number;
      name: string;
      pathname: string;
      href: string;
      startTime: number;
      timestamp: number;
    }>;
    routerTransitions: Array<{
      url: string;
      navigationType: "push" | "replace" | "traverse";
      pathname: string;
      href: string;
      timestamp: number;
    }>;
    paints: Array<{
      name: string;
      pathname: string;
      href: string;
      startTime: number;
      timestamp: number;
    }>;
    cdpMetrics: Record<string, number>;
  };
};

export type ClientScenarioResult = {
  scenarioId: string;
  label: string;
  kind: BenchmarkKind;
  variant: BenchmarkVariant;
  flow: ClientFlow;
  detailId: string | null;
  sourcePath: string | null;
  destinationPath: string;
  destinationReadySelector: string;
  iterations: number;
  warmupIterations: number;
  browserVersion: string;
  measurements: ClientIterationResult[];
};

export type MemoryNavigationStep = {
  stepIndex: number;
  cycle: number;
  stepInCycle: number;
  path: string;
  readySelector: string;
  capturedAt: string;
  client: {
    jsHeapUsedSizeBytes: number;
    jsHeapTotalSizeBytes: number;
  };
  server: {
    heapUsedBytes: number;
    heapTotalBytes: number;
  };
};

export type MemoryTrendAnalysis = {
  baseline: number;
  final: number;
  growthBytes: number;
  growthPercent: number;
  monotonicallyIncreasingPercent: number;
  regressionSlope: number;
  regressionRSquared: number;
  verdict: "pass" | "warn" | "fail";
};

export type MemoryLeakResult = {
  variant: BenchmarkVariant;
  cycles: number;
  totalSteps: number;
  warmupCycles: number;
  growthThresholdPercent: number;
  navigationCircuit: string[];
  browserVersion: string;
  steps: MemoryNavigationStep[];
  analysis: {
    client: MemoryTrendAnalysis;
    server: MemoryTrendAnalysis;
  };
  startedAt: string;
  completedAt: string;
};
