import { Redis } from "@upstash/redis";
import { ModelMessage, UIMessage } from "ai";

export const redis = Redis.fromEnv();

// types

export type StoredChat = {
  id: string;
  runId: string;
  userMessages: { data: UIMessage; index: number; author: string }[];
  assistantMessages: ModelMessage[];
};

export type StoredChatClient = Pick<
  StoredChat,
  "id" | "runId" | "userMessages" | "assistantMessages"
>;
export function toClientStoredChat(chat: StoredChat): StoredChatClient {
  return {
    id: chat.id,
    runId: chat.runId,
    userMessages: chat.userMessages,
    assistantMessages: chat.assistantMessages,
  };
}

export type StoredInterrupt = {
  timestamp: number;
};
