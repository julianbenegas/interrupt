import { agent, agentHook } from "@/agent";
import { createUIMessageStreamResponse, UIMessage } from "ai";
import { getRun, start } from "workflow/api";
import { createAgentStream } from "./agent-stream";
import { getModel } from "@/lib/models";
import { redis, StoredChat } from "@/lib/redis";

export interface ChatRequest {
  message: UIMessage;
  model?: string;
  followUp?: { chatId: string; startIndex?: number };
  newChatId?: string;
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("This API is only available in development mode", {
      status: 403,
    });
  }

  try {
    const body: ChatRequest = await request.json();

    const { followUp, message } = body;

    let runId: string | undefined;
    if (followUp) {
      const hook = await agentHook.resume(followUp.chatId, {
        type: "user-message",
        message,
        now: Date.now(),
      });

      if (!hook) {
        return new Response("No active workflow found", { status: 404 });
      }
      runId = hook.runId;
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
      });
    } else {
      throw new Error("expected newChatId or followUp by this point");
    }

    if (!runId) {
      throw new Error("expected runId by this point");
    }

    const run = getRun(runId);
    const startIndex = followUp?.startIndex ?? 0;
    const stream = createAgentStream(run.getReadable(), { startIndex });

    return createUIMessageStreamResponse({
      stream,
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
