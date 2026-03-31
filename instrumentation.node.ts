import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FileSpanExporter } from "@/lib/perf/file-span-exporter";
import { startEventLoopMonitor } from "@/lib/perf/event-loop-monitor";

const globalState = globalThis as typeof globalThis & {
  __menuPerfNodeSdk?: NodeSDK;
};

export async function registerPerfInstrumentation() {
  if (globalState.__menuPerfNodeSdk) {
    return;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "menu-next-perf-benchmark",
    }),
    spanProcessor: new SimpleSpanProcessor(new FileSpanExporter()),
    instrumentations: [
      new HttpInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });

  await sdk.start();
  startEventLoopMonitor();
  globalState.__menuPerfNodeSdk = sdk;
}
