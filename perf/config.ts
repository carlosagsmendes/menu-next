export const PERF_RESULTS_DIR = "results";
export const PERF_BUILD_META_PATH = ".next/perf-build-meta.json";
export const PERF_LATEST_RUN_PATH = `${PERF_RESULTS_DIR}/latest-run.txt`;

export const BENCHMARK_DEFAULTS = {
  port: 3210,
  detailIds: ["1", "2", "3", "4"] as const,
  clientIterations: 10,
  clientWarmupIterations: 1,
  clientSettleDelayMs: 1_500,
  loadDuration: "30s",
  loadVus: 20,
  loadRampUpDuration: "5s",
  loadRampDownDuration: "5s",
  warmupDuration: "5s",
  warmupVus: 4,
  serverReadyTimeoutMs: 30_000,
  browserViewport: {
    width: 1_280,
    height: 720,
  },
  memoryCycles: 10,
  memoryWarmupCycles: 1,
  memorySettleDelayMs: 500,
  memoryPostGcDelayMs: 250,
  memoryGrowthThresholdPercent: 20,
} as const;

export type BenchmarkVariant = "streaming" | "blocking";
export type BenchmarkKind = "list" | "detail";
export type ClientFlow = "hard-load" | "client-navigation";
export type RouteMode = "static" | "partial-prerender" | "dynamic" | "unknown";

export type RouteTarget = {
  id: string;
  label: string;
  kind: BenchmarkKind;
  variant: BenchmarkVariant;
  routeMode: RouteMode;
  serverRouteLabel: string;
  routePath: (detailId?: string) => string;
  readySelector: (detailId?: string) => string;
  homeClickSelector?: string;
  listClickSelector?: (detailId: string) => string;
  sourcePathForDetailNav?: string;
  sourceReadySelectorForDetailNav?: string;
};

export const LIST_TARGETS = {
  streaming: {
    id: "list-streaming",
    label: "/blog",
    kind: "list",
    variant: "streaming",
    routeMode: "partial-prerender",
    serverRouteLabel: "/blog",
    routePath: () => "/blog",
    readySelector: () => '[data-perf-page="blog-list"]',
    homeClickSelector: 'a[href="/blog"]',
  },
  blocking: {
    id: "list-blocking",
    label: "/blog-no-streaming",
    kind: "list",
    variant: "blocking",
    routeMode: "dynamic",
    serverRouteLabel: "/blog-no-streaming",
    routePath: () => "/blog-no-streaming",
    readySelector: () => '[data-perf-page="blog-list-no-streaming"]',
    homeClickSelector: 'a[href="/blog-no-streaming"]',
  },
} satisfies Record<BenchmarkVariant, RouteTarget>;

export const DETAIL_TARGETS = {
  streaming: {
    id: "detail-streaming",
    label: "/blog/[id]",
    kind: "detail",
    variant: "streaming",
    routeMode: "partial-prerender",
    serverRouteLabel: "/blog/[id]",
    routePath: (detailId = BENCHMARK_DEFAULTS.detailIds[0]) => `/blog/${detailId}`,
    readySelector: (detailId = BENCHMARK_DEFAULTS.detailIds[0]) =>
      `[data-perf-page="blog-detail"][data-perf-post-id="${detailId}"]`,
    listClickSelector: (detailId: string) => `a[href="/blog/${detailId}"]`,
    sourcePathForDetailNav: "/blog",
    sourceReadySelectorForDetailNav: '[data-perf-page="blog-list"]',
  },
  blocking: {
    id: "detail-blocking",
    label: "/blog-no-streaming/[id]",
    kind: "detail",
    variant: "blocking",
    routeMode: "partial-prerender",
    serverRouteLabel: "/blog-no-streaming/[id]",
    routePath: (detailId = BENCHMARK_DEFAULTS.detailIds[0]) =>
      `/blog-no-streaming/${detailId}`,
    readySelector: (detailId = BENCHMARK_DEFAULTS.detailIds[0]) =>
      `[data-perf-page="blog-detail-no-streaming"][data-perf-post-id="${detailId}"]`,
    listClickSelector: (detailId: string) =>
      `a[href="/blog-no-streaming/${detailId}"]`,
    sourcePathForDetailNav: "/blog-no-streaming",
    sourceReadySelectorForDetailNav:
      '[data-perf-page="blog-list-no-streaming"]',
  },
} satisfies Record<BenchmarkVariant, RouteTarget>;

export const DEFAULT_ROUTE_MODES: Record<string, RouteMode> = {
  "/blog": "partial-prerender",
  "/blog-no-streaming": "dynamic",
  "/blog/[id]": "partial-prerender",
  "/blog-no-streaming/[id]": "partial-prerender",
};

