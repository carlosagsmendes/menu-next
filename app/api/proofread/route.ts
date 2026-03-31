import type { ProofreadEvent } from "@/data/editor";
import {
  createProofreadErrorEvent,
  proofreadDocumentStream,
  validateProofreadRequestPayload,
} from "@/lib/proofread";

function eventToLine(event: ProofreadEvent) {
  return `${JSON.stringify(event)}\n`;
}

function streamNdjson(events: AsyncIterable<ProofreadEvent>) {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(eventToLine(event)));
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Proofread stream failed.";
        const fallbackEvent = createProofreadErrorEvent("run_stream_error", message);
        controller.enqueue(encoder.encode(eventToLine(fallbackEvent)));
      } finally {
        controller.close();
      }
    },
  });
}

function jsonParseSafe(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const requestText = await request.text();
  const body = requestText.length > 0 ? jsonParseSafe(requestText) : null;

  if (!validateProofreadRequestPayload(body)) {
    const error = createProofreadErrorEvent(
      "run_invalid_request",
      "Invalid proofread request payload."
    );

    return new Response(
      streamNdjson((async function* () {
        yield error;
      })()),
      {
        status: 400,
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      }
    );
  }

  const stream = proofreadDocumentStream(body);

  return new Response(streamNdjson(stream), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
