import { createUIMessageStreamResponse } from "ai";
import { createAgentStream } from "../agent-stream";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const startIndexParam = searchParams.get("startIndex");
  const startIndex =
    startIndexParam !== null ? parseInt(startIndexParam, 10) : 0;

  const run = getRun(runId);

  try {
    await run.status;
  } catch (error) {
    console.error(error);
    return new Response("Run not found", { status: 404 });
  }

  const stream = createAgentStream(run.getReadable(), { startIndex });

  return createUIMessageStreamResponse({
    stream,
    headers: { "x-workflow-run-id": runId },
  });
}

export { POST } from "../route";
