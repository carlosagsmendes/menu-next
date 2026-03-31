import {
  initializeBrowserBenchmarkCollector,
  recordBrowserBenchmarkTransition,
} from "./lib/perf/browser-collector";

initializeBrowserBenchmarkCollector();

export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
) {
  recordBrowserBenchmarkTransition(url, navigationType);
}
