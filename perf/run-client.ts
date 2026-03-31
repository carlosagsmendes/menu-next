import path from "node:path";
import { chromium, type Browser, type CDPSession, type Page } from "playwright";
import { BENCHMARK_DEFAULTS, getClientScenarios, type ClientScenarioDefinition } from "./config";
import type {
  ClientIterationMetrics,
  ClientIterationResult,
  ClientScenarioResult,
} from "./types";
import {
  clearDirectory,
  createRunDirectory,
  ensureDirectory,
  getArgumentValue,
  initializeRunMetadata,
  readBuildMetadata,
  sleep,
  startNextServer,
  updateRunMetadata,
  writeJson,
} from "./utils";

type PageCapture = {
  collectorMetrics: ClientIterationResult["raw"]["collectorMetrics"];
  longTasks: ClientIterationResult["raw"]["longTasks"];
  routerTransitions: ClientIterationResult["raw"]["routerTransitions"];
  paints: ClientIterationResult["raw"]["paints"];
  navigationEntry: {
    name: string;
    type: string;
    responseStart: number;
    domContentLoadedEventEnd: number;
    loadEventEnd: number;
  } | null;
  resources: {
    count: number;
    totalTransferSizeBytes: number;
    jsTransferSizeBytes: number;
  };
  cdpMetrics: Record<string, number>;
  uaSpecificMemoryBytes: number | null;
  routerMode: "client-router" | "document" | "unknown";
};