export type LoadScenarioDefinition = {
  id: string;
  label: string;
  kind: BenchmarkKind;
  variant: BenchmarkVariant;
  target: RouteTarget;
  routes: string[];
  detailIds: string[];
};

export function getLoadScenarios(): LoadScenarioDefinition[] {
  const detailIds = [...BENCHMARK_DEFAULTS.detailIds];

  return [
    {
      id: "load-list-streaming",
      label: "List page load: /blog",
      kind: "list",
      variant: "streaming",
      target: LIST_TARGETS.streaming,
      routes: [LIST_TARGETS.streaming.routePath()],
      detailIds: [],
    },
    {
      id: "load-list-blocking",
      label: "List page load: /blog-no-streaming",
      kind: "list",
      variant: "blocking",
      target: LIST_TARGETS.blocking,
      routes: [LIST_TARGETS.blocking.routePath()],
      detailIds: [],
    },
    {
      id: "load-detail-streaming",
      label: "Detail page load: /blog/[id]",
      kind: "detail",
      variant: "streaming",
      target: DETAIL_TARGETS.streaming,
      routes: detailIds.map((detailId) => DETAIL_TARGETS.streaming.routePath(detailId)),
      detailIds,
    },
    {
      id: "load-detail-blocking",
      label: "Detail page load: /blog-no-streaming/[id]",
      kind: "detail",
      variant: "blocking",
      target: DETAIL_TARGETS.blocking,
      routes: detailIds.map((detailId) => DETAIL_TARGETS.blocking.routePath(detailId)),
      detailIds,
    },
  ];
}

export type ClientScenarioDefinition = {
  id: string;
  label: string;
  kind: BenchmarkKind;
  variant: BenchmarkVariant;
  flow: ClientFlow;
  target: RouteTarget;
  detailId: string | null;
  sourcePath: string | null;
  sourceReadySelector: string | null;
  destinationPath: string;
  destinationReadySelector: string;
  clickSelector: string | null;
};

export function getClientScenarios(): ClientScenarioDefinition[] {
  const detailIds = [...BENCHMARK_DEFAULTS.detailIds];
  const listScenarios: ClientScenarioDefinition[] = [
    {
      id: "client-list-streaming-hard-load",
      label: "Hard load /blog",
      kind: "list",
      variant: "streaming",
      flow: "hard-load",
      target: LIST_TARGETS.streaming,
      detailId: null,
      sourcePath: null,
      sourceReadySelector: null,
      destinationPath: LIST_TARGETS.streaming.routePath(),
      destinationReadySelector: LIST_TARGETS.streaming.readySelector(),
      clickSelector: null,
    },
    {
      id: "client-list-blocking-hard-load",
      label: "Hard load /blog-no-streaming",
      kind: "list",
      variant: "blocking",
      flow: "hard-load",
      target: LIST_TARGETS.blocking,
      detailId: null,
      sourcePath: null,
      sourceReadySelector: null,
      destinationPath: LIST_TARGETS.blocking.routePath(),
      destinationReadySelector: LIST_TARGETS.blocking.readySelector(),
      clickSelector: null,
    },
    {
      id: "client-list-streaming-nav",
      label: "Navigate / -> /blog",
      kind: "list",
      variant: "streaming",
      flow: "client-navigation",
      target: LIST_TARGETS.streaming,
      detailId: null,
      sourcePath: "/",
      sourceReadySelector: '[data-perf-page="home"]',
      destinationPath: LIST_TARGETS.streaming.routePath(),
      destinationReadySelector: LIST_TARGETS.streaming.readySelector(),
      clickSelector: LIST_TARGETS.streaming.homeClickSelector ?? null,
    },
    {
      id: "client-list-blocking-nav",
      label: "Navigate / -> /blog-no-streaming",
      kind: "list",
      variant: "blocking",
      flow: "client-navigation",
      target: LIST_TARGETS.blocking,
      detailId: null,
      sourcePath: "/",
      sourceReadySelector: '[data-perf-page="home"]',
      destinationPath: LIST_TARGETS.blocking.routePath(),
      destinationReadySelector: LIST_TARGETS.blocking.readySelector(),
      clickSelector: LIST_TARGETS.blocking.homeClickSelector ?? null,
    },
  ];

  const detailScenarios: ClientScenarioDefinition[] = detailIds.flatMap((detailId) => [
    {
      id: `client-detail-streaming-id-${detailId}-hard-load`,
      label: `Hard load /blog/${detailId}`,
      kind: "detail",
      variant: "streaming",
      flow: "hard-load",
      target: DETAIL_TARGETS.streaming,
      detailId,
      sourcePath: null,
      sourceReadySelector: null,
      destinationPath: DETAIL_TARGETS.streaming.routePath(detailId),
      destinationReadySelector: DETAIL_TARGETS.streaming.readySelector(detailId),
      clickSelector: null,
    },
    {
      id: `client-detail-blocking-id-${detailId}-hard-load`,
      label: `Hard load /blog-no-streaming/${detailId}`,
      kind: "detail",
      variant: "blocking",
      flow: "hard-load",
      target: DETAIL_TARGETS.blocking,
      detailId,
      sourcePath: null,
      sourceReadySelector: null,
      destinationPath: DETAIL_TARGETS.blocking.routePath(detailId),
      destinationReadySelector: DETAIL_TARGETS.blocking.readySelector(detailId),
      clickSelector: null,
    },
    {
      id: `client-detail-streaming-id-${detailId}-nav`,
      label: `Navigate /blog -> /blog/${detailId}`,
      kind: "detail",
      variant: "streaming",
      flow: "client-navigation",
      target: DETAIL_TARGETS.streaming,
      detailId,
      sourcePath: DETAIL_TARGETS.streaming.sourcePathForDetailNav ?? null,
      sourceReadySelector:
        DETAIL_TARGETS.streaming.sourceReadySelectorForDetailNav ?? null,
      destinationPath: DETAIL_TARGETS.streaming.routePath(detailId),
      destinationReadySelector: DETAIL_TARGETS.streaming.readySelector(detailId),
      clickSelector: DETAIL_TARGETS.streaming.listClickSelector?.(detailId) ?? null,
    },
    {
      id: `client-detail-blocking-id-${detailId}-nav`,
      label: `Navigate /blog-no-streaming -> /blog-no-streaming/${detailId}`,
      kind: "detail",
      variant: "blocking",
      flow: "client-navigation",
      target: DETAIL_TARGETS.blocking,
      detailId,
      sourcePath: DETAIL_TARGETS.blocking.sourcePathForDetailNav ?? null,
      sourceReadySelector:
        DETAIL_TARGETS.blocking.sourceReadySelectorForDetailNav ?? null,
      destinationPath: DETAIL_TARGETS.blocking.routePath(detailId),
      destinationReadySelector: DETAIL_TARGETS.blocking.readySelector(detailId),
      clickSelector: DETAIL_TARGETS.blocking.listClickSelector?.(detailId) ?? null,
    },
  ]);

  return [...listScenarios, ...detailScenarios];
}

