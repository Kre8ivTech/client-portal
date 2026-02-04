"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, X, Send, Minimize2, Maximize2, Loader2, Sparkles, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  isError?: boolean;
}

interface AIChatbotWidgetProps {
  userId?: string;
  organizationId?: string;
}

export function AIChatbotWidget({ userId, organizationId }: AIChatbotWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && userId && !conversationId && !initError) {
      initializeConversation();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const initializeConversation = async () => {
    if (!userId) {
      setInitError("Please sign in to use the AI assistant.");
      return;
    }

    try {
      // Use null for organization_id if not provided (will use global config)
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: userId,
          organization_id: organizationId || null,
          title: "New Conversation",
          metadata: { started_at: new Date().toISOString() },
        })
        .select()
        .single();

      if (error) {
        // Check if it's a table missing error
        if (error.code === "PGRST205" || error.message?.includes("does not exist")) {
          setInitError("AI assistant is being set up. Please try again later.");
          return;
        }
        throw error;
      }

      setConversationId(data.id);

      const welcomeMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "Hello! I'm your AI assistant. I can help you with questions about your projects, services, invoices, contracts, and more. How can I help you today?",
        created_at: new Date().toISOString(),
      };
      setMessages([welcomeMessage]);
    } catch (error: any) {
      console.error("Failed to initialize conversation:", error);
      setInitError("Unable to start conversation. Please try again.");
    }
  };

  const resetConversation = () => {
    setConversationId(null);
    setMessages([]);
    setInitError(null);
    initializeConversation();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading || !conversationId) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      // Save user message
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userMessage.content,
      });

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: userMessage.content,
          organization_id: organizationId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get AI response");
      }

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Save assistant message
      await supabase.from("ai_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: assistantMessage.content,
      });
    } catch (error: any) {
      console.error("Failed to send message:", error);

      let errorContent = "Sorry, I encountered an error. Please try again.";

      if (error.message?.includes("unavailable") || error.message?.includes("providers failed")) {
        errorContent =
          "The AI service is currently unavailable. Please try again later or contact support if the issue persists.";
      }

      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: errorContent,
        created_at: new Date().toISOString(),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Show the chat button even without organization (will use global config)
  if (!userId) {
    return null;
  }

  return (
    <>
      {isOpen ? (
        <Card
          className={cn(
            "fixed bottom-6 right-6 w-[380px] md:w-[420px] shadow-2xl border-2 z-50 transition-all duration-200",
            isMinimized ? "h-[60px]" : "h-[550px] md:h-[600px]",
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 md:p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-sm">
                <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-white" />
              </div>
              <span className="font-semibold">AI Assistant</span>
            </CardTitle>
            <div className="flex gap-1">
              {conversationId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={resetConversation}
                  title="New conversation"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsMinimized(!isMinimized)}>
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          {!isMinimized && (
            <CardContent className="p-0 flex flex-col h-[calc(100%-60px)]">
              {initError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <AlertCircle className="h-12 w-12 text-amber-500 mb-4" />
                  <p className="text-muted-foreground mb-4">{initError}</p>
                  <Button onClick={resetConversation} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              ) : (
                <>
                  <ScrollArea ref={scrollRef} className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <div
                          key={message.id}
                          className={cn("flex gap-2", message.role === "user" ? "justify-end" : "justify-start")}
                        >
                          {message.role === "assistant" && (
                            <div
                              className={cn(
                                "p-1.5 rounded-full h-fit",
                                message.isError ? "bg-amber-100" : "bg-gradient-to-br from-blue-100 to-purple-100",
                              )}
                            >
                              {message.isError ? (
                                <AlertCircle className="h-4 w-4 text-amber-600" />
                              ) : (
                                <Bot className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                          )}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5 max-w-[85%]",
                              message.role === "user"
                                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white"
                                : message.isError
                                  ? "bg-amber-50 border border-amber-200"
                                  : "bg-muted",
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                            <p
                              className={cn(
                                "text-[10px] mt-1.5",
                                message.role === "user" ? "text-blue-100" : "text-muted-foreground",
                              )}
                            >
                              {format(new Date(message.created_at), "h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                      {loading && (
                        <div className="flex gap-2 justify-start">
                          <div className="p-1.5 rounded-full bg-gradient-to-br from-blue-100 to-purple-100">
                            <Bot className="h-4 w-4 text-blue-600" />
                          </div>
                          <div className="rounded-2xl px-4 py-3 bg-muted">
                            <div className="flex gap-1">
                              <span
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              ></span>
                              <span
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: "150ms" }}
                              ></span>
                              <span
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: "300ms" }}
                              ></span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="p-3 md:p-4 border-t bg-muted/30">
                    <div className="flex gap-2">
                      <Input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask me anything..."
                        disabled={loading || !conversationId}
                        className="flex-1 bg-background"
                      />
                      <Button
                        size="icon"
                        onClick={sendMessage}
                        disabled={loading || !input.trim() || !conversationId}
                        className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground text-center mt-2">
                      AI may make mistakes. Verify important information.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      ) : (
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 p-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 hover:scale-105 transition-all"
          onClick={() => setIsOpen(true)}
        >
          <Sparkles className="h-6 w-6" />
        </Button>
      )}
    </>
  );
}
