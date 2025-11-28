import { notFound } from "next/navigation";
import { Chat } from "@/components/chat";
import { redis, StoredChat, toClientStoredChat } from "@/lib/redis";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  if (!chatId) notFound();

  const chat = await redis.get<StoredChat>(`chat:${chatId}`);

  if (!chat) notFound();

  return (
    <div>
      ChatPage {chatId}
      <Chat chat={toClientStoredChat(chat)} />
    </div>
  );
}
