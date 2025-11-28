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
  const skipMessagesParam = searchParams.get("skipMessages");
  const skipMessages =
    skipMessagesParam !== null ? parseInt(skipMessagesParam, 10) : 0;

  const run = getRun(runId);

  console.time("run.status");
  try {
    await run.status;
  } catch (error) {
    console.error(error);
    return new Response("Run not found", { status: 404 });
  }
  console.timeEnd("run.status");

  const stream = createAgentStream(run.getReadable(), {
    skipMessages,
    signal: request.signal,
  });

  return createGracefulStreamResponse(stream, {
    headers: { "x-workflow-run-id": runId },
  });
}

export { POST } from "../route";
