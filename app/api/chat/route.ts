import { agent, agentHook } from "@/agent";
import { UIMessage } from "ai";
import { getRun, start } from "workflow/api";
import { createAgentStream, createGracefulStreamResponse } from "./agent-stream";
import { getModel } from "@/lib/models";
import { redis, StoredChat } from "@/lib/redis";

export interface ChatRequest {
  message: UIMessage;
  model?: string;
  followUp?: {
    chatId: string;
    userMessageIndex: number;
    streamStartIndex: number;
  };
  newChatId?: string;
}

export async function POST(request: Request) {
  try {
    const body: ChatRequest = await request.json();

    const { followUp, message } = body;

    let runId: string | undefined;
    if (followUp) {
      const chat = await redis.get<StoredChat>(`chat:${followUp.chatId}`);
      if (!chat) {
        return new Response("Chat not found", { status: 404 });
      }

      const hook = await agentHook.resume(followUp.chatId, {
        type: "user-message",
        message,
        now: Date.now(),
      });

      if (!hook) {
        return new Response("No active workflow found", { status: 404 });
      }
      runId = hook.runId;
      await redis.set<StoredChat>(`chat:${chat.id}`, {
        ...chat,
        userMessages: [
          ...chat.userMessages,
          { data: message, index: followUp.userMessageIndex, author: "user" },
        ],
      });
    } else if (body.newChatId) {
      const run = await start(agent, [
        {
          chatId: body.newChatId,
          initialEvent: { type: "user-message", message, now: Date.now() },
          model: getModel(body.model).value,
        },
      ]);
      runId = run.runId;
      await redis.set<StoredChat>(`chat:${body.newChatId}`, {
        id: body.newChatId,
        runId,
        userMessages: [{ data: message, index: 0, author: "user" }],
      });
    } else {
      throw new Error("expected newChatId or followUp by this point");
    }

    if (!runId) {
      throw new Error("expected runId by this point");
    }

    const run = getRun(runId);
    const startIndex = followUp?.streamStartIndex ?? 0;
    const stream = createAgentStream(run.getReadable(), {
      startIndex,
      signal: request.signal,
    });

    return createGracefulStreamResponse(stream, {
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
