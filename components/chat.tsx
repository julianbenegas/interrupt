"use client";
import * as React from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { CopyIcon } from "lucide-react";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { StoredChatClient } from "@/lib/redis";
import { useRouter } from "next/navigation";
import { ChatRequest } from "@/app/api/chat/route";
import { models } from "@/lib/models";
import type { UIMessage, UIMessageChunk } from "ai";

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export const Chat = ({ chat }: { chat?: StoredChatClient }) => {
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState<string>(models[0].value);
  const { sendMessage, messages, status } = useDurableChat({
    chat,
    model,
  });

  const handleSubmit = async (message: PromptInputMessage) => {
    const ogInput = input;
    setInput("");
    try {
      await sendMessage({
        text: message.text || "",
        files: message.files,
      });
    } catch (error) {
      setInput(ogInput);
      throw error;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {message.role === "assistant" &&
                  message.parts.filter((part) => part.type === "source-url")
                    .length > 0 && (
                    <Sources>
                      <SourcesTrigger
                        count={
                          message.parts.filter(
                            (part) => part.type === "source-url"
                          ).length
                        }
                      />
                      {message.parts
                        .filter((part) => part.type === "source-url")
                        .map((part, i) => (
                          <SourcesContent key={`${message.id}-${i}`}>
                            <Source
                              key={`${message.id}-${i}`}
                              href={part.url}
                              title={part.url}
                            />
                          </SourcesContent>
                        ))}
                    </Sources>
                  )}
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                          {message.role === "assistant" &&
                            i === messages.length - 1 && (
                              <MessageActions>
                                <MessageAction
                                  onClick={() =>
                                    navigator.clipboard.writeText(part.text)
                                  }
                                  label="Copy"
                                >
                                  <CopyIcon className="size-3" />
                                </MessageAction>
                              </MessageActions>
                            )}
                        </Message>
                      );
                    case "reasoning":
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={
                            status === "streaming" &&
                            i === message.parts.length - 1 &&
                            message.id === messages.at(-1)?.id
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return (
                        <div key={`${message.id}-${i}`}>
                          <pre className="text-xs text-muted-foreground font-mono">
                            <code>{JSON.stringify(part, null, 2)}</code>
                          </pre>
                        </div>
                      );
                  }
                })}
              </div>
            ))}
            {status === "submitted" && (
              <div className="flex justify-center items-center">
                <Loader />
              </div>
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <PromptInput
          onSubmit={handleSubmit}
          className="mt-4"
          globalDrop
          multiple
        >
          <PromptInputHeader>
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>
          </PromptInputHeader>
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              autoFocus
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
              <PromptInputSelect
                onValueChange={(value) => {
                  setModel(value);
                }}
                value={model}
              >
                <PromptInputSelectTrigger>
                  <PromptInputSelectValue />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {models.map((model) => (
                    <PromptInputSelectItem
                      key={model.value}
                      value={model.value}
                    >
                      {model.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={!input && status === "ready"}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};

type StreamingMessage = {
  id: string;
  role: "assistant";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parts: any[];
  partIndex: Map<string, number>;
};

function useDurableChat({
  chat,
  model,
}: {
  chat?: StoredChatClient;
  model: string;
}) {
  const router = useRouter();
  const [localMessages, setLocalMessages] = React.useState<UIMessage[]>([]);
  const [status, setStatus] = React.useState<ChatStatus>("ready");
  const statusRef = React.useRef<ChatStatus>(status);
  statusRef.current = status;
  const assistantMessageCountRef = React.useRef(
    chat?.assistantMessages?.length ?? 0
  );
  const messageIdCounterRef = React.useRef(0);
  const chatIdRef = React.useRef<string | null>(chat?.id ?? null);
  const runIdRef = React.useRef<string | null>(chat?.runId ?? null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const resumedStream = React.useRef(false);
  const queuedMessagesRef = React.useRef<PromptInputMessage[]>([]);

  const processStream = React.useCallback(async (response: Response) => {
    const runId = response.headers.get("x-workflow-run-id");
    if (runId) {
      runIdRef.current = runId;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let currentMessage: StreamingMessage | null = null;

    const flushCurrentMessage = () => {
      if (currentMessage) {
        const finalMessage: UIMessage = {
          id: currentMessage.id,
          role: currentMessage.role,
          parts: currentMessage.parts,
        };
        setLocalMessages((prev) => {
          const existingIndex = prev.findIndex((m) => m.id === finalMessage.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = finalMessage;
            return updated;
          }
          return [...prev, finalMessage];
        });
      }
    };

    const startNewMessage = (): StreamingMessage => {
      flushCurrentMessage();
      const newId = `assistant-${messageIdCounterRef.current++}`;
      currentMessage = {
        id: newId,
        role: "assistant",
        parts: [],
        partIndex: new Map(),
      };
      return currentMessage;
    };

    const getCurrentMessage = (): StreamingMessage => {
      if (!currentMessage) {
        return startNewMessage();
      }
      return currentMessage;
    };

    setStatus("streaming");

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let streamDone = false;
        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            let jsonStr: string;

            // Handle different stream formats
            if (line.startsWith("data:")) {
              jsonStr = line.slice(5).trim();
              if (jsonStr === "[DONE]") {
                streamDone = true;
                break;
              }
            } else if (line.match(/^\d+:/)) {
              // Data stream protocol: "0:", "2:", etc.
              jsonStr = line.slice(line.indexOf(":") + 1);
            } else {
              continue;
            }

            const chunk = JSON.parse(jsonStr);
            const typedChunk = chunk as UIMessageChunk;

            const updateLocalMessages = () => {
              const msg = currentMessage;
              if (!msg) return;
              setLocalMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === msg.id);
                if (idx < 0) {
                  return [
                    ...prev,
                    {
                      id: msg.id,
                      role: "assistant" as const,
                      parts: [...msg.parts],
                    },
                  ];
                }
                const updated = [...prev];
                updated[idx] = { ...updated[idx], parts: [...msg.parts] };
                return updated;
              });
            };

            switch (typedChunk.type) {
              // Message boundaries
              case "start": {
                startNewMessage();
                break;
              }
              case "finish": {
                flushCurrentMessage();
                currentMessage = null;
                assistantMessageCountRef.current++;
                break;
              }

              // Text
              case "text-start": {
                const msg = getCurrentMessage();
                msg.partIndex.set(`text-${typedChunk.id}`, msg.parts.length);
                msg.parts.push({ type: "text", text: "" });
                break;
              }
              case "text-delta": {
                const msg = getCurrentMessage();
                const partKey = `text-${typedChunk.id}`;
                let partIdx = msg.partIndex.get(partKey);
                if (partIdx === undefined) {
                  partIdx = msg.parts.length;
                  msg.partIndex.set(partKey, partIdx);
                  msg.parts.push({ type: "text", text: "" });
                }
                const textPart = msg.parts[partIdx];
                if (textPart?.type === "text") {
                  textPart.text += typedChunk.delta;
                }
                updateLocalMessages();
                break;
              }

              // Reasoning
              case "reasoning-start": {
                const msg = getCurrentMessage();
                msg.partIndex.set(
                  `reasoning-${typedChunk.id}`,
                  msg.parts.length
                );
                msg.parts.push({ type: "reasoning", text: "" });
                break;
              }
              case "reasoning-delta": {
                const msg = getCurrentMessage();
                const partKey = `reasoning-${typedChunk.id}`;
                let partIdx = msg.partIndex.get(partKey);
                if (partIdx === undefined) {
                  partIdx = msg.parts.length;
                  msg.partIndex.set(partKey, partIdx);
                  msg.parts.push({ type: "reasoning", text: "" });
                }
                const reasoningPart = msg.parts[partIdx];
                if (reasoningPart?.type === "reasoning") {
                  reasoningPart.text += typedChunk.delta;
                }
                updateLocalMessages();
                break;
              }

              // Tool calls
              case "tool-input-start": {
                const msg = getCurrentMessage();
                msg.partIndex.set(
                  `tool-${typedChunk.toolCallId}`,
                  msg.parts.length
                );
                msg.parts.push({
                  type: "tool-invocation",
                  toolInvocation: {
                    state: "partial-call",
                    toolCallId: typedChunk.toolCallId,
                    toolName: typedChunk.toolName,
                    args: {},
                  },
                });
                updateLocalMessages();
                break;
              }
              case "tool-input-available": {
                const msg = getCurrentMessage();
                const partKey = `tool-${typedChunk.toolCallId}`;
                let partIdx = msg.partIndex.get(partKey);
                if (partIdx === undefined) {
                  partIdx = msg.parts.length;
                  msg.partIndex.set(partKey, partIdx);
                  msg.parts.push({
                    type: "tool-invocation",
                    toolInvocation: {
                      state: "call",
                      toolCallId: typedChunk.toolCallId,
                      toolName: typedChunk.toolName,
                      args: typedChunk.input,
                    },
                  });
                } else {
                  const toolPart = msg.parts[partIdx];
                  if (toolPart?.type === "tool-invocation") {
                    toolPart.toolInvocation = {
                      state: "call",
                      toolCallId: typedChunk.toolCallId,
                      toolName: typedChunk.toolName,
                      args: typedChunk.input,
                    };
                  }
                }
                updateLocalMessages();
                break;
              }
              case "tool-output-available": {
                const msg = getCurrentMessage();
                const partKey = `tool-${typedChunk.toolCallId}`;
                const partIdx = msg.partIndex.get(partKey);
                if (partIdx !== undefined) {
                  const toolPart = msg.parts[partIdx];
                  if (toolPart?.type === "tool-invocation") {
                    toolPart.toolInvocation = {
                      ...toolPart.toolInvocation,
                      state: "result",
                      result: typedChunk.output,
                    };
                  }
                }
                updateLocalMessages();
                break;
              }

              // Sources
              case "source-url": {
                const msg = getCurrentMessage();
                msg.parts.push({
                  type: "source-url",
                  sourceId: typedChunk.sourceId,
                  url: typedChunk.url,
                  title: typedChunk.title,
                });
                updateLocalMessages();
                break;
              }

              // Ignore step markers and other chunks
              case "start-step":
              case "finish-step":
              case "text-end":
              case "reasoning-end":
              case "tool-input-delta":
              case "tool-input-error":
              case "tool-output-error":
                break;

              default:
                // Unknown chunk type - ignore
                break;
            }
            if (streamDone) break;
          } catch {
            // skip malformed chunks
          }
        }
        if (streamDone) break;
      }

      flushCurrentMessage();
      setStatus("ready");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        flushCurrentMessage();
        setStatus("ready");
      } else {
        setStatus("error");
        throw error;
      }
    }
  }, []);

  const messages = React.useMemo(() => {
    const result: UIMessage[] = [];

    // Place stored user messages at their correct indices
    for (const message of chat?.userMessages ?? []) {
      result[message.index] = message.data;
    }

    // Merge in local messages
    let indexToPlaceIn = 0;

    if (chat?.assistantMessages) {
      for (let i = 0; i < chat.assistantMessages.length; i++) {
        const assistantMessage = chat.assistantMessages[i];
        if (!assistantMessage || assistantMessage.role !== "assistant")
          continue;

        // Convert content to parts array
        const content = assistantMessage.content;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parts: any[] =
          typeof content === "string"
            ? [{ type: "text", text: content }]
            : Array.isArray(content)
            ? content
            : [];

        let placed = false;
        while (!placed) {
          if (!result[indexToPlaceIn]) {
            result[indexToPlaceIn] = {
              id: `assistant-${indexToPlaceIn}`,
              role: "assistant",
              parts,
            };
            placed = true;
          }
          indexToPlaceIn++;
        }
      }
    }

    for (let i = 0; i < localMessages.length; i++) {
      const localMessage = localMessages[i];
      if (!localMessage) continue;

      if (!result[indexToPlaceIn]) {
        result[indexToPlaceIn] = localMessage;
        indexToPlaceIn++;
        continue;
      }

      if (localMessage.role === "user") {
        indexToPlaceIn++;
        continue;
      }

      let placed = false;
      while (!placed) {
        if (!result[indexToPlaceIn]) {
          result[indexToPlaceIn] = localMessage;
          placed = true;
        }
        indexToPlaceIn++;
      }
    }

    return result;
  }, [chat?.userMessages, chat?.assistantMessages, localMessages]);

  const sendMessage = React.useCallback(
    async (message: PromptInputMessage) => {
      const hasContent =
        Boolean(message.text) || Boolean(message.files?.length);
      const isBusy = statusRef.current !== "ready";

      if (isBusy) {
        if (hasContent) {
          queuedMessagesRef.current.push(message);
        }
        if (runIdRef.current && chatIdRef.current) {
          try {
            await fetch(
              `/api/chat/${encodeURIComponent(runIdRef.current)}/interrupt`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chatId: chatIdRef.current }),
              }
            );
          } catch (error) {
            console.error("interrupt error:", error);
          }
        }
        return;
      }

      if (!hasContent) {
        return;
      }

      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();

      const newChatId = chatIdRef.current ?? crypto.randomUUID();
      const isNewChat = !chatIdRef.current;
      chatIdRef.current = newChatId;

      const userMessage: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [{ type: "text", text: message.text ?? "" }],
      };

      setLocalMessages((prev) => [...prev, userMessage]);
      setStatus("submitted");

      try {
        const body: ChatRequest =
          chatIdRef.current && runIdRef.current && !isNewChat
            ? {
                message: userMessage,
                followUp: {
                  chatId: newChatId,
                  messageIndex: assistantMessageCountRef.current,
                  userMessageIndex: messages.length,
                },
              }
            : {
                message: userMessage,
                model,
                newChatId,
              };

        const api =
          runIdRef.current && !isNewChat
            ? `/api/chat/${encodeURIComponent(runIdRef.current)}`
            : "/api/chat";

        const response = await fetch(api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        if (isNewChat) {
          router.push(`/${newChatId}`);
        }

        await processStream(response);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setStatus("error");
          console.error("sendMessage error:", error);
        }
      }
    },
    [model, processStream, router, messages.length]
  );

  const resumeStream = React.useCallback(async () => {
    if (
      !runIdRef.current ||
      chat?.streamingMessageIndex === null ||
      chat?.streamingMessageIndex === undefined
    ) {
      return;
    }

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setStatus("submitted");

    try {
      const url = new URL(
        `/api/chat/${encodeURIComponent(runIdRef.current)}`,
        window.location.origin
      );
      url.searchParams.set("messageIndex", String(chat.streamingMessageIndex));

      const response = await fetch(url, {
        method: "GET",
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          setStatus("ready");
          return;
        }
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      await processStream(response);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setStatus("error");
        console.error("resumeStream error:", error);
      }
    }
  }, [chat?.streamingMessageIndex, processStream]);

  React.useEffect(() => {
    // Only resume if there's actually a stream in progress
    if (
      chat?.id &&
      chat.streamingMessageIndex !== null &&
      !resumedStream.current
    ) {
      resumedStream.current = true;
      resumeStream();
    }
  }, [chat?.id, chat?.streamingMessageIndex, resumeStream]);

  const sendMessageRef = React.useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  React.useEffect(() => {
    if (status === "ready" && queuedMessagesRef.current.length > 0) {
      const queued = queuedMessagesRef.current;
      queuedMessagesRef.current = [];
      const mergedText = queued.map((m) => m.text).join("\n\n");
      const mergedFiles = queued.flatMap((m) => m.files ?? []);
      sendMessageRef.current({ text: mergedText, files: mergedFiles });
    }
  }, [status]);

  return { sendMessage, messages, status, resumeStream };
}
