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
 * - Skips chunks until startIndex visible chunks have passed
 * - Filters out .ignore chunks (but still uses them to detect activity)
 * - Closes after "finish" chunk + grace period (unless new chunks arrive)
 * - Cancels when abortSignal fires (client disconnect)
 */
export function createAgentStream(
  stream: ReadableStream<UIMessageChunk>,
  options: {
    startIndex?: number;
    onAbort?: () => void;
    signal?: AbortSignal;
  } = {}
): ReadableStream<UIMessageChunk> {
  const { startIndex = 0, onAbort, signal } = options;
  let visibleCount = 0;
  let abortTimeout: NodeJS.Timeout | null = null;
  let terminated = false;

  // Cancel source stream when client disconnects
  signal?.addEventListener("abort", () => {
    if (abortTimeout) {
      clearTimeout(abortTimeout);
      abortTimeout = null;
    }
    terminated = true;
    stream.cancel().catch(() => {});
    onAbort?.();
  });

  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        // Only process chunks that aren't being skipped
        const isVisible = !chunk.type.endsWith(".ignore");
        const shouldEnqueue = isVisible && visibleCount >= startIndex;

        if (isVisible) {
          visibleCount++;
        }

        // Only handle finish/timeout logic for chunks we're actually sending
        if (shouldEnqueue) {
          if (abortTimeout) {
            clearTimeout(abortTimeout);
            abortTimeout = null;
          }

          if (chunk.type === "finish") {
            abortTimeout = setTimeout(() => {
              if (terminated) return;
              terminated = true;
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              controller.enqueue({ type: "stream-done" } as any);
              onAbort?.();
            }, 500);
          }

          controller.enqueue(chunk);
        }
      },
      flush() {
        // Stream closed naturally - cancel the timeout to prevent enqueue on closed stream
        if (abortTimeout) {
          clearTimeout(abortTimeout);
          abortTimeout = null;
        }
        if (terminated) return;
        terminated = true;
        onAbort?.();
      },
    })
  );
}
