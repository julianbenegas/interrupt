import { createUIMessageStreamResponse, UIMessage } from "ai";
import { getRun, start } from "workflow/api";
import { redis, StoredChat } from "@/lib/redis";
import { agent, agentHook } from "@/agent";
import { getModel } from "@/lib/models";

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

export interface ChatRequest {
  messages: UIMessage[];
  model?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const body: ChatRequest = await request.json();

    const { messages } = body;
    const now = Date.now();
    const streamId = String(now);

    const { chatId } = (await params) ?? {};

    if (chatId.length > 32) {
      return new Response("Invalid chatId", { status: 400 });
    }

    const chat = await redis.get<StoredChat>(`chat:${chatId}`);

    let runId: string | undefined;
    if (chat) {
      if (!chat) {
        return new Response("Chat not found", { status: 404 });
      }

      const hook = await agentHook.resume(chat.id, {
        type: "user-message",
        now,
      });

      if (!hook) {
        return new Response("No active workflow found", { status: 404 });
      }
      runId = hook.runId;
      await redis.set<StoredChat>(`chat:${chat.id}`, {
        ...chat,
        messages: [...chat.messages, ...messages],
        streamId,
      });
    } else {
      const run = await start(agent, [
        {
          chatId,
          initialEvent: { type: "user-message", now },
          model: getModel(body.model).value,
        },
      ]);
      runId = run.runId;
      await redis.set<StoredChat>(`chat:${chatId}`, {
        id: chatId,
        runId,
        messages,
        streamId,
      });
    }

    if (!runId) {
      throw new Error("expected runId by this point");
    }

    const run = getRun(runId);

    return createUIMessageStreamResponse({
      stream: run.getReadable({ namespace: streamId }),
      headers: { "x-workflow-run-id": runId },
    });
  } catch (error) {
    console.error(error);
    return new Response(
      error instanceof Error ? error.message : "Unknown error",
      { status: 500 }
    );
  }
}
