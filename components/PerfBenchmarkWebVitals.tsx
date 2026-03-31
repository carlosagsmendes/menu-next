"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";
import {
  initializeBrowserBenchmarkCollector,
  recordBrowserBenchmarkWebVital,
} from "@/lib/perf/browser-collector";

type ReportWebVitalsCallback = Parameters<typeof useReportWebVitals>[0];

const reportWebVitals: ReportWebVitalsCallback = (metric) => {
  recordBrowserBenchmarkWebVital({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
  });
};

export function PerfBenchmarkWebVitals() {
  useEffect(() => {
    initializeBrowserBenchmarkCollector();
  }, []);

  useReportWebVitals(reportWebVitals);

  return null;
}
