export const PERF_BENCHMARK_ENV = "PERF_BENCHMARK";
export const PERF_OUTPUT_DIR_ENV = "PERF_OUTPUT_DIR";
export const PERF_SCENARIO_ENV = "PERF_SCENARIO";

export function isPerfBenchmarkEnabled() {
  return process.env[PERF_BENCHMARK_ENV] === "1";
}

export function getPerfOutputDir() {
  return process.env[PERF_OUTPUT_DIR_ENV] ?? null;
}

export function getPerfScenario() {
  return process.env[PERF_SCENARIO_ENV] ?? null;
}
