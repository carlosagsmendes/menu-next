import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { appendPerfJsonLine } from "@/lib/perf/file-utils";
import { getPerfScenario } from "@/lib/perf/benchmark-env";

type ExportResult = {
  code: 0 | 1;
  error?: Error;
};

type ExportResultCallback = (result: ExportResult) => void;

function durationToMilliseconds(duration?: [number, number]) {
  if (!duration) {
    return null;
  }

  const [seconds, nanoseconds] = duration;
  return seconds * 1_000 + nanoseconds / 1_000_000;
}

export class FileSpanExporter {
  export(spans: ReadableSpan[], resultCallback: ExportResultCallback) {
    void Promise.all(
      spans.map((span) =>
        appendPerfJsonLine("traces.ndjson", {
          timestamp: new Date().toISOString(),
          scenario: getPerfScenario(),
          traceId: span.spanContext().traceId,
          spanId: span.spanContext().spanId,
          parentSpanId: span.parentSpanContext?.spanId ?? null,
          name: span.name,
          kind: span.kind,
          status: span.status,
          attributes: span.attributes,
          events: span.events,
          links: span.links,
          resourceAttributes: span.resource.attributes,
          scope: span.instrumentationScope,
          startTime: span.startTime,
          endTime: span.endTime,
          durationMs: durationToMilliseconds(span.duration as [number, number]),
        }),
      ),
    )
      .then(() => {
        resultCallback({ code: 0 });
      })
      .catch((error: unknown) => {
        resultCallback({
          code: 1,
          error:
            error instanceof Error ? error : new Error("Failed to export spans"),
        });
      });
  }

  forceFlush() {
    return Promise.resolve();
  }

  shutdown() {
    return Promise.resolve();
  }
}
