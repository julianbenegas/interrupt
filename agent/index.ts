import {
  convertToModelMessages,
  FinishReason,
  streamText,
  UIMessageChunk,
} from "ai";
import { defineHook, getWritable } from "workflow";
import { getTools } from "./tools";
import { redis, StoredChat, StoredInterrupt } from "@/lib/redis";
import { nanoid } from "nanoid";

export type AgentEvent = { now: number } & { type: "user-message" };

export const agentHook = defineHook<AgentEvent>();

export async function agent({
  model,
  chatId,
  initialEvent,
}: {
  model: string;
  chatId: string;
  initialEvent: AgentEvent;
}) {
  "use workflow";

  const hook = agentHook.create({ token: chatId });

  await onAgentEvent(initialEvent, { chatId, model });

  for await (const event of hook) {
    await onAgentEvent(event, { chatId, model });
  }
}

async function onAgentEvent(
  event: AgentEvent,
  { chatId, model }: { chatId: string; model: string }
) {
  const streamId = String(event.now);
  const interrupted = await hasInterruptStep({ chatId, since: event.now });

  if (!interrupted) {
    const writable = getWritable({ namespace: streamId });
    await streamTextStep({ model, chatId, writable, now: event.now });
  }
}

async function hasInterruptStep({
  chatId,
  since,
}: {
  chatId: string;
  since: number;
}) {
  "use step";
  const interrupt = await redis.get<StoredInterrupt>(`interrupt:${chatId}`);
  if (!interrupt || interrupt.timestamp < since) return false;
  return true;
}

async function streamTextStep({
  model,
  chatId,
  writable,
  now,
}: {
  model: string;
  chatId: string;
  writable: WritableStream<UIMessageChunk>;
  now: number;
}) {
  "use step";

  const chat = await redis.get<StoredChat>(`chat:${chatId}`);
  if (!chat) {
    throw new Error("Chat not found");
  }
  let uiMessages = chat.messages;

  let finishReason: FinishReason | undefined;
  let stepCount = 0;
  while (finishReason !== "stop" && stepCount < 100) {
    const interrupted = await hasInterruptStep({ chatId, since: now });
    if (interrupted) {
      const message = "[interrupted by user]";
      const writer = writable.getWriter();
      const id = `interruption-${now}`;
      writer.write({ id, type: "text-start" });
      writer.write({ id, type: "text-delta", delta: message });
      writer.write({ id, type: "text-end" });
      writer.releaseLock();
      uiMessages.push({
        id,
        role: "assistant",
        parts: [{ type: "text", text: message }],
      });
      break;
    }

    stepCount++;

    const result = streamText({
      messages: convertToModelMessages(uiMessages),
      tools: getTools(),
      system: "you're a good bot. just chat and have fun.",
      model,
    });

    await result
      .toUIMessageStream({
        onFinish: async ({ messages: newMessages }) => {
          uiMessages = [
            ...uiMessages,
            ...newMessages.map((m) => ({ ...m, id: m.id || nanoid() })),
          ];
          await redis.set<StoredChat>(`chat:${chatId}`, {
            ...chat,
            messages: uiMessages,
          });
        },
      })
      .pipeTo(writable, { preventClose: true });

    finishReason = await result.finishReason;
  }

  await Promise.all([
    writable.close(),
    redis.set<StoredChat>(`chat:${chatId}`, {
      ...chat,
      messages: uiMessages,
      streamId: null,
    }),
  ]);
}
