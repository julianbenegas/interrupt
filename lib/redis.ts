import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();

// types

export type StoredChat = {
  id: string;
  runId: string;
};

export type StoredChatClient = Pick<StoredChat, "id" | "runId">;
export function toClientStoredChat(chat: StoredChat): StoredChatClient {
  return { id: chat.id, runId: chat.runId };
}

export type StoredInterrupt = {
  timestamp: number;
};
