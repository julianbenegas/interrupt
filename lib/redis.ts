import { Redis } from "@upstash/redis";
import { ModelMessage, UIMessage } from "ai";

export const redis = Redis.fromEnv();

// types

export type StoredChat = {
  id: string;
  runId: string;
  userMessages: { data: UIMessage; index: number; author: string }[];
  assistantMessages: ModelMessage[];
  /** Index of the message currently being streamed, or null if idle */
  streamingMessageIndex: number | null;
};

export type StoredChatClient = Pick<
  StoredChat,
  | "id"
  | "runId"
  | "userMessages"
  | "assistantMessages"
  | "streamingMessageIndex"
>;
export function toClientStoredChat(chat: StoredChat): StoredChatClient {
  return {
    id: chat.id,
    runId: chat.runId,
    userMessages: chat.userMessages,
    assistantMessages: chat.assistantMessages,
    streamingMessageIndex: chat.streamingMessageIndex,
  };
}

export type StoredInterrupt = {
  timestamp: number;
};
