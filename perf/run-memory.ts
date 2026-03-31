import path from "node:path";
import { chromium, type CDPSession } from "playwright";
import {
  BENCHMARK_DEFAULTS,
  getMemoryCircuits,
  type BenchmarkVariant,
  type MemoryCircuitStep,
} from "./config";
import type {
  MemoryLeakResult,
  MemoryNavigationStep,
  MemoryTrendAnalysis,
} from "./types";
import {
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
import { writeFile } from "node:fs/promises";

// ---------------------------------------------------------------------------
// Node.js Inspector Client — connects to the --inspect WebSocket
// ---------------------------------------------------------------------------

class NodeInspectorClient {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  async connect(port = 9229): Promise<void> {
    const response = await fetch(`http://127.0.0.1:${port}/json`);
    const targets = (await response.json()) as Array<{
      webSocketDebuggerUrl: string;
    }>;
    const wsUrl = targets[0]?.webSocketDebuggerUrl;
    if (!wsUrl) {
      throw new Error("No inspector target found");
    }

    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (event) =>
        reject(new Error(`WebSocket error: ${String(event)}`)),
      );
      this.ws.addEventListener("message", (event) => {
        const data = JSON.parse(String(event.data)) as {
          id?: number;
          result?: unknown;
          error?: { message: string };
        };
        if (data.id != null) {
          const handler = this.pending.get(data.id);
          if (handler) {
            this.pending.delete(data.id);
            if (data.error) {
              handler.reject(new Error(data.error.message));
            } else {
              handler.resolve(data.result);
            }
          }
        }
      });
    });

    // Enable Runtime domain
    await this.send("Runtime.enable");
  }

  private send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket not connected"));
        return;
      }
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async collectGarbage(): Promise<void> {
    await this.send("HeapProfiler.collectGarbage");
  }

  async getHeapUsage(): Promise<{ usedSize: number; totalSize: number }> {
    const result = (await this.send("Runtime.getHeapUsage")) as {
      usedSize: number;
      totalSize: number;
    };
    return { usedSize: result.usedSize, totalSize: result.totalSize };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    for (const handler of this.pending.values()) {
      handler.reject(new Error("Disconnected"));
    }
    this.pending.clear();
  }
}

// ---------------------------------------------------------------------------
// Build artifact check (same pattern as run-client.ts)
// ---------------------------------------------------------------------------

async function ensureBuildArtifactsExist() {
  const buildMetadata = await readBuildMetadata();
  if (!buildMetadata) {
    throw new Error(
      "Missing .next/perf-build-meta.json. Run `npm run perf:build` first.",
    );
  }
}

// ---------------------------------------------------------------------------
// Trend analysis — linear regression + monotonicity
// ---------------------------------------------------------------------------

function analyzeTrend(
  steps: MemoryNavigationStep[],
  extractor: (step: MemoryNavigationStep) => number,
  thresholdPercent: number,
): MemoryTrendAnalysis {
  const values = steps.map(extractor);
  const baseline = values[0]!;
  const final = values[values.length - 1]!;
  const growthBytes = final - baseline;
  const growthPercent = baseline > 0 ? (growthBytes / baseline) * 100 : 0;

  // Monotonically increasing percentage
  let increases = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i]! > values[i - 1]!) {
      increases++;
    }
  }
  const monotonicallyIncreasingPercent =
    values.length > 1 ? (increases / (values.length - 1)) * 100 : 0;

  // Linear regression (least-squares)
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    sumY2 += y * y;
  }

  const denom = n * sumX2 - sumX * sumX;
  const regressionSlope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;

  const denomR =
    Math.sqrt(n * sumX2 - sumX * sumX) * Math.sqrt(n * sumY2 - sumY * sumY);
  const r = denomR !== 0 ? (n * sumXY - sumX * sumY) / denomR : 0;
  const regressionRSquared = r * r;

  // Verdict
  const growthExceedsThreshold = growthPercent > thresholdPercent;
  const monotonicTrend =
    monotonicallyIncreasingPercent > 70 && regressionRSquared > 0.7;

  let verdict: MemoryTrendAnalysis["verdict"];
  if (growthExceedsThreshold && monotonicTrend) {
    verdict = "fail";
  } else if (growthExceedsThreshold || monotonicTrend) {
    verdict = "warn";
  } else {
    verdict = "pass";
  }

  return {
    baseline,
    final,
    growthBytes,
    growthPercent,
    monotonicallyIncreasingPercent,
    regressionSlope,
    regressionRSquared,
    verdict,
  };
}

