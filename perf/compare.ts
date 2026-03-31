import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { BENCHMARK_DEFAULTS } from "./config";
import type {
  ClientIterationResult,
  ClientScenarioResult,
  EventLoopSnapshot,
  ServerRequestMetricRecord,
} from "./types";
import {
  fileExists,
  getArgumentValue,
  readJson,
  readNdjson,
  resolveLatestRunDirectory,
  updateRunMetadata,
  writeJson,
} from "./utils";

type NumericStats = {
  count: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  p95: number | null;
  p99: number | null;
  stddev: number | null;
};

type MetricDirection = "lower-better" | "higher-better";

type ComparisonRow = {
  label: string;
  direction: MetricDirection;
  unit: "ms" | "bytes" | "count" | "ratio" | "rps";
  streaming: number | null;
  blocking: number | null;
};

type LoadScenarioSummary = {
  id: string;
  pageDuration: NumericStats;
  heapDelta: NumericStats;
  cpuUserMicros: NumericStats;
  eventLoopP99: NumericStats;
  requestCount: number;
  errorCount: number;
  k6: {
    httpReqDurationP95: number | null;
    httpReqDurationAvg: number | null;
    httpReqFailedRate: number | null;
    requestRate: number | null;
  };
};

function computeStats(values: number[]): NumericStats {
  if (values.length === 0) {
    return {
      count: 0,
      min: null,
      max: null,
      mean: null,
      median: null,
      p95: null,
      p99: null,
      stddev: null,
    };
  }

  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  const sum = sorted.reduce((accumulator, value) => accumulator + value, 0);
  const mean = sum / count;
  const variance =
    count > 1
      ? sorted.reduce(
          (accumulator, value) => accumulator + (value - mean) ** 2,
          0,
        ) / count
      : 0;

  const percentile = (value: number) => {
    if (sorted.length === 1) {
      return sorted[0];
    }

    const index = (value / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.ceil(index);
    const lowerValue = sorted[lowerIndex];
    const upperValue = sorted[upperIndex];
    const weight = index - lowerIndex;
    return lowerValue + (upperValue - lowerValue) * weight;
  };

  return {
    count,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    stddev: Math.sqrt(variance),
  };
}

function formatBytes(value: number | null) {
  if (value == null) {
    return "n/a";
  }

  if (Math.abs(value) >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (Math.abs(value) >= 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${value.toFixed(0)} B`;
}

function formatNumber(value: number | null, unit: ComparisonRow["unit"]) {
  if (value == null) {
    return "n/a";
  }

  switch (unit) {
    case "ms":
      return `${value.toFixed(1)} ms`;
    case "bytes":
      return formatBytes(value);
    case "ratio":
      return value.toFixed(3);
    case "rps":
      return `${value.toFixed(1)} rps`;
    case "count":
    default:
      return value.toFixed(1);
  }
}

function colorize(text: string, color: "green" | "red" | "neutral") {
  if (color === "green") {
    return `\u001B[32m${text}\u001B[0m`;
  }

  if (color === "red") {
    return `\u001B[31m${text}\u001B[0m`;
  }

  return text;
}

function formatDiff(
  row: ComparisonRow,
  colorizeOutput: boolean,
) {
  if (row.streaming == null || row.blocking == null) {
    return "n/a";
  }

  if (row.streaming === 0) {
    return "n/a";
  }

  const delta = ((row.blocking - row.streaming) / Math.abs(row.streaming)) * 100;
  const lowerIsBetter = row.direction === "lower-better";
  const improved =
    lowerIsBetter ? row.blocking < row.streaming : row.blocking > row.streaming;
  const formatted = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;

  if (!colorizeOutput) {
    return formatted;
  }

  return colorize(formatted, improved ? "green" : "red");
}

function extractMetricValues(
  measurements: ClientIterationResult[],
  selector: (measurement: ClientIterationResult) => number | null,
) {
  return measurements
    .map(selector)
    .filter((value): value is number => value != null && Number.isFinite(value));
}

async function readLoadScenarioSummary(runDir: string, scenarioId: string) {
  const requestsPath = path.join(
    runDir,
    "server",
    "load",
    scenarioId,
    "requests.ndjson",
  );
  const eventLoopPath = path.join(
    runDir,
    "server",
    "load",
    scenarioId,
    "event-loop.ndjson",
  );
  const errorsPath = path.join(
    runDir,
    "server",
    "load",
    scenarioId,
    "errors.ndjson",
  );
  const k6SummaryPath = path.join(runDir, "k6", scenarioId, "summary.json");

  const requests = (await fileExists(requestsPath))
    ? await readNdjson<ServerRequestMetricRecord>(requestsPath)
    : [];
  const eventLoop = (await fileExists(eventLoopPath))
    ? await readNdjson<EventLoopSnapshot>(eventLoopPath)
    : [];
  const errors = (await fileExists(errorsPath))
    ? await readNdjson<Record<string, unknown>>(errorsPath)
    : [];
  const k6Summary = (await fileExists(k6SummaryPath))
    ? await readJson<Record<string, unknown>>(k6SummaryPath)
    : null;

  const pageRequests = requests.filter((request) => request.phase === "page");
  const k6Metrics = (k6Summary?.metrics ?? {}) as Record<
    string,
    { values?: Record<string, number>; rate?: number }
  >;

  return {
    id: scenarioId,
    pageDuration: computeStats(pageRequests.map((request) => request.durationMs)),
    heapDelta: computeStats(
      pageRequests.map((request) => request.memoryDelta.heapUsed ?? 0),
    ),
    cpuUserMicros: computeStats(
      pageRequests.map((request) => request.cpuUserMicros),
    ),
    eventLoopP99: computeStats(
      eventLoop
        .map((snapshot) => snapshot.p99Ms)
        .filter((value): value is number => value != null),
    ),
    requestCount: pageRequests.length,
    errorCount: errors.length,
    k6: {
      httpReqDurationP95: k6Metrics.http_req_duration?.values?.["p(95)"] ?? null,
      httpReqDurationAvg: k6Metrics.http_req_duration?.values?.avg ?? null,
      httpReqFailedRate: k6Metrics.http_req_failed?.values?.rate ?? null,
      requestRate: k6Metrics.http_reqs?.values?.rate ?? null,
    },
  } satisfies LoadScenarioSummary;
}

async function readClientScenarioResults(runDir: string) {
  const clientDir = path.join(runDir, "client");
  const entries = await readdir(clientDir);
  const results = await Promise.all(
    entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => readJson<ClientScenarioResult>(path.join(clientDir, entry))),
  );

  return new Map(results.map((result) => [result.scenarioId, result]));
}

function buildTable(
  title: string,
  rows: ComparisonRow[],
  colorizeOutput: boolean,
) {
  const header = `\n${title}\nMetric | /blog | /blog-no-streaming | Diff\n--- | --- | --- | ---`;
  const body = rows
    .map((row) => {
      const streaming = formatNumber(row.streaming, row.unit);
      const blocking = formatNumber(row.blocking, row.unit);
      return `${row.label} | ${streaming} | ${blocking} | ${formatDiff(
        row,
        colorizeOutput,
      )}`;
    })
    .join("\n");

  return `${header}\n${body}`;
}

function buildComparisonRows(
  streamingMeasurements: ClientIterationResult[],
  blockingMeasurements: ClientIterationResult[],
  flow: "hard-load" | "client-navigation",
) {
  const rows: ComparisonRow[] =
    flow === "hard-load"
      ? [
          {
            label: "TTFB (p50)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(streamingMeasurements, (entry) => entry.metrics.ttfbMs),
            ).median,
            blocking: computeStats(
              extractMetricValues(blockingMeasurements, (entry) => entry.metrics.ttfbMs),
            ).median,
          },
          {
            label: "FCP (p50)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(streamingMeasurements, (entry) => entry.metrics.fcpMs),
            ).median,
            blocking: computeStats(
              extractMetricValues(blockingMeasurements, (entry) => entry.metrics.fcpMs),
            ).median,
          },
          {
            label: "LCP (p50)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(streamingMeasurements, (entry) => entry.metrics.lcpMs),
            ).median,
            blocking: computeStats(
              extractMetricValues(blockingMeasurements, (entry) => entry.metrics.lcpMs),
            ).median,
          },
          {
            label: "CLS (p50)",
            direction: "lower-better",
            unit: "ratio",
            streaming: computeStats(
              extractMetricValues(streamingMeasurements, (entry) => entry.metrics.cls),
            ).median,
            blocking: computeStats(
              extractMetricValues(blockingMeasurements, (entry) => entry.metrics.cls),
            ).median,
          },
          {
            label: "JS heap used (p50)",
            direction: "lower-better",
            unit: "bytes",
            streaming: computeStats(
              extractMetricValues(
                streamingMeasurements,
                (entry) => entry.metrics.jsHeapUsedSizeBytes,
              ),
            ).median,
            blocking: computeStats(
              extractMetricValues(
                blockingMeasurements,
                (entry) => entry.metrics.jsHeapUsedSizeBytes,
              ),
            ).median,
          },
          {
            label: "JS transfer (p50)",
            direction: "lower-better",
            unit: "bytes",
            streaming: computeStats(
              extractMetricValues(
                streamingMeasurements,
                (entry) => entry.metrics.jsTransferSizeBytes,
              ),
            ).median,
            blocking: computeStats(
              extractMetricValues(
                blockingMeasurements,
                (entry) => entry.metrics.jsTransferSizeBytes,
              ),
            ).median,
          },
        ]
      : [
          {
            label: "Click to URL (p50)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(
                streamingMeasurements,
                (entry) => entry.metrics.clickToUrlMs,
              ),
            ).median,
            blocking: computeStats(
              extractMetricValues(
                blockingMeasurements,
                (entry) => entry.metrics.clickToUrlMs,
              ),
            ).median,
          },
          {
            label: "Click to ready (p50)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(
                streamingMeasurements,
                (entry) => entry.metrics.clickToReadyMs,
              ),
            ).median,
            blocking: computeStats(
              extractMetricValues(
                blockingMeasurements,
                (entry) => entry.metrics.clickToReadyMs,
              ),
            ).median,
          },
          {
            label: "Long task count (p50)",
            direction: "lower-better",
            unit: "count",
            streaming: computeStats(
              extractMetricValues(
                streamingMeasurements,
                (entry) => entry.metrics.longTaskCount,
              ),
            ).median,
            blocking: computeStats(
              extractMetricValues(
                blockingMeasurements,
                (entry) => entry.metrics.longTaskCount,
              ),
            ).median,
          },
          {
            label: "Long task duration (p95)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(
                streamingMeasurements,
                (entry) => entry.metrics.longTaskDurationMs,
              ),
            ).p95,
            blocking: computeStats(
              extractMetricValues(
                blockingMeasurements,
                (entry) => entry.metrics.longTaskDurationMs,
              ),
            ).p95,
          },
          {
            label: "INP (p50)",
            direction: "lower-better",
            unit: "ms",
            streaming: computeStats(
              extractMetricValues(streamingMeasurements, (entry) => entry.metrics.inpMs),
            ).median,
            blocking: computeStats(
              extractMetricValues(blockingMeasurements, (entry) => entry.metrics.inpMs),
            ).median,
          },
        ];

  return rows;
}

function buildLoadRows(
  streamingSummary: LoadScenarioSummary,
  blockingSummary: LoadScenarioSummary,
) {
  return [
    {
      label: "k6 req duration (p95)",
      direction: "lower-better",
      unit: "ms",
      streaming: streamingSummary.k6.httpReqDurationP95,
      blocking: blockingSummary.k6.httpReqDurationP95,
    },
    {
      label: "Server duration (p50)",
      direction: "lower-better",
      unit: "ms",
      streaming: streamingSummary.pageDuration.median,
      blocking: blockingSummary.pageDuration.median,
    },
    {
      label: "Server duration (p95)",
      direction: "lower-better",
      unit: "ms",
      streaming: streamingSummary.pageDuration.p95,
      blocking: blockingSummary.pageDuration.p95,
    },
    {
      label: "Heap delta (p50)",
      direction: "lower-better",
      unit: "bytes",
      streaming: streamingSummary.heapDelta.median,
      blocking: blockingSummary.heapDelta.median,
    },
    {
      label: "Request rate",
      direction: "higher-better",
      unit: "rps",
      streaming: streamingSummary.k6.requestRate,
      blocking: blockingSummary.k6.requestRate,
    },
    {
      label: "Event loop p99",
      direction: "lower-better",
      unit: "ms",
      streaming: streamingSummary.eventLoopP99.p95,
      blocking: blockingSummary.eventLoopP99.p95,
    },
  ] satisfies ComparisonRow[];
}

async function collectCommentsApiSummary(runDir: string) {
  const serverClientDir = path.join(runDir, "server", "client");
  if (!(await fileExists(serverClientDir))) {
    return null;
  }

  const scenarioDirectories = await readdir(serverClientDir);
  const records: Record<string, ServerRequestMetricRecord[]> = {
    streaming: [],
    blocking: [],
  };

  for (const scenarioDirectory of scenarioDirectories) {
    const requestsPath = path.join(serverClientDir, scenarioDirectory, "requests.ndjson");
    if (!(await fileExists(requestsPath))) {
      continue;
    }

    const requests = await readNdjson<ServerRequestMetricRecord>(requestsPath);
    const apiRequests = requests.filter((request) => request.phase === "api");
    if (scenarioDirectory.includes("streaming")) {
      records.streaming.push(...apiRequests);
    } else if (scenarioDirectory.includes("blocking")) {
      records.blocking.push(...apiRequests);
    }
  }

  return {
    streaming: computeStats(records.streaming.map((record) => record.durationMs)),
    blocking: computeStats(records.blocking.map((record) => record.durationMs)),
    counts: {
      streaming: records.streaming.length,
      blocking: records.blocking.length,
    },
  };
}

async function main() {
  const runDirArgument = getArgumentValue("run-dir");
  const runDir = runDirArgument ?? (await resolveLatestRunDirectory());
  const loadStreaming = await readLoadScenarioSummary(runDir, "load-list-streaming");
  const loadBlocking = await readLoadScenarioSummary(runDir, "load-list-blocking");
  const loadDetailStreaming = await readLoadScenarioSummary(
    runDir,
    "load-detail-streaming",
  );
  const loadDetailBlocking = await readLoadScenarioSummary(
    runDir,
    "load-detail-blocking",
  );
  const clientResults = await readClientScenarioResults(runDir);
  const commentsApiSummary = await collectCommentsApiSummary(runDir);

  const listHardLoadStreaming =
    clientResults.get("client-list-streaming-hard-load")?.measurements ?? [];
  const listHardLoadBlocking =
    clientResults.get("client-list-blocking-hard-load")?.measurements ?? [];
  const listNavStreaming =
    clientResults.get("client-list-streaming-nav")?.measurements ?? [];
  const listNavBlocking =
    clientResults.get("client-list-blocking-nav")?.measurements ?? [];

  const detailHardLoadStreaming = BENCHMARK_DEFAULTS.detailIds.flatMap(
    (detailId) =>
      clientResults.get(`client-detail-streaming-id-${detailId}-hard-load`)
        ?.measurements ?? [],
  );
  const detailHardLoadBlocking = BENCHMARK_DEFAULTS.detailIds.flatMap(
    (detailId) =>
      clientResults.get(`client-detail-blocking-id-${detailId}-hard-load`)
        ?.measurements ?? [],
  );
  const detailNavStreaming = BENCHMARK_DEFAULTS.detailIds.flatMap(
    (detailId) =>
      clientResults.get(`client-detail-streaming-id-${detailId}-nav`)
        ?.measurements ?? [],
  );
  const detailNavBlocking = BENCHMARK_DEFAULTS.detailIds.flatMap(
    (detailId) =>
      clientResults.get(`client-detail-blocking-id-${detailId}-nav`)
        ?.measurements ?? [],
  );

  const detailPerId = Object.fromEntries(
    BENCHMARK_DEFAULTS.detailIds.map((detailId) => [
      detailId,
      {
        hardLoad: {
          streaming:
            clientResults.get(`client-detail-streaming-id-${detailId}-hard-load`)
              ?.measurements ?? [],
          blocking:
            clientResults.get(`client-detail-blocking-id-${detailId}-hard-load`)
              ?.measurements ?? [],
        },
        clientNavigation: {
          streaming:
            clientResults.get(`client-detail-streaming-id-${detailId}-nav`)
              ?.measurements ?? [],
          blocking:
            clientResults.get(`client-detail-blocking-id-${detailId}-nav`)
              ?.measurements ?? [],
        },
      },
    ]),
  );

  const output = {
    generatedAt: new Date().toISOString(),
    runDir,
    sections: {
      list: {
        serverLoad: {
          streaming: loadStreaming,
          blocking: loadBlocking,
        },
        hardLoad: {
          streaming: {
            stats: {
              ttfb: computeStats(
                extractMetricValues(listHardLoadStreaming, (entry) => entry.metrics.ttfbMs),
              ),
              lcp: computeStats(
                extractMetricValues(listHardLoadStreaming, (entry) => entry.metrics.lcpMs),
              ),
              cls: computeStats(
                extractMetricValues(listHardLoadStreaming, (entry) => entry.metrics.cls),
              ),
            },
          },
          blocking: {
            stats: {
              ttfb: computeStats(
                extractMetricValues(listHardLoadBlocking, (entry) => entry.metrics.ttfbMs),
              ),
              lcp: computeStats(
                extractMetricValues(listHardLoadBlocking, (entry) => entry.metrics.lcpMs),
              ),
              cls: computeStats(
                extractMetricValues(listHardLoadBlocking, (entry) => entry.metrics.cls),
              ),
            },
          },
        },
        clientNavigation: {
          streaming: {
            clickToReady: computeStats(
              extractMetricValues(listNavStreaming, (entry) => entry.metrics.clickToReadyMs),
            ),
          },
          blocking: {
            clickToReady: computeStats(
              extractMetricValues(listNavBlocking, (entry) => entry.metrics.clickToReadyMs),
            ),
          },
        },
      },
      detailAggregate: {
        serverLoad: {
          streaming: loadDetailStreaming,
          blocking: loadDetailBlocking,
        },
        hardLoad: {
          streaming: {
            lcp: computeStats(
              extractMetricValues(
                detailHardLoadStreaming,
                (entry) => entry.metrics.lcpMs,
              ),
            ),
          },
          blocking: {
            lcp: computeStats(
              extractMetricValues(
                detailHardLoadBlocking,
                (entry) => entry.metrics.lcpMs,
              ),
            ),
          },
        },
        clientNavigation: {
          streaming: {
            clickToReady: computeStats(
              extractMetricValues(
                detailNavStreaming,
                (entry) => entry.metrics.clickToReadyMs,
              ),
            ),
          },
          blocking: {
            clickToReady: computeStats(
              extractMetricValues(
                detailNavBlocking,
                (entry) => entry.metrics.clickToReadyMs,
              ),
            ),
          },
        },
      },
      detailPerId,
      commentsApi: commentsApiSummary,
    },
  };

  const markdownSections = [
    buildTable("List: server load", buildLoadRows(loadStreaming, loadBlocking), false),
    buildTable(
      "List: hard load",
      buildComparisonRows(listHardLoadStreaming, listHardLoadBlocking, "hard-load"),
      false,
    ),
    buildTable(
      "List: client navigation",
      buildComparisonRows(listNavStreaming, listNavBlocking, "client-navigation"),
      false,
    ),
    buildTable(
      "Detail aggregate: server load",
      buildLoadRows(loadDetailStreaming, loadDetailBlocking),
      false,
    ),
    buildTable(
      "Detail aggregate: hard load",
      buildComparisonRows(
        detailHardLoadStreaming,
        detailHardLoadBlocking,
        "hard-load",
      ),
      false,
    ),
    buildTable(
      "Detail aggregate: client navigation",
      buildComparisonRows(detailNavStreaming, detailNavBlocking, "client-navigation"),
      false,
    ),
    "\nDetail per-id highlights\nID | LCP p50 /blog | LCP p50 /blog-no-streaming | Click-to-ready p50 /blog | Click-to-ready p50 /blog-no-streaming\n--- | --- | --- | --- | ---",
    ...BENCHMARK_DEFAULTS.detailIds.map((detailId) => {
      const hardLoad = output.sections.detailPerId[detailId].hardLoad;
      const clientNavigation = output.sections.detailPerId[detailId].clientNavigation;

      return `${detailId} | ${formatNumber(
        computeStats(
          extractMetricValues(hardLoad.streaming, (entry) => entry.metrics.lcpMs),
        ).median,
        "ms",
      )} | ${formatNumber(
        computeStats(
          extractMetricValues(hardLoad.blocking, (entry) => entry.metrics.lcpMs),
        ).median,
        "ms",
      )} | ${formatNumber(
        computeStats(
          extractMetricValues(
            clientNavigation.streaming,
            (entry) => entry.metrics.clickToReadyMs,
          ),
        ).median,
        "ms",
      )} | ${formatNumber(
        computeStats(
          extractMetricValues(
            clientNavigation.blocking,
            (entry) => entry.metrics.clickToReadyMs,
          ),
        ).median,
        "ms",
      )}`;
    }),
  ];

  if (commentsApiSummary) {
    markdownSections.push(
      "\nComments API summary\nVariant | Count | Duration p50 | Duration p95\n--- | --- | --- | ---",
      `Streaming | ${commentsApiSummary.counts.streaming} | ${formatNumber(
        commentsApiSummary.streaming.median,
        "ms",
      )} | ${formatNumber(commentsApiSummary.streaming.p95, "ms")}`,
      `Blocking | ${commentsApiSummary.counts.blocking} | ${formatNumber(
        commentsApiSummary.blocking.median,
        "ms",
      )} | ${formatNumber(commentsApiSummary.blocking.p95, "ms")}`,
    );
  }

  const summaryMarkdown = markdownSections.join("\n");
  const comparisonPath = path.join(runDir, "comparison.json");
  const summaryPath = path.join(runDir, "summary.md");
  await writeJson(comparisonPath, output);
  await writeFile(summaryPath, summaryMarkdown, "utf8");

  console.log(
    buildTable("List: server load", buildLoadRows(loadStreaming, loadBlocking), true),
  );
  console.log(
    buildTable(
      "List: hard load",
      buildComparisonRows(listHardLoadStreaming, listHardLoadBlocking, "hard-load"),
      true,
    ),
  );
  console.log(
    buildTable(
      "List: client navigation",
      buildComparisonRows(listNavStreaming, listNavBlocking, "client-navigation"),
      true,
    ),
  );
  console.log(
    buildTable(
      "Detail aggregate: server load",
      buildLoadRows(loadDetailStreaming, loadDetailBlocking),
      true,
    ),
  );
  console.log(
    buildTable(
      "Detail aggregate: hard load",
      buildComparisonRows(
        detailHardLoadStreaming,
        detailHardLoadBlocking,
        "hard-load",
      ),
      true,
    ),
  );
  console.log(
    buildTable(
      "Detail aggregate: client navigation",
      buildComparisonRows(detailNavStreaming, detailNavBlocking, "client-navigation"),
      true,
    ),
  );

  await updateRunMetadata(runDir, {
    steps: ["compare"],
  });
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unknown comparison error",
  );
  process.exit(1);
});
