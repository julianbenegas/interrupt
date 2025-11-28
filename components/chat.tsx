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
import { useChat } from "@ai-sdk/react";
import { CopyIcon, RefreshCcwIcon } from "lucide-react";
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
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { ChatRequest } from "@/app/api/chat/route";
import { models } from "@/lib/models";

export const Chat = ({ chat }: { chat?: StoredChatClient }) => {
  const [input, setInput] = React.useState("");
  const [model, setModel] = React.useState<string>(models[0].value);
  const router = useRouter();
  const { sendMessage, regenerate, messages, status } = useDurableChat({
    chat,
    model,
  });

  const handleSubmit = async (message: PromptInputMessage) => {
    const hasText = Boolean(message.text);
    const hasAttachments = Boolean(message.files?.length);
    if (!(hasText || hasAttachments)) {
      return;
    }
    const newChatId = chat ? undefined : nanoid();
    await sendMessage(
      { text: message.text || "Sent with attachments", files: message.files },
      chat
        ? {
            body: { followUp: { chatId: chat.id } } satisfies Omit<
              ChatRequest,
              "message"
            >,
          }
        : { body: { model, newChatId } satisfies Omit<ChatRequest, "message"> }
    );
    setInput("");
    if (!chat) {
      router.push(`/${newChatId}`);
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
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </MessageAction>
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
                      return null;
                  }
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
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
            <PromptInputSubmit disabled={!input && !status} status={status} />
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
  const [chunkCount, setChunkCount] = React.useState(0);

  const { sendMessage, regenerate, messages, status } = useChat({
    id: chat?.id,
    transport: new WorkflowChatTransport({
      api: chat ? `/api/chat/${encodeURIComponent(chat.runId)}` : "/api/chat",
      prepareSendMessagesRequest: (config) => {
        console.log("prepareSendMessagesRequest", config);
        const message = config.messages.at(-1);
        if (!message) {
          throw new Error("No message provided");
        }
        if (message.role !== "user") {
          throw new Error("Last message must be a user message");
        }
        return {
          ...config,
          body: (chat
            ? { message, followUp: { chatId: chat.id } }
            : { message, model, newChatId: nanoid() }) satisfies ChatRequest,
        };
      },
      prepareReconnectToStreamRequest: (config) => ({
        ...config,
        api: chat ? `/api/chat/${encodeURIComponent(chat.runId)}` : "/api/chat",
      }),
      onChatEnd: ({ chunkIndex }) => {
        setChunkCount((prev) => prev + chunkIndex);
        // setIsInterrupting(false);
      },
      maxConsecutiveErrors: 5,
    }),
  });

  return { sendMessage, regenerate, messages, status };
}
