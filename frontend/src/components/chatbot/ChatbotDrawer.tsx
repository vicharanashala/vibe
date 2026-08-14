import React, { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface ChatbotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatbotDrawer({ open, onOpenChange }: ChatbotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const messageText = overrideText || input.trim();
    if (!messageText || isLoading) return;

    if (!overrideText) {
      setInput("");
    }
    setError(null);

    const userMessage: Message = {
      id: Math.random().toString(),
      sender: "user",
      text: messageText,
      timestamp: new Date(),
    };

    if (!overrideText) {
      setMessages((prev) => [...prev, userMessage]);
    }
    setIsLoading(true);

    try {
      const response = await apiClient.post<{ response: string }>("/chatbot/query", {
        question: messageText,
      });

      const assistantMessage: Message = {
        id: Math.random().toString(),
        sender: "assistant",
        text: response.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chatbot query failed:", err);
      setError(err.message || "Failed to retrieve response from AI assistant. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex h-full w-full flex-col p-0 sm:max-w-md bg-white dark:bg-[#151517] border-l dark:border-zinc-800">
        <SheetHeader className="border-b p-4 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-100 text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100">
              <Bot className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Vibe Bot</SheetTitle>
              <SheetDescription className="text-xs text-zinc-500 dark:text-zinc-400 font-normal">Ask questions about courses or any topic</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {/* Message Panel */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full p-4">
            <div className="flex flex-col gap-4">
              {messages.length === 0 ? (
                // Empty State
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-4">
                    <Bot className="size-6" />
                  </div>
                  <h3 className="font-semibold text-zinc-950 dark:text-zinc-50 text-sm mb-1">Welcome to Vibe Bot!</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-[280px] mb-6">
                    Ask me any questions about course materials, video lessons, or general topics.
                  </p>
                  
                  {/* Quick Prompts */}
                  <div className="flex flex-col gap-2 w-full max-w-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt("What courses are available to learn?")}
                      className="text-left text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      "What courses are available to learn?"
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPrompt("How can Vibe help me with my learning journey?")}
                      className="text-left text-xs p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                    >
                      "How can Vibe help me with my learning journey?"
                    </button>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex flex-col gap-1 max-w-[85%] ${
                      message.sender === "user" ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                        message.sender === "user"
                          ? "bg-yellow-100 text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-100 rounded-tr-none"
                          : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 rounded-tl-none"
                      }`}
                    >
                      {message.text}
                    </div>
                    <span className="text-[9px] text-zinc-400 px-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex flex-col gap-1 max-w-[85%] self-start items-start">
                  <div className="rounded-2xl rounded-tl-none bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 px-3 py-2 text-xs">
                    <span className="flex gap-1 items-center">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
              )}

              {/* Error state */}
              {error && (
                <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 text-red-800 dark:text-red-300">
                  <AlertCircle className="size-4 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1 text-xs">
                    <p>{error}</p>
                    <button
                      type="button"
                      onClick={() => {
                        const lastUserMsg = messages.filter((m) => m.sender === "user").slice(-1)[0]?.text;
                        if (lastUserMsg) handleSend(undefined, lastUserMsg);
                      }}
                      className="text-left font-semibold underline text-[10px] hover:text-red-700 dark:hover:text-red-200 cursor-pointer"
                    >
                      Retry sending
                    </button>
                  </div>
                </div>
              )}
              
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="border-t p-4 dark:border-zinc-800 bg-white dark:bg-[#151517]">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={isLoading}
              className="flex-1"
              maxLength={1000}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send question"
              disabled={!input.trim() || isLoading}
              className="bg-yellow-100 hover:bg-yellow-200 text-yellow-900 border border-yellow-200 dark:bg-yellow-400/10 dark:hover:bg-yellow-400/20 dark:text-yellow-100 dark:border-yellow-400/20 shadow-none size-9 shrink-0 flex items-center justify-center rounded-md cursor-pointer"
            >
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
