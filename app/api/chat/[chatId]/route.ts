import { createUIMessageStreamResponse } from "ai";
import { getRun } from "workflow/api";
import { redis, StoredChat } from "@/lib/redis";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;

  if (!chatId) {
    return new Response("chatId is required", { status: 400 });
  }

  const chat = await redis.get<StoredChat>(`chat:${chatId}`);
  if (!chat || !chat.streamId) {
    return new Response("No active stream", { status: 404 });
  }

  const run = getRun(chat.runId);

  return createUIMessageStreamResponse({
    stream: run.getReadable({ namespace: chat.streamId }),
    headers: { "x-workflow-run-id": chat.runId },
  });
}

export { POST } from "../route";
