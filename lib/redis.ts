import { Redis } from "@upstash/redis";
import { UIMessage } from "ai";

export const redis = Redis.fromEnv();

// types

export type StoredChat = {
  id: string;
  runId: string;
  messages: UIMessage[];
  /** Stream ID (timestamp) currently being streamed, or null if idle */
  streamId: string | null;
};

export type StoredChatClient = Pick<
  StoredChat,
  "id" | "runId" | "messages" | "streamId"
>;
export function toClientStoredChat(chat: StoredChat): StoredChatClient {
  return {
    id: chat.id,
    runId: chat.runId,
    messages: chat.messages,
    streamId: chat.streamId,
  };
}

export type StoredInterrupt = {
  timestamp: number;
};
