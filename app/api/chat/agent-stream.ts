import { UIMessageChunk } from "ai";

/**
 * Creates a streaming SSE response that handles client disconnects gracefully.
 * Unlike createUIMessageStreamResponse, this won't throw ResponseAborted errors.
 */
export function createGracefulStreamResponse(
  stream: ReadableStream<UIMessageChunk>,
  options: { headers?: Record<string, string> } = {}
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const data = `data: ${JSON.stringify(value)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        // Silently handle aborts - client disconnected
        if (
          error instanceof Error &&
          (error.name === "AbortError" || error.message.includes("abort"))
        ) {
          try {
            controller.close();
          } catch {
            // Already closed
          }
          return;
        }
        // For other errors, close with error
        try {
          controller.error(error);
        } catch {
          // Already closed
        }
      }
    },
    cancel() {
      stream.cancel().catch(() => {});
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...options.headers,
    },
  });
}

/**
 * Creates a filtered agent stream that:
 * - Filters out .ignore chunks
 * - Cancels source stream when client disconnects
 *
 * With namespaced streams, each stream contains only one message and closes
 * naturally when the agent calls writer.close().
 */
export function createAgentStream(
  stream: ReadableStream<UIMessageChunk>,
  options: { signal?: AbortSignal } = {}
): ReadableStream<UIMessageChunk> {
  const { signal } = options;

  // Cancel source stream when client disconnects
  signal?.addEventListener("abort", () => {
    stream.cancel().catch(() => {});
  });

  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        // Filter out .ignore chunks
        if (!chunk.type.endsWith(".ignore")) {
          controller.enqueue(chunk);
        }
      },
    })
  );
}
