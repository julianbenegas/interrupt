import {
  createAgentStream,
  createGracefulStreamResponse,
} from "../agent-stream";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const messageIndex = searchParams.get("messageIndex") ?? "0";

  const run = getRun(runId);

  const stream = createAgentStream(
    run.getReadable({ namespace: messageIndex }),
    { signal: request.signal }
  );

  return createGracefulStreamResponse(stream, {
    headers: { "x-workflow-run-id": runId },
  });
}

export { POST } from "../route";
