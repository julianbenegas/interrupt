import { redis, StoredChat, StoredInterrupt } from "@/lib/redis";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const body = await request.json();
    const { chatId } = body;
    if (!chatId) {
      return new Response("Missing chatId", { status: 400 });
    }
    const chat = await redis.get<StoredChat>(`chat:${chatId}`);
    const { runId } = await params;
    if (!chat || chat.runId !== runId) {
      return new Response("Chat not found", { status: 404 });
    }
    await redis.set<StoredInterrupt>(`interrupt:${chat.id}`, {
      timestamp: Date.now(),
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
