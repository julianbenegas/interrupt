import { redis, StoredChat, StoredInterrupt } from "@/lib/redis";
import { NextRequest } from "next/server";

export interface InterruptRequest {
  now: number;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params;
    if (!chatId) {
      return new Response("Missing chatId", { status: 400 });
    }
    const chat = await redis.get<StoredChat>(`chat:${chatId}`);
    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }
    const body: InterruptRequest = await request.json();
    await redis.set<StoredInterrupt>(`interrupt:${chat.id}`, {
      timestamp: body.now,
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("[INTERRUPT]", error);
    return new Response(
      error instanceof Error ? error.message : "Unknown error",
      { status: 500 }
    );
  }
}
