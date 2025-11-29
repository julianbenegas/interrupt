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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { UIMessage, useChat } from "@ai-sdk/react";
import { CopyIcon, XIcon, ChevronDownIcon } from "lucide-react";
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
import { usePathname, useRouter } from "next/navigation";
import { ChatRequest } from "@/app/chat/[chatId]/api/route";
import { models } from "@/lib/models";
import { nanoid } from "nanoid";
import { FilePart } from "ai";
import { cn } from "@/lib/utils";

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export const Chat = ({ chat }: { chat?: StoredChatClient }) => {
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState<string>(models[0].value);
  const { sendMessages, messages, status, queue, removeFromQueue } =
    useDurableChat({ chat, model });
  const promptInputContainerRef = React.useRef<HTMLDivElement>(null);
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

  React.useEffect(() => {
    const regularCharacterRegex = /^[a-zA-Z0-9]$/;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (regularCharacterRegex.test(e.key)) {
        const textarea =
          promptInputContainerRef.current?.querySelector("textarea");
        if (textarea && document.activeElement !== textarea) {
          textarea.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="relative size-full h-screen">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            <Container className="pb-64 space-y-8">
              {/* Empty state */}
              {messages.length === 0 && status === "ready" && (
                <div className="flex flex-col items-start justify-center pt-16 px-4">
                  <h1 className="text-2xl font-semibold text-foreground">
                    Hello there!
                  </h1>
                  <p className="text-xl text-muted-foreground">
                    How can I help you today?
                  </p>
                </div>
              )}
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
                          <Message
                            key={`${message.id}-${i}`}
                            from={message.role}
                          >
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
                            <pre className="text-xs text-muted-foreground font-mono overflow-auto">
                              <code>{JSON.stringify(part, null, 2)}</code>
                            </pre>
                          </div>
                        );
                    }
                  })}
                </div>
              ))}
              {status === "submitted" && (
                <div className="flex justify-center items-center py-8">
                  <Loader />
                </div>
              )}
            </Container>
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <Container>
          <div
            className="absolute bottom-2 left-0 right-0"
            ref={promptInputContainerRef}
          >
            {/* Queued Messages UI */}
            {queue.length > 0 && (
              <Collapsible
                defaultOpen
                className="border-t border-border bg-background -mb-4 pb-4"
              >
                <CollapsibleTrigger className="flex w-full items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronDownIcon className="size-3 transition-transform [[data-state=closed]_&]:-rotate-90" />
                  <span>Queued ({queue.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-2 space-y-1">
                    {queue.map((item, index) => {
                      const textPart = item.parts.find(
                        (p) => p.type === "text"
                      );
                      const text =
                        textPart && "text" in textPart ? textPart.text : "";
                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-xs text-muted-foreground group"
                        >
                          <span className="flex-1 truncate">
                            {text || "Attachment"}
                          </span>
                          <button
                            onClick={() => removeFromQueue(index)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-foreground transition-opacity"
                            aria-label="Remove from queue"
                          >
                            <XIcon className="size-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <PromptInput
              onSubmit={handleSubmit}
              className="w-full"
              onClick={(e) => {
                if (
                  e.target instanceof HTMLElement &&
                  e.target.tagName === "TEXTAREA"
                ) {
                  return;
                }
                e.currentTarget.querySelector("textarea")?.focus();
              }}
              globalDrop
              multiple
            >
              <PromptInputHeader className="p-0">
                <PromptInputAttachments>
                  {(attachment) => <PromptInputAttachment data={attachment} />}
                </PromptInputAttachments>
              </PromptInputHeader>
              <PromptInputBody>
                <PromptInputTextarea
                  onChange={(e) => setInput(e.target.value)}
                  value={input}
                  placeholder="Just chat..."
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
        </Container>
      </div>
    </div>
  );
};

const Container = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <div className={cn("max-w-4xl mx-auto w-full relative", className)}>
      {children}
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
  const resumedRef = React.useRef(false);
  const [queue, setQueue] = React.useState<
    Array<Omit<UIMessage, "id" | "role">>
  >([]);
  const toSendRef = React.useRef<Array<UIMessage>>([]);
  const [chatId, setChatId] = React.useState(() => chat?.id || nanoid());
  const router = useRouter();
  const isNewChat = !chat?.id;
  const pathname = usePathname();
  const [softNavigateToNewChat, setSoftNavigateToNewChat] =
    React.useState(false);

  const {
    messages: streamMessages,
    resumeStream,
    sendMessage: sendMessageRaw,
    status,
    setMessages,
  } = useChat({
    id: chatId,
    // eslint-disable-next-line react-hooks/refs
    transport: new WorkflowChatTransport({
      prepareSendMessagesRequest: (config) => {
        const newMessages = toSendRef.current;
        toSendRef.current = [];
        return {
          ...config,
          api: `/chat/${config.id}/api`,
          body: {
            model,
            messages: newMessages,
          } satisfies ChatRequest,
        };
      },
      prepareReconnectToStreamRequest: (config) => ({
        ...config,
        api: `/chat/${config.id}/api`,
      }),
      onChatSendMessage: () => {
        if (isNewChat) {
          setSoftNavigateToNewChat(true);
        }
      },
      maxConsecutiveErrors: 5,
    }),
  });

  React.useEffect(() => {
    if (
      softNavigateToNewChat &&
      window.location.pathname !== `/chat/${chatId}`
    ) {
      window.history.pushState(null, "", `/chat/${chatId}`);
    }
  }, [softNavigateToNewChat, chatId]);

  React.useEffect(() => {
    const realPathname = window.location.pathname;
    if (softNavigateToNewChat) {
      if (realPathname !== `/chat/${chatId}`) {
        setChatId(nanoid());
        setSoftNavigateToNewChat(false);
      }
    } else {
      if (realPathname !== `/chat/${chatId}` && pathname.startsWith("/chat/")) {
        const actualChatId = realPathname.split("/")[2];
        if (actualChatId) {
          router.refresh();
        }
      }
    }
  }, [chatId, pathname, softNavigateToNewChat, router]);

  React.useEffect(() => {
    if (chat?.streamId && !resumedRef.current && status === "ready") {
      resumedRef.current = true;
      resumeStream();
    }
  }, [chat?.streamId, resumeStream, status]);

  const messages = React.useMemo(() => {
    return [...(chat?.messages ?? []), ...streamMessages];
  }, [chat?.messages, streamMessages]);

  const sendMessages = React.useCallback(
    async (newMessages: Array<Omit<UIMessage, "id" | "role">>) => {
      if (status === "ready") {
        toSendRef.current = [
          ...toSendRef.current,
          ...newMessages.map(
            (m) => ({ ...m, id: nanoid(), role: "user" } as const)
          ),
        ];
        setMessages((prev) => [...prev, ...toSendRef.current]);
        await sendMessageRaw();
        return;
      }
      setQueue((curr) => [...curr, ...newMessages]);
      await fetch(`/chat/${chatId}/api/interrupt`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    [chatId, sendMessageRaw, status, setMessages]
  );

  const removeFromQueue = React.useCallback((index: number) => {
    setQueue((curr) => curr.filter((_, i) => i !== index));
  }, []);

  React.useEffect(() => {
    if (status === "ready" && queue.length > 0) {
      sendMessages(queue).catch(() => {
        setQueue((curr) => [...queue, ...curr]);
      });
      setQueue([]);
    }
  }, [sendMessages, status, queue]);

  return { sendMessages, messages, queue, status, removeFromQueue };
}
