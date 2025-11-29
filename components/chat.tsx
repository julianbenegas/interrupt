"use client";
import * as React from "react";
import { WorkflowChatTransport } from "@workflow/ai";
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
import { UIMessage, useChat } from "@ai-sdk/react";
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
import { nanoid } from "nanoid";
import { FilePart } from "ai";

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export const Chat = ({ chat }: { chat?: StoredChatClient }) => {
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState<string>(models[0].value);
  const { sendMessages, messages, status } = useDurableChat({
    chat,
    model,
  });

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    const ogInput = input;
    try {
      setInput("");
      await sendMessages([
        {
          parts: [
            { type: "text", text: message.text || "Sent with attachments" },
            ...message.files.map(
              (file) => ({ ...file, data: file.url } satisfies FilePart)
            ),
          ],
        },
      ]);
    } catch {
      setInput(ogInput);
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

function useDurableChat({
  chat,
  model,
}: {
  chat?: StoredChatClient;
  model: string;
}) {
  const router = useRouter();
  const [resumed, setResumed] = React.useState(false);
  const [queue, setQueue] = React.useState<
    Array<Omit<UIMessage, "id" | "role">>
  >([]);
  const toSendRef = React.useRef<Array<UIMessage>>([]);

  const existingChatId = chat?.id;
  const api = existingChatId ? `/api/chat/${existingChatId}` : "/api/chat";

  const {
    messages: streamMessages,
    resumeStream,
    sendMessage: sendMessageRaw,
    status,
    id: chatId,
    setMessages,
  } = useChat({
    id: existingChatId,
    // eslint-disable-next-line react-hooks/refs
    transport: new WorkflowChatTransport({
      api,
      prepareSendMessagesRequest: (config) => {
        const newMessages = toSendRef.current;
        toSendRef.current = [];
        return {
          ...config,
          body: existingChatId
            ? { messages: newMessages, model }
            : ({
                model,
                messages: newMessages,
                newChatId: config.id,
              } satisfies ChatRequest),
        };
      },
      prepareReconnectToStreamRequest: (config) => ({ ...config, api }),
      onChatSendMessage: () => {
        if (!existingChatId) {
          router.push(`/chat/${chatId}`);
        }
      },
      maxConsecutiveErrors: 5,
    }),
  });

  React.useEffect(() => {
    if (chat?.streamId && !resumed && status === "ready") {
      console.log({ status });
      setResumed(true);
      resumeStream();
    }
  }, [chat?.streamId, resumeStream, resumed, status]);

  const messages = React.useMemo(() => {
    return [...(chat?.messages ?? []), ...streamMessages];
  }, [chat?.messages, streamMessages]);

  const sendMessages = React.useCallback(
    async (newMessages: Array<Omit<UIMessage, "id" | "role">>) => {
      if (status === "ready") {
        toSendRef.current = [
          ...toSendRef.current,
          ...newMessages.map(
            (m) =>
              ({
                ...m,
                id: nanoid(),
                role: "user",
              } as const)
          ),
        ];
        setMessages((prev) => [...prev, ...toSendRef.current]);
        await sendMessageRaw();
        return;
      }
      if (!existingChatId) throw new Error("Expected chat to be defined");
      setQueue((curr) => [...curr, ...newMessages]);
      await fetch(`/api/chat/${existingChatId}/interrupt`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    [existingChatId, sendMessageRaw, status, setMessages]
  );

  React.useEffect(() => {
    if (status === "ready" && queue.length > 0) {
      sendMessages(queue).catch(() => {
        setQueue((curr) => [...queue, ...curr]);
      });
      setQueue([]);
    }
  }, [sendMessages, status, queue]);

  return { sendMessages, messages, queue, status };
}
