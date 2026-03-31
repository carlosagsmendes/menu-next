import path from "node:path";
import { BENCHMARK_DEFAULTS, getLoadScenarios } from "./config";
import {
  clearDirectory,
  commandExists,
  createRunDirectory,
  ensureDirectory,
  fileExists,
  getArgumentValue,
  initializeRunMetadata,
  projectPath,
  readBuildMetadata,
  runCommand,
  sleep,
  startNextServer,
  updateRunMetadata,
  writeJson,
} from "./utils";

async function ensureBuildArtifactsExist() {
  const buildMetadata = await readBuildMetadata();
  if (!buildMetadata) {
    throw new Error(
      "Missing .next/perf-build-meta.json. Run `npm run perf:build` first.",
    );
  }

  return buildMetadata;
}

async function runK6({
  targetUrl,
  routes,
  scenarioId,
  duration,
  vus,
  rampUpDuration,
  rampDownDuration,
  summaryPath,
  rawOutputPath,
}: {
  targetUrl: string;
  routes: string[];
  scenarioId: string;
  duration: string;
  vus: number;
  rampUpDuration: string;
  rampDownDuration: string;
  summaryPath?: string;
  rawOutputPath?: string;
}) {
  const args = ["run"];

  if (summaryPath) {
    args.push("--summary-export", summaryPath);
  }

  if (rawOutputPath) {
    args.push("--out", `json=${rawOutputPath}`);
  }

  args.push(projectPath("perf", "load-test.js"));

  const result = await runCommand({
    command: "k6",
    args,
    env: {
      TARGET_URL: targetUrl,
      ROUTES: routes.join(","),
      SCENARIO: scenarioId,
      DURATION: duration,
      VUS: String(vus),
      RAMP_UP: rampUpDuration,
      RAMP_DOWN: rampDownDuration,
    },
  });

  if (result.exitCode !== 0) {
    throw new Error(`k6 run failed for ${scenarioId}`);
  }
}

async function main() {
  const runDirArgument = getArgumentValue("run-dir");
  const scenarioFilter = getArgumentValue("scenario");
  const duration = getArgumentValue("duration") ?? BENCHMARK_DEFAULTS.loadDuration;
  const vus = Number(getArgumentValue("vus") ?? BENCHMARK_DEFAULTS.loadVus);
  const runDir = await createRunDirectory(runDirArgument ?? undefined);

  if (!(await commandExists("k6"))) {
    throw new Error(
      "k6 is not installed. Install it first, then rerun `npm run perf:load`.",
    );
  }

  await ensureBuildArtifactsExist();
  await initializeRunMetadata(runDir);
  if (scenarioFilter) {
    const matchingScenario = getLoadScenarios().find(
      (scenario) => scenario.id === scenarioFilter,
    );
    if (!matchingScenario) {
      throw new Error(`Unknown load scenario: ${scenarioFilter}`);
    }
  }

  const selectedScenarios = scenarioFilter
    ? getLoadScenarios().filter((scenario) => scenario.id === scenarioFilter)
    : getLoadScenarios();

  async function runSelectedScenarios() {
    for (const scenario of selectedScenarios) {
      const warmupServerDir = path.join(runDir, ".warmup", scenario.id);
      const measuredServerDir = path.join(runDir, "server", "load", scenario.id);
      const k6Dir = path.join(runDir, "k6", scenario.id);
      await clearDirectory(warmupServerDir);
      await clearDirectory(measuredServerDir);
      await ensureDirectory(k6Dir);

      const warmupServer = await startNextServer({
        port: BENCHMARK_DEFAULTS.port,
        env: {
          NODE_ENV: "production",
          PERF_BENCHMARK: "1",
          PERF_OUTPUT_DIR: warmupServerDir,
          PERF_SCENARIO: `${scenario.id}-warmup`,
        },
      });

      try {
        await runK6({
          targetUrl: warmupServer.baseUrl,
          routes: scenario.routes,
          scenarioId: `${scenario.id}-warmup`,
          duration: BENCHMARK_DEFAULTS.warmupDuration,
          vus: BENCHMARK_DEFAULTS.warmupVus,
          rampUpDuration: "1s",
          rampDownDuration: "1s",
        });
      } finally {
        await warmupServer.stop();
      }

      await sleep(250);
      await clearDirectory(measuredServerDir);

      const measuredServer = await startNextServer({
        port: BENCHMARK_DEFAULTS.port,
        env: {
          NODE_ENV: "production",
          PERF_BENCHMARK: "1",
          PERF_OUTPUT_DIR: measuredServerDir,
          PERF_SCENARIO: scenario.id,
        },
      });

      try {
        await runK6({
          targetUrl: measuredServer.baseUrl,
          routes: scenario.routes,
          scenarioId: scenario.id,
          duration,
          vus,
          rampUpDuration: BENCHMARK_DEFAULTS.loadRampUpDuration,
          rampDownDuration: BENCHMARK_DEFAULTS.loadRampDownDuration,
          summaryPath: path.join(k6Dir, "summary.json"),
          rawOutputPath: path.join(k6Dir, "raw.ndjson"),
        });
      } finally {
        await measuredServer.stop();
      }

      await writeJson(path.join(k6Dir, "scenario.json"), {
        scenarioId: scenario.id,
        label: scenario.label,
        kind: scenario.kind,
        variant: scenario.variant,
        routes: scenario.routes,
        detailIds: scenario.detailIds,
        routeMode: scenario.target.routeMode,
        serverRouteLabel: scenario.target.serverRouteLabel,
        k6: {
          duration,
          vus,
          rampUpDuration: BENCHMARK_DEFAULTS.loadRampUpDuration,
          rampDownDuration: BENCHMARK_DEFAULTS.loadRampDownDuration,
        },
      });
    }
  }

  await runSelectedScenarios();
  const metadataPath = path.join(runDir, "k6");
  if (!(await fileExists(metadataPath))) {
    throw new Error("No k6 output directory was created.");
  }

  await updateRunMetadata(runDir, {
    steps: ["load"],
  });
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Unknown load benchmark error",
  );
  process.exit(1);
});
