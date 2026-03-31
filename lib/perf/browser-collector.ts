type RouterTransitionNavigationType = "push" | "replace" | "traverse";
const PERF_QUERY_PARAM = "__perf";
const PERF_LOCAL_STORAGE_KEY = "__menu_perf_benchmark__";

export type BrowserBenchmarkMetric = {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating?: string;
  navigationType?: string;
  pathname: string;
  href: string;
  timestamp: number;
};

export type BrowserBenchmarkLongTask = {
  duration: number;
  name: string;
  pathname: string;
  href: string;
  startTime: number;
  timestamp: number;
};

export type BrowserBenchmarkPaintEntry = {
  name: string;
  pathname: string;
  href: string;
  startTime: number;
  timestamp: number;
};

export type BrowserBenchmarkRouterTransition = {
  url: string;
  navigationType: RouterTransitionNavigationType;
  pathname: string;
  href: string;
  timestamp: number;
};

export type BrowserBenchmarkStore = {
  enabled: boolean;
  initializedAt: number;
  metrics: BrowserBenchmarkMetric[];
  longTasks: BrowserBenchmarkLongTask[];
  paints: BrowserBenchmarkPaintEntry[];
  routerTransitions: BrowserBenchmarkRouterTransition[];
  marks: {
    appInitAt?: number;
  };
  observersStarted: boolean;
};

declare global {
  interface Window {
    __MENU_PERF_BENCHMARK__?: BrowserBenchmarkStore;
  }
}

function isBenchmarkEnabledInBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get(PERF_QUERY_PARAM) === "1") {
    try {
      window.localStorage.setItem(PERF_LOCAL_STORAGE_KEY, "1");
    } catch {
      // Ignore storage failures.
    }
    return true;
  }

  try {
    if (window.localStorage.getItem(PERF_LOCAL_STORAGE_KEY) === "1") {
      return true;
    }
  } catch {
    // Ignore storage failures.
  }

  return (
    document.documentElement.dataset.perfBenchmark === "1"
  );
}

function getLocationSnapshot() {
  return {
    pathname: window.location.pathname,
    href: window.location.href,
    timestamp: Date.now(),
  };
}

function getStore() {
  if (!isBenchmarkEnabledInBrowser()) {
    return null;
  }

  if (!window.__MENU_PERF_BENCHMARK__) {
    window.__MENU_PERF_BENCHMARK__ = {
      enabled: true,
      initializedAt: Date.now(),
      metrics: [],
      longTasks: [],
      paints: [],
      routerTransitions: [],
      marks: {},
      observersStarted: false,
    };
  }

  return window.__MENU_PERF_BENCHMARK__;
}

function observeLongTasks(store: BrowserBenchmarkStore) {
  if (typeof PerformanceObserver === "undefined") {
    return;
  }

  try {
    const observer = new PerformanceObserver((entryList) => {
      const location = getLocationSnapshot();
      for (const entry of entryList.getEntries()) {
        store.longTasks.push({
          duration: entry.duration,
          name: entry.name,
          pathname: location.pathname,
          href: location.href,
          startTime: entry.startTime,
          timestamp: location.timestamp,
        });
      }
    });

    observer.observe({ entryTypes: ["longtask"] as never });
  } catch {
    // Browser doesn't support longtask entries.
  }
}

function observePaintEntries(store: BrowserBenchmarkStore) {
  if (typeof PerformanceObserver === "undefined") {
    return;
  }

  try {
    const observer = new PerformanceObserver((entryList) => {
      const location = getLocationSnapshot();
      for (const entry of entryList.getEntries()) {
        store.paints.push({
          name: entry.name,
          pathname: location.pathname,
          href: location.href,
          startTime: entry.startTime,
          timestamp: location.timestamp,
        });
      }
    });

    observer.observe({ entryTypes: ["paint"] });
  } catch {
    // Browser doesn't support paint entries.
  }
}

export function initializeBrowserBenchmarkCollector() {
  const store = getStore();
  if (!store || store.observersStarted) {
    return store;
  }

  store.marks.appInitAt = performance.now();
  observeLongTasks(store);
  observePaintEntries(store);
  store.observersStarted = true;
  return store;
}

export function recordBrowserBenchmarkWebVital(metric: {
  id: string;
  name: string;
  value: number;
  delta: number;
  rating?: string;
  navigationType?: string;
}) {
  const store = initializeBrowserBenchmarkCollector();
  if (!store) {
    return;
  }

  const location = getLocationSnapshot();
  store.metrics.push({
    ...metric,
    pathname: location.pathname,
    href: location.href,
    timestamp: location.timestamp,
  });
}

export function recordBrowserBenchmarkTransition(
  url: string,
  navigationType: RouterTransitionNavigationType,
) {
  const store = initializeBrowserBenchmarkCollector();
  if (!store) {
    return;
  }

  const location = getLocationSnapshot();
  store.routerTransitions.push({
    url,
    navigationType,
    pathname: location.pathname,
    href: location.href,
    timestamp: location.timestamp,
  });
}