// ---------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(2)} MB`;
}

function verdictEmoji(verdict: MemoryTrendAnalysis["verdict"]): string {
  switch (verdict) {
    case "pass":
      return "PASS";
    case "warn":
      return "WARN";
    case "fail":
      return "FAIL";
  }
}

function generateSummary(results: MemoryLeakResult[]): string {
  const lines: string[] = ["# Memory Leak Test Summary", ""];

  for (const result of results) {
    lines.push(`## ${result.variant}`);
    lines.push("");
    lines.push(`- Cycles: ${result.cycles} (warmup: ${result.warmupCycles})`);
    lines.push(`- Total steps measured: ${result.totalSteps}`);
    lines.push(
      `- Growth threshold: ${result.growthThresholdPercent}%`,
    );
    lines.push("");

    for (const [side, analysis] of Object.entries(result.analysis) as Array<
      [string, MemoryTrendAnalysis]
    >) {
      lines.push(`### ${side} heap`);
      lines.push("");
      lines.push(`- Verdict: **${verdictEmoji(analysis.verdict)}**`);
      lines.push(
        `- Baseline: ${formatBytes(analysis.baseline)} -> Final: ${formatBytes(analysis.final)}`,
      );
      lines.push(
        `- Growth: ${formatBytes(analysis.growthBytes)} (${analysis.growthPercent.toFixed(1)}%)`,
      );
      lines.push(
        `- Monotonically increasing: ${analysis.monotonicallyIncreasingPercent.toFixed(1)}%`,
      );
      lines.push(
        `- Regression slope: ${analysis.regressionSlope.toFixed(2)} bytes/step (R²=${analysis.regressionRSquared.toFixed(3)})`,
      );
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const runDirArgument = getArgumentValue("run-dir");
  const variantFilter = getArgumentValue("variant") as
    | BenchmarkVariant
    | null;
  const cycles = Number(
    getArgumentValue("cycles") ?? BENCHMARK_DEFAULTS.memoryCycles,
  );
  const warmupCycles = Number(
    getArgumentValue("warmup-cycles") ?? BENCHMARK_DEFAULTS.memoryWarmupCycles,
  );

  await ensureBuildArtifactsExist();
  const runDir = await createRunDirectory(runDirArgument ?? undefined);
  await initializeRunMetadata(runDir);

  const memoryDir = path.join(runDir, "memory");
  await ensureDirectory(memoryDir);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-extensions",
      "--js-flags=--expose-gc",
      "--remote-debugging-port=9222",
    ],
  });
  const browserVersion = browser.version();

  const circuits = getMemoryCircuits();
  const variants: BenchmarkVariant[] = variantFilter
    ? [variantFilter]
    : ["streaming", "blocking"];

  const allResults: MemoryLeakResult[] = [];

  try {
    for (const variant of variants) {
      console.log(`\n=== Memory test: ${variant} ===\n`);
      const startedAt = new Date().toISOString();
      const circuit = circuits[variant];

      const server = await startNextServer({
        port: BENCHMARK_DEFAULTS.port,
        env: {
          NODE_ENV: "production",
          PERF_BENCHMARK: "1",
        },
        inspect: true,
      });

      // Connect to Node.js inspector
      const inspector = new NodeInspectorClient();
      await sleep(1_000); // Give the inspector a moment to start
      await inspector.connect();
      console.log("Connected to Node.js inspector");

      // Open a page and set up CDP session
      const context = await browser.newContext({
        viewport: BENCHMARK_DEFAULTS.browserViewport,
      });
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      await session.send("Performance.enable");
      await session.send("HeapProfiler.enable");

      // Navigate to the starting page
      await page.goto(`${server.baseUrl}/`);
      await page.waitForSelector('[data-perf-page="home"]', { state: "attached" });

      try {
        // Warmup cycles
        console.log(`Running ${warmupCycles} warmup cycle(s)...`);
        await runCycles(page, session, inspector, circuit, warmupCycles, server.baseUrl);

        // Measured cycles
        console.log(`Running ${cycles} measured cycle(s)...`);
        const steps = await runCycles(
          page,
          session,
          inspector,
          circuit,
          cycles,
          server.baseUrl,
        );

        const clientAnalysis = analyzeTrend(
          steps,
          (step) => step.client.jsHeapUsedSizeBytes,
          BENCHMARK_DEFAULTS.memoryGrowthThresholdPercent,
        );
        const serverAnalysis = analyzeTrend(
          steps,
          (step) => step.server.heapUsedBytes,
          BENCHMARK_DEFAULTS.memoryGrowthThresholdPercent,
        );

        const result: MemoryLeakResult = {
          variant,
          cycles,
          totalSteps: steps.length,
          warmupCycles,
          growthThresholdPercent:
            BENCHMARK_DEFAULTS.memoryGrowthThresholdPercent,
          navigationCircuit: circuit.map((s) => s.path),
          browserVersion,
          steps,
          analysis: {
            client: clientAnalysis,
            server: serverAnalysis,
          },
          startedAt,
          completedAt: new Date().toISOString(),
        };

        allResults.push(result);
        await writeJson(
          path.join(memoryDir, `memory-${variant}.json`),
          result,
        );

        console.log(
          `\n  Client: ${verdictEmoji(clientAnalysis.verdict)} (${clientAnalysis.growthPercent.toFixed(1)}% growth)`,
        );
        console.log(
          `  Server: ${verdictEmoji(serverAnalysis.verdict)} (${serverAnalysis.growthPercent.toFixed(1)}% growth)`,
        );
      } finally {
        inspector.disconnect();
        await context.close();
        await server.stop();
      }
    }
  } finally {
    await browser.close();
  }

  // Write summary
  const summary = generateSummary(allResults);
  await writeFile(path.join(memoryDir, "memory-summary.md"), summary, "utf8");
  console.log(`\nResults written to ${memoryDir}`);

  await updateRunMetadata(runDir, {
    browserVersion,
    steps: ["memory"],
  });
}