export type MemoryCircuitStep = {
  path: string;
  readySelector: string;
  clickSelector: string;
};

export function getMemoryCircuits(): Record<BenchmarkVariant, MemoryCircuitStep[]> {
  return {
    streaming: [
      { path: "/blog", readySelector: '[data-perf-page="blog-list"]', clickSelector: 'a[href="/blog"]' },
      { path: "/blog/1", readySelector: '[data-perf-page="blog-detail"][data-perf-post-id="1"]', clickSelector: 'a[href="/blog/1"]' },
      { path: "/blog", readySelector: '[data-perf-page="blog-list"]', clickSelector: 'nav a[href="/blog"]' },
      { path: "/blog/2", readySelector: '[data-perf-page="blog-detail"][data-perf-post-id="2"]', clickSelector: 'a[href="/blog/2"]' },
      { path: "/blog", readySelector: '[data-perf-page="blog-list"]', clickSelector: 'nav a[href="/blog"]' },
      { path: "/", readySelector: '[data-perf-page="home"]', clickSelector: 'nav a[href="/"]' },
    ],
    blocking: [
      { path: "/blog-no-streaming", readySelector: '[data-perf-page="blog-list-no-streaming"]', clickSelector: 'a[href="/blog-no-streaming"]' },
      { path: "/blog-no-streaming/1", readySelector: '[data-perf-page="blog-detail-no-streaming"][data-perf-post-id="1"]', clickSelector: 'a[href="/blog-no-streaming/1"]' },
      { path: "/blog-no-streaming", readySelector: '[data-perf-page="blog-list-no-streaming"]', clickSelector: 'nav a[href="/blog-no-streaming"]' },
      { path: "/blog-no-streaming/2", readySelector: '[data-perf-page="blog-detail-no-streaming"][data-perf-post-id="2"]', clickSelector: 'a[href="/blog-no-streaming/2"]' },
      { path: "/blog-no-streaming", readySelector: '[data-perf-page="blog-list-no-streaming"]', clickSelector: 'nav a[href="/blog-no-streaming"]' },
      { path: "/", readySelector: '[data-perf-page="home"]', clickSelector: 'nav a[href="/"]' },
    ],
  };
}
