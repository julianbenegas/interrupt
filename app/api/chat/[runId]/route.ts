import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);
  const messageIndex = searchParams.get("messageIndex") ?? "0";

  const run = getRun(runId);

  return createUIMessageStreamResponse({
    stream: run.getReadable({ namespace: messageIndex }),
    headers: { "x-workflow-run-id": runId },
  });
}

export { POST } from "../route";
