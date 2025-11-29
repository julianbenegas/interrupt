import { agent, agentHook } from "@/agent";
import { createUIMessageStreamResponse, UIMessage } from "ai";
import { getRun, start } from "workflow/api";
import { getModel } from "@/lib/models";
import { redis, StoredChat } from "@/lib/redis";

export interface ChatRequest {
  messages: UIMessage[];
  model?: string;
  newChatId?: string;
}

export async function POST(
  request: Request,
  { params }: { params?: Promise<{ chatId?: string }> }
) {
  try {
    const body: ChatRequest = await request.json();

    const { messages } = body;
    const now = Date.now();
    const streamId = String(now);

    const { chatId: existingChatId } = (await params) ?? {};

    let runId: string | undefined;
    if (existingChatId) {
      const chat = await redis.get<StoredChat>(`chat:${existingChatId}`);
      if (!chat) {
        return new Response("Chat not found", { status: 404 });
      }

      const hook = await agentHook.resume(existingChatId, {
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
    } else if (body.newChatId) {
      console.log("starting...", body.newChatId);
      const run = await start(agent, [
        {
          chatId: body.newChatId,
          initialEvent: { type: "user-message", now },
          model: getModel(body.model).value,
        },
      ]);
      runId = run.runId;
      await redis.set<StoredChat>(`chat:${body.newChatId}`, {
        id: body.newChatId,
        runId,
        messages,
        streamId,
      });
    } else {
      throw new Error("expected newChatId or followUp by this point");
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
