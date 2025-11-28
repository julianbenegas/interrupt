import { UIMessageChunk } from "ai";

/**
 * Creates a filtered agent stream that:
 * - Skips chunks until startIndex visible chunks have passed
 * - Filters out .ignore chunks (but still uses them to detect activity)
 * - Closes after "finish" chunk + grace period (unless new chunks arrive)
 */
export function createAgentStream(
  stream: ReadableStream<UIMessageChunk>,
  options: { startIndex?: number; onAbort?: () => void } = {}
): ReadableStream<UIMessageChunk> {
  const { startIndex = 0, onAbort } = options;
  let visibleCount = 0;
  let abortTimeout: NodeJS.Timeout | null = null;
  let terminated = false;

  return stream.pipeThrough(
    new TransformStream<UIMessageChunk, UIMessageChunk>({
      transform(chunk, controller) {
        if (abortTimeout) {
          clearTimeout(abortTimeout);
          abortTimeout = null;
        }

        if (chunk.type === "finish") {
          abortTimeout = setTimeout(() => {
            if (terminated) return;
            terminated = true;
            controller.terminate();
            onAbort?.();
          }, 500);
        }

        if (chunk.type.endsWith(".ignore") === false) {
          if (visibleCount >= startIndex) {
            controller.enqueue(chunk);
          }
          visibleCount++;
        }
      },
    })
  );
}