function withPerfQuery(pathname: string) {
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}__perf=1`;
}

function getLatestMetricValue(
  metrics: ClientIterationResult["raw"]["collectorMetrics"],
  name: string,
) {
  const latest = [...metrics].reverse().find((metric) => metric.name === name);
  return latest?.value ?? null;
}

async function ensureBuildArtifactsExist() {
  const buildMetadata = await readBuildMetadata();
  if (!buildMetadata) {
    throw new Error(
      "Missing .next/perf-build-meta.json. Run `npm run perf:build` first.",
    );
  }
}

async function collectCdpMetrics(session: CDPSession) {
  const response = await session.send("Performance.getMetrics");
  return Object.fromEntries(
    response.metrics.map((metric) => [metric.name, metric.value]),
  );
}

async function collectPageCapture(
  page: Page,
  session: CDPSession,
  destinationPath: string,
  baselinePerformanceTime: number | null,
): Promise<PageCapture> {
  const cdpMetrics = await collectCdpMetrics(session);

  const pageMetrics = await page.evaluate(
    async ({ destinationPath, baselinePerformanceTime }) => {
      const navigationEntry = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      const navigationPath =
        navigationEntry?.name != null
          ? new URL(navigationEntry.name, window.location.href).pathname
          : null;
      const treatAsDocumentNavigation =
        navigationPath === destinationPath || baselinePerformanceTime == null;

      const resources = (
        performance.getEntriesByType("resource") as PerformanceResourceTiming[]
      ).filter((entry) =>
        treatAsDocumentNavigation
          ? true
          : entry.startTime >= baselinePerformanceTime,
      );

      const totalTransferSizeBytes = resources.reduce(
        (sum, entry) => sum + (entry.transferSize ?? 0),
        0,
      );
      const jsTransferSizeBytes = resources.reduce((sum, entry) => {
        const isJavaScriptResource =
          entry.initiatorType === "script" ||
          entry.name.endsWith(".js") ||
          entry.name.includes("/_next/");

        return sum + (isJavaScriptResource ? entry.transferSize ?? 0 : 0);
      }, 0);

      const store = window.__MENU_PERF_BENCHMARK__;
      const collectorMetrics =
        store?.metrics.filter((metric) => metric.pathname === destinationPath) ?? [];
      const routerTransitions = store?.routerTransitions ?? [];
      const longTasks =
        store?.longTasks.filter((task) =>
          treatAsDocumentNavigation
            ? true
            : task.startTime >= (baselinePerformanceTime ?? 0),
        ) ?? [];
      const paints =
        store?.paints.filter((paint) =>
          treatAsDocumentNavigation
            ? paint.pathname === destinationPath
            : paint.startTime >= (baselinePerformanceTime ?? 0),
        ) ?? [];

      let uaSpecificMemoryBytes: number | null = null;
      const extendedPerformance = performance as Performance & {
        measureUserAgentSpecificMemory?: () => Promise<{ bytes: number }>;
      };

      if (typeof extendedPerformance.measureUserAgentSpecificMemory === "function") {
        try {
          const result = await extendedPerformance.measureUserAgentSpecificMemory();
          uaSpecificMemoryBytes = result.bytes;
        } catch {
          uaSpecificMemoryBytes = null;
        }
      }

      let routerMode: "client-router" | "document" | "unknown" = "unknown";
      if (
        routerTransitions.some((transition) =>
          new URL(transition.url, window.location.origin).pathname ===
          destinationPath,
        )
      ) {
        routerMode = "client-router";
      } else if (navigationPath === destinationPath) {
        routerMode = "document";
      }

      return {
        collectorMetrics,
        longTasks,
        routerTransitions,
        paints,
        navigationEntry:
          navigationEntry && navigationPath === destinationPath
            ? {
                name: navigationEntry.name,
                type: navigationEntry.type,
                responseStart: navigationEntry.responseStart,
                domContentLoadedEventEnd:
                  navigationEntry.domContentLoadedEventEnd,
                loadEventEnd: navigationEntry.loadEventEnd,
              }
            : null,
        resources: {
          count: resources.length,
          totalTransferSizeBytes,
          jsTransferSizeBytes,
        },
        uaSpecificMemoryBytes,
        routerMode,
      };
    },
    { destinationPath, baselinePerformanceTime },
  );

  return {
    ...pageMetrics,
    cdpMetrics,
  };
}

function buildIterationMetrics(
  capture: PageCapture,
  flow: ClientScenarioDefinition["flow"],
  clickToUrlMs: number | null,
  clickToReadyMs: number | null,
): ClientIterationMetrics {
  const firstContentfulPaint =
    getLatestMetricValue(capture.collectorMetrics, "FCP") ??
    capture.paints.find((paint) => paint.name === "first-contentful-paint")
      ?.startTime ??
    null;

  return {
    navigationType: capture.navigationEntry?.type ?? null,
    routerMode: capture.routerMode,
    clickToUrlMs: flow === "client-navigation" ? clickToUrlMs : null,
    clickToReadyMs: flow === "client-navigation" ? clickToReadyMs : null,
    ttfbMs:
      capture.navigationEntry?.responseStart ??
      getLatestMetricValue(capture.collectorMetrics, "TTFB"),
    domContentLoadedMs:
      capture.navigationEntry?.domContentLoadedEventEnd ?? null,
    loadMs: capture.navigationEntry?.loadEventEnd ?? null,
    fcpMs: firstContentfulPaint,
    lcpMs: getLatestMetricValue(capture.collectorMetrics, "LCP"),
    cls: getLatestMetricValue(capture.collectorMetrics, "CLS"),
    inpMs: getLatestMetricValue(capture.collectorMetrics, "INP"),
    longTaskCount: capture.longTasks.length,
    longTaskDurationMs: capture.longTasks.reduce(
      (sum, task) => sum + task.duration,
      0,
    ),
    resourceCount: capture.resources.count,
    totalTransferSizeBytes: capture.resources.totalTransferSizeBytes,
    jsTransferSizeBytes: capture.resources.jsTransferSizeBytes,
    jsHeapUsedSizeBytes: capture.cdpMetrics.JSHeapUsedSize ?? null,
    jsHeapTotalSizeBytes: capture.cdpMetrics.JSHeapTotalSize ?? null,
    uaSpecificMemoryBytes: capture.uaSpecificMemoryBytes,
  };
}

async function runIteration(
  browser: Browser,
  baseUrl: string,
  scenario: ClientScenarioDefinition,
  iteration: number,
  warmup: boolean,
) {
  const context = await browser.newContext({
    viewport: BENCHMARK_DEFAULTS.browserViewport,
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send("Performance.enable");

  let baselinePerformanceTime: number | null = null;
  let clickToUrlMs: number | null = null;
  let clickToReadyMs: number | null = null;

  try {
    if (scenario.flow === "hard-load") {
      await page.goto(`${baseUrl}${withPerfQuery(scenario.destinationPath)}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(scenario.destinationReadySelector);
    } else {
      if (!scenario.clickSelector) {
        throw new Error(`Missing click selector for ${scenario.id}`);
      }

      await page.goto(`${baseUrl}${withPerfQuery(scenario.sourcePath ?? "/")}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForSelector(scenario.sourceReadySelector ?? "body");
      baselinePerformanceTime = await page.evaluate(() => performance.now());

      const clickStartedAt = Date.now();
      await Promise.all([
        page.waitForURL((url) => url.pathname === scenario.destinationPath),
        page.click(scenario.clickSelector),
      ]);
      clickToUrlMs = Date.now() - clickStartedAt;
      await page.waitForSelector(scenario.destinationReadySelector);
      clickToReadyMs = Date.now() - clickStartedAt;
    }

    await page.waitForTimeout(BENCHMARK_DEFAULTS.clientSettleDelayMs);
    const capture = await collectPageCapture(
      page,
      session,
      scenario.destinationPath,
      baselinePerformanceTime,
    );

    return {
      iteration,
      warmup,
      scenarioId: scenario.id,
      kind: scenario.kind,
      variant: scenario.variant,
      flow: scenario.flow,
      detailId: scenario.detailId,
      sourcePath: scenario.sourcePath,
      destinationPath: scenario.destinationPath,
      destinationReadySelector: scenario.destinationReadySelector,
      capturedAt: new Date().toISOString(),
      metrics: buildIterationMetrics(
        capture,
        scenario.flow,
        clickToUrlMs,
        clickToReadyMs,
      ),
      raw: {
        collectorMetrics: capture.collectorMetrics,
        longTasks: capture.longTasks,
        routerTransitions: capture.routerTransitions,
        paints: capture.paints,
        cdpMetrics: capture.cdpMetrics,
      },
    } satisfies ClientIterationResult;
  } finally {
    await context.close();
  }
}

async function runScenario(
  browser: Browser,
  runDir: string,
  scenario: ClientScenarioDefinition,
  port: number,
  iterations: number,
  warmupIterations: number,
) {
  const serverOutputDir = path.join(runDir, "server", "client", scenario.id);
  const clientOutputDir = path.join(runDir, "client");
  await clearDirectory(serverOutputDir);
  await ensureDirectory(clientOutputDir);

  const server = await startNextServer({
    port,
    env: {
      NODE_ENV: "production",
      PERF_BENCHMARK: "1",
      PERF_OUTPUT_DIR: serverOutputDir,
      PERF_SCENARIO: scenario.id,
    },
  });

  try {
    for (let warmupIteration = 1; warmupIteration <= warmupIterations; warmupIteration += 1) {
      await runIteration(
        browser,
        server.baseUrl,
        scenario,
        warmupIteration,
        true,
      );
    }

    await sleep(250);
    await clearDirectory(serverOutputDir);

    const measurements: ClientIterationResult[] = [];
    for (let iteration = 1; iteration <= iterations; iteration += 1) {
      measurements.push(
        await runIteration(
          browser,
          server.baseUrl,
          scenario,
          iteration,
          false,
        ),
      );
    }

    const scenarioResult: ClientScenarioResult = {
      scenarioId: scenario.id,
      label: scenario.label,
      kind: scenario.kind,
      variant: scenario.variant,
      flow: scenario.flow,
      detailId: scenario.detailId,
      sourcePath: scenario.sourcePath,
      destinationPath: scenario.destinationPath,
      destinationReadySelector: scenario.destinationReadySelector,
      iterations,
      warmupIterations,
      browserVersion: browser.version(),
      measurements,
    };

    await writeJson(
      path.join(clientOutputDir, `${scenario.id}.json`),
      scenarioResult,
    );
  } finally {
    await server.stop();
  }
}

async function main() {
  const runDirArgument = getArgumentValue("run-dir");
  const scenarioFilter = getArgumentValue("scenario");
  const iterations = Number(
    getArgumentValue("iterations") ?? BENCHMARK_DEFAULTS.clientIterations,
  );
  const warmupIterations = Number(
    getArgumentValue("warmup-iterations") ??
      BENCHMARK_DEFAULTS.clientWarmupIterations,
  );
  const runDir = await createRunDirectory(runDirArgument ?? undefined);
  await ensureBuildArtifactsExist();
  await initializeRunMetadata(runDir);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-extensions",
      "--enable-blink-features=ForceEagerMeasureMemory",
    ],
  });
  const browserVersion = browser.version();
  const selectedScenarios = scenarioFilter
    ? getClientScenarios().filter((scenario) => scenario.id === scenarioFilter)
    : getClientScenarios();

  if (selectedScenarios.length === 0) {
    throw new Error(`Unknown client scenario: ${scenarioFilter}`);
  }

  try {
    for (const scenario of selectedScenarios) {
      await runScenario(
        browser,
        runDir,
        scenario,
        BENCHMARK_DEFAULTS.port,
        iterations,
        warmupIterations,
      );
    }
  } finally {
    await browser.close();
  }

  await updateRunMetadata(runDir, {
    browserVersion,
    steps: ["client"],
  });
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unknown client benchmark error",
  );
  process.exit(1);
});
