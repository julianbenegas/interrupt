import { Redis } from "@upstash/redis";
import { UIMessage } from "ai";

export const redis = Redis.fromEnv();

// types

export type StoredChat = {
  id: string;
  runId: string;
  userMessages: {
    data: UIMessage;
    index: number;
    author: string;
  }[];
};

export type StoredChatClient = Pick<
  StoredChat,
  "id" | "runId" | "userMessages"
>;
export function toClientStoredChat(chat: StoredChat): StoredChatClient {
  return { id: chat.id, runId: chat.runId, userMessages: chat.userMessages };
}

export type StoredInterrupt = {
  timestamp: number;
};