// ---------------------------------------------------------------------------
// Navigation cycle runner
// ---------------------------------------------------------------------------

async function navigateToStep(
  page: import("playwright").Page,
  baseUrl: string,
  circuitStep: MemoryCircuitStep,
): Promise<void> {
  try {
    await Promise.all([
      page.waitForURL((url) => url.pathname === circuitStep.path, {
        waitUntil: "commit",
        timeout: 10_000,
      }),
      page.click(circuitStep.clickSelector),
    ]);
  } catch {
    // Client-side router stalled — fall back to full navigation
    await page.goto(`${baseUrl}${circuitStep.path}`, { waitUntil: "commit" });
  }
  await page.waitForSelector(circuitStep.readySelector, {
    state: "attached",
    timeout: 15_000,
  });
}

async function runCycles(
  page: import("playwright").Page,
  session: CDPSession,
  inspector: NodeInspectorClient,
  circuit: MemoryCircuitStep[],
  cycleCount: number,
  baseUrl: string,
): Promise<MemoryNavigationStep[]> {
  const steps: MemoryNavigationStep[] = [];
  let stepIndex = 0;

  for (let cycle = 0; cycle < cycleCount; cycle++) {
    for (let s = 0; s < circuit.length; s++) {
      const circuitStep = circuit[s]!;

      await navigateToStep(page, baseUrl, circuitStep);

      // Settle delay
      await sleep(BENCHMARK_DEFAULTS.memorySettleDelayMs);

      // Force GC on both sides
      await session.send("HeapProfiler.collectGarbage");
      await inspector.collectGarbage();

      // Post-GC settle
      await sleep(BENCHMARK_DEFAULTS.memoryPostGcDelayMs);

      // Measure client heap
      const perfResponse = await session.send("Performance.getMetrics");
      const perfMetrics = Object.fromEntries(
        (
          perfResponse as { metrics: Array<{ name: string; value: number }> }
        ).metrics.map((m) => [m.name, m.value]),
      );

      // Measure server heap
      const serverHeap = await inspector.getHeapUsage();

      const step: MemoryNavigationStep = {
        stepIndex,
        cycle,
        stepInCycle: s,
        path: circuitStep.path,
        readySelector: circuitStep.readySelector,
        capturedAt: new Date().toISOString(),
        client: {
          jsHeapUsedSizeBytes: perfMetrics.JSHeapUsedSize ?? 0,
          jsHeapTotalSizeBytes: perfMetrics.JSHeapTotalSize ?? 0,
        },
        server: {
          heapUsedBytes: serverHeap.usedSize,
          heapTotalBytes: serverHeap.totalSize,
        },
      };

      steps.push(step);
      stepIndex++;

      if (stepIndex % 100 === 0) {
        console.log(
          `  Step ${stepIndex}: client=${formatBytes(step.client.jsHeapUsedSizeBytes)}, server=${formatBytes(step.server.heapUsedBytes)}`,
        );
      }
    }
  }

  return steps;
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unknown memory benchmark error",
  );
  process.exit(1);
});
