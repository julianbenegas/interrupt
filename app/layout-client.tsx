"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  PlusIcon,
  ChevronUpIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Random username generator
const adjectives = [
  "Swift",
  "Clever",
  "Bright",
  "Silent",
  "Cosmic",
  "Mystic",
  "Noble",
  "Wandering",
  "Golden",
  "Crystal",
];
const nouns = [
  "Fox",
  "Owl",
  "Wolf",
  "Hawk",
  "Raven",
  "Phoenix",
  "Dragon",
  "Tiger",
  "Falcon",
  "Panther",
];

function generateUsername(): string {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${adj}${noun}${num}`;
}

function getUsername(): string {
  if (typeof window === "undefined") return "";
  let username = sessionStorage.getItem("chat:username");
  if (!username) {
    username = generateUsername();
    sessionStorage.setItem("chat:username", username);
  }
  return username;
}

type ChatHistoryEntry = { id: string; title: string; createdAt: number };

const MOCK_CHATS: ChatHistoryEntry[] = [
  { id: "demo-1", title: "Help me write a Python script", createdAt: Date.now() - 3600000 },
  { id: "demo-2", title: "Explain quantum computing", createdAt: Date.now() - 7200000 },
  { id: "demo-3", title: "Recipe for chocolate cake", createdAt: Date.now() - 86400000 },
];

function getChatHistory(): ChatHistoryEntry[] {
  if (typeof window === "undefined") return MOCK_CHATS;
  const data = sessionStorage.getItem("chat:history");
  if (!data) return MOCK_CHATS;
  try {
    const stored = JSON.parse(data);
    // Merge stored with mock chats, avoiding duplicates
    const ids = new Set(stored.map((c: ChatHistoryEntry) => c.id));
    const merged = [...stored, ...MOCK_CHATS.filter(m => !ids.has(m.id))];
    return merged;
  } catch {
    return MOCK_CHATS;
  }
}

const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;

function getSidebarWidth(): number {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
  const stored = localStorage.getItem("sidebar:width");
  if (stored) {
    const width = parseInt(stored, 10);
    if (
      !isNaN(width) &&
      width >= MIN_SIDEBAR_WIDTH &&
      width <= MAX_SIDEBAR_WIDTH
    ) {
      return width;
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

function getSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("sidebar:collapsed") === "true";
}

export function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = React.useState("");
  const [chatHistory, setChatHistory] = React.useState<ChatHistoryEntry[]>([]);
  const [sidebarWidth, setSidebarWidth] = React.useState(DEFAULT_SIDEBAR_WIDTH);
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStartRef = React.useRef<{ mouseX: number; width: number } | null>(
    null
  );

  React.useEffect(() => {
    setUsername(getUsername());
    setChatHistory(getChatHistory());
    setSidebarWidth(getSidebarWidth());
    setIsCollapsed(getSidebarCollapsed());

    const handleStorageChange = () => setChatHistory(getChatHistory());
    window.addEventListener("chat-history-updated", handleStorageChange);
    return () =>
      window.removeEventListener("chat-history-updated", handleStorageChange);
  }, []);

  React.useEffect(() => {
    setChatHistory(getChatHistory());
  }, [pathname]);

  // Handle resize
  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeStartRef.current = { mouseX: e.clientX, width: sidebarWidth };
      setIsResizing(true);
    },
    [sidebarWidth]
  );

  React.useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;
      const delta = e.clientX - resizeStartRef.current.mouseX;
      const newWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, resizeStartRef.current.width + delta)
      );
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (resizeStartRef.current) {
        localStorage.setItem("sidebar:width", String(sidebarWidth));
      }
      resizeStartRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  const toggleCollapse = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar:collapsed", String(next));
      return next;
    });
  }, []);

  // Keyboard shortcut: Cmd+/ (Mac) or Ctrl+/ (Windows/Linux) to toggle sidebar
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  const currentChatId = pathname.startsWith("/chat/")
    ? pathname.slice(6)
    : null;

  return (
    <div className="flex h-screen w-full overflow-hidden relative">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex h-full flex-col border-r border-sidebar-border bg-sidebar shrink-0 overflow-hidden transition-[width] duration-200",
          isResizing && "transition-none"
        )}
        style={{ width: isCollapsed ? 0 : sidebarWidth }}
      >
        <div className="flex flex-col h-full" style={{ width: sidebarWidth }}>
          {/* Header with logo and new button */}
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-sidebar-foreground">
              Interrupt
            </h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => router.push("/")}
                title="New chat"
              >
                <PlusIcon className="size-5" />
              </Button>
            </div>
          </div>

          {/* Chat history */}
          <ScrollArea className="flex-1 px-2">
            {chatHistory.length === 0 ? (
              <div className="px-2 pb-8 text-left text-sm text-sidebar-foreground/50">
                No conversations yet
              </div>
            ) : (
              <div className="space-y-0.5 py-2">
                {chatHistory.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      currentChatId === chat.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-sidebar-foreground"
                    )}
                  >
                    <span className="truncate">{chat.title || "New chat"}</span>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* User profile at bottom */}
          <div className="mt-auto border-t border-sidebar-border">
            <button
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sidebar-accent transition-colors"
              onClick={() => {}}
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400">
                <span className="text-xs font-medium text-white">
                  {username.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="flex-1 truncate text-sm text-sidebar-foreground">
                {username || "Guest"}
              </span>
              <ChevronUpIcon className="size-4 text-sidebar-foreground/50" />
            </button>
          </div>
        </div>
      </aside>

      {/* Resize handle - outside sidebar to avoid clipping */}
      {!isCollapsed && (
        <div
          className={cn(
            "absolute top-0 bottom-0 w-2 cursor-col-resize z-20 -translate-x-1/2",
            "hover:bg-primary/20 transition-colors",
            isResizing && "bg-primary/30"
          )}
          style={{ left: sidebarWidth }}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-hidden relative">
        {/* Collapse toggle button - positioned in main content area */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapse}
          className="absolute z-10 top-3 left-3 size-8 text-foreground/70 hover:text-foreground hover:bg-accent"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeftOpenIcon className="size-5" />
          ) : (
            <PanelLeftCloseIcon className="size-5" />
          )}
        </Button>
        {children}
      </main>
    </div>
  );
}
