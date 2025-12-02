import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { redis, StoredChat, getMessages, getStreamId } from "@/lib/redis";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  if (!chatId) notFound();

  const [chat, messages, streamId] = await Promise.all([
    redis.get<StoredChat>(`chat:${chatId}`),
    getMessages(chatId),
    getStreamId(chatId),
  ]);

  if (!chat) notFound();

  return (
    <Chat
      chat={{
        id: chat.id,
        runId: chat.runId,
        streamId,
        messages,
      }}
    />
  );
}
