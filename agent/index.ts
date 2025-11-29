import { DurableAgent } from "@workflow/ai/agent";
import {
  convertToModelMessages,
  FinishReason,
  ModelMessage,
  stepCountIs,
  UIMessage,
  UIMessageChunk,
} from "ai";
import { defineHook, getWritable } from "workflow";
import { getTools } from "./tools";
import { redis, StoredChat, StoredInterrupt } from "@/lib/redis";

export type AgentEvent = {
  now: number;
} & {
  type: "user-message";
  message: UIMessage;
};

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

  let messages: ModelMessage[] = [];
  const setMessages = (newMessages: ModelMessage[]) => {
    messages = newMessages;
  };

  let messageIndex = 0;
  await onAgentEvent(initialEvent, {
    chatId,
    model,
    messages,
    setMessages,
    messageIndex,
  });

  for await (const event of hook) {
    messageIndex++;
    await onAgentEvent(event, {
      chatId,
      model,
      messages,
      setMessages,
      messageIndex,
    });
  }
}

async function onAgentEvent(
  event: AgentEvent,
  {
    chatId,
    model,
    messages,
    setMessages,
    messageIndex,
  }: {
    chatId: string;
    model: string;
    messages: ModelMessage[];
    setMessages: (newMessages: ModelMessage[]) => void;
    messageIndex: number;
  }
) {
  messages.push(...convertToModelMessages([event.message]));
  setMessages(messages);

  const interrupted = await hasInterruptStep({
    chatId,
    since: event.now,
  });

  if (!interrupted) {
    const writable = getWritable({ namespace: String(messageIndex) });

    let finishReason: FinishReason | undefined = undefined;
    let stepCount = 0;

    const agent = new DurableAgent({
      model,
      system: "you're a good bot. just chat and have fun.",
      tools: getTools(),
    });

    while (finishReason !== "stop" && stepCount < 100) {
      stepCount++;

      const { messages: latestMessages } = await agent.stream({
        messages,
        writable,
        preventClose: true,
        sendFinish: false,
        stopWhen: stepCountIs(1),
        onStepFinish: ({ finishReason: reason }) => {
          finishReason = reason;
        },
      });

      messages = latestMessages.filter((m) => m.role !== "system");
      setMessages(messages);

      const interrupted = await hasInterruptStep({
        chatId,
        since: event.now,
      });
      if (interrupted) {
        messages = await sendInterruptionMessageStep({
          messages,
          writable,
          now: event.now,
          stepCount,
        });
        setMessages(messages);
        break;
      }
    }

    await Promise.all([
      sendFinishMessageStep({ writable }),
      storeAssistantMessagesStep({ chatId, messages }),
    ]);
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

async function sendInterruptionMessageStep({
  messages,
  writable,
  now,
  stepCount,
}: {
  messages: ModelMessage[];
  writable: WritableStream<UIMessageChunk>;
  now: number;
  stepCount: number;
}) {
  "use step";
  const message = "[interrupted by user]";
  const writer = writable.getWriter();
  const id = "interruption" + "-" + now + stepCount;
  writer.write({ id, type: "text-start" });
  writer.write({ id, type: "text-delta", delta: message });
  writer.write({ id, type: "text-end" });
  writer.releaseLock();
  const lastModelMessage = messages.at(-1);
  if (
    lastModelMessage &&
    lastModelMessage.role === "assistant" &&
    Array.isArray(lastModelMessage.content)
  ) {
    lastModelMessage.content.push({
      type: "text",
      text: message,
    });
  }
  return messages;
}

async function sendFinishMessageStep({
  writable,
}: {
  writable: WritableStream<UIMessageChunk>;
}) {
  "use step";
  const writer = writable.getWriter();
  writer.write({ type: "finish" });
  await writer.close();
}

async function storeAssistantMessagesStep({
  chatId,
  messages,
}: {
  chatId: string;
  messages: ModelMessage[];
}) {
  "use step";
  const chat = await redis.get<StoredChat>(`chat:${chatId}`);
  if (!chat) {
    throw new Error("Chat not found");
  }
  await redis.set<StoredChat>(`chat:${chatId}`, {
    ...chat,
    assistantMessages: messages.filter((m) => m.role === "assistant"),
    streamingMessageIndex: null, // Clear streaming flag
  });
}
