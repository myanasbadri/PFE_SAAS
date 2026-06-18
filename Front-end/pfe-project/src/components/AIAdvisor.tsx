"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  PieChart,
  DollarSign,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  Zap,
  MessageSquare,
  ShieldCheck,
  BrainCircuit,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { advisorChat, type ChatMessage } from "../lib/api";

// ── Types ──────────────────────────────────────────────────────────────────

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  model?: string;
  error?: boolean;
}

// ── Suggested Questions ────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  {
    icon: <TrendingUp className="h-4 w-4" />,
    labelKey: "spendingTrends",
    questionKey: "spendingTrendsQ",
  },
  {
    icon: <PieChart className="h-4 w-4" />,
    labelKey: "topVendors",
    questionKey: "topVendorsQ",
  },
  {
    icon: <DollarSign className="h-4 w-4" />,
    labelKey: "costOptimization",
    questionKey: "costOptimizationQ",
  },
  {
    icon: <AlertTriangle className="h-4 w-4" />,
    labelKey: "reviewNeeded",
    questionKey: "reviewNeededQ",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    labelKey: "monthlySummary",
    questionKey: "monthlySummaryQ",
  },
  {
    icon: <ShieldCheck className="h-4 w-4" />,
    labelKey: "financialHealth",
    questionKey: "financialHealthQ",
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export const AIAdvisor = () => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(
    async (text?: string) => {
      const msg = (text || inputMessage).trim();
      if (!msg || isTyping) return;

      setInputMessage("");

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: msg,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const res = await advisorChat(msg, chatHistory);

        const aiMsg: DisplayMessage = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: res.reply,
          timestamp: new Date(),
          model: res.model,
        };
        setMessages((prev) => [...prev, aiMsg]);

        setChatHistory((prev) => [
          ...prev,
          { role: "user", content: msg },
          { role: "assistant", content: res.reply },
        ]);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to get response";
        const errMsg: DisplayMessage = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `Sorry, I couldn't process your request. ${errorMessage}`,
          timestamp: new Date(),
          error: true,
        };
        setMessages((prev) => [...prev, errMsg]);
      } finally {
        setIsTyping(false);
        inputRef.current?.focus();
      }
    },
    [inputMessage, isTyping, chatHistory],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setChatHistory([]);
    inputRef.current?.focus();
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-h-[calc(100vh-8rem)]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-gradient-to-r from-[#0A2540] to-[#0F3460] rounded-t-xl px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-white font-semibold text-lg">
                  {t("aiAdvisor")}
                </h1>
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]" />
                </span>
              </div>
              <p className="text-white/50 text-xs">
                {t("poweredByAI")}
              </p>
            </div>
          </div>
          {hasMessages && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-white/60 hover:text-white hover:bg-card/10 gap-1.5 text-xs rounded-lg"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t("newChat")}
            </Button>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 bg-gradient-to-b from-muted/20 to-background border-x border-border overflow-y-auto">
        {!hasMessages ? (
          /* ── Welcome Screen ─────────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center h-full p-6 sm:p-10">
            {/* Hero */}
            <div className="text-center space-y-3 mb-8">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center shadow-xl shadow-emerald-200/50">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground">
                {t("aiFinancialAdvisor")}
              </h2>
              <p className="text-muted-foreground max-w-lg text-sm leading-relaxed">
                {t("aiAdvisorDesc")}
              </p>
            </div>

            {/* Suggested Questions */}
            <div className="w-full max-w-2xl mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 text-center">
                {t("tryAskingAbout")}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {SUGGESTED_QUESTIONS.map((sq, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(t(sq.questionKey))}
                    className="group flex items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card hover:border-[#10B981]/40 hover:shadow-md hover:shadow-emerald-100/50 transition-all duration-200 text-left"
                  >
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#10B981]/10 to-[#059669]/10 group-hover:from-[#10B981]/20 group-hover:to-[#059669]/20 flex items-center justify-center flex-shrink-0 text-[#10B981] transition-colors">
                      {sq.icon}
                    </div>
                    <span className="text-sm font-medium text-foreground group-hover:text-[#10B981] transition-colors">
                      {t(sq.labelKey)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Capability badges */}
            <div className="flex flex-wrap gap-2 justify-center">
              <Badge
                variant="secondary"
                className="gap-1.5 text-xs px-3 py-1 rounded-full"
              >
                <Zap className="h-3 w-3 text-amber-500" /> {t("realTimeAnalysis")}
              </Badge>
              <Badge
                variant="secondary"
                className="gap-1.5 text-xs px-3 py-1 rounded-full"
              >
                <MessageSquare className="h-3 w-3 text-blue-500" /> {t("multiTurnChat")}
              </Badge>
              <Badge
                variant="secondary"
                className="gap-1.5 text-xs px-3 py-1 rounded-full"
              >
                <ShieldCheck className="h-3 w-3 text-emerald-500" /> {t("yourDataOnly")}
              </Badge>
            </div>
          </div>
        ) : (
          /* ── Chat Messages ──────────────────────────────────────────── */
          <div className="p-4 sm:p-6 space-y-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {/* Avatar for AI */}
                {message.role === "assistant" && (
                  <div
                    className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mr-3 mt-1 ${
                      message.error
                        ? "bg-red-100"
                        : "bg-gradient-to-br from-[#10B981] to-[#059669]"
                    }`}
                  >
                    <Bot
                      className={`h-4 w-4 ${message.error ? "text-red-500" : "text-white"}`}
                    />
                  </div>
                )}

                <div
                  className={`max-w-[80%] ${
                    message.role === "user"
                      ? "bg-[#0A2540] text-white rounded-2xl rounded-br-sm px-4 py-3"
                      : message.error
                        ? "bg-red-50 border border-red-200 rounded-2xl rounded-bl-sm px-4 py-3"
                        : "bg-card border border-border/60 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3"
                  }`}
                >
                  {/* Model badge for AI */}
                  {message.role === "assistant" && message.model && (
                    <div className="mb-1.5">
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 font-normal text-muted-foreground"
                      >
                        {message.model}
                      </Badge>
                    </div>
                  )}

                  {/* Content */}
                  {message.role === "assistant" ? (
                    <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-foreground prose-strong:text-foreground dark:prose-invert prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-foreground dark:prose-code:text-foreground prose-code:text-xs">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {message.content}
                    </p>
                  )}

                  {/* Timestamp */}
                  <p
                    className={`text-[10px] mt-2 ${
                      message.role === "user"
                        ? "text-white/30"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                {/* Avatar for User */}
                {message.role === "user" && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-[#0A2540] flex items-center justify-center ml-3 mt-1">
                    <User className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center mr-3 mt-1">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-card border border-border/60 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground">
                      {t("analyzingData")}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 py-0.5">
                    <div className="h-2 w-2 bg-[#10B981] rounded-full animate-bounce" />
                    <div
                      className="h-2 w-2 bg-[#10B981] rounded-full animate-bounce"
                      style={{ animationDelay: "0.15s" }}
                    />
                    <div
                      className="h-2 w-2 bg-[#10B981] rounded-full animate-bounce"
                      style={{ animationDelay: "0.3s" }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Quick Suggestions (in-conversation) ─────────────────────────── */}
      {hasMessages && !isTyping && (
        <div className="flex-shrink-0 border-x border-border bg-card px-4 py-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
            {SUGGESTED_QUESTIONS.map((sq, i) => (
              <button
                key={i}
                onClick={() => sendMessage(t(sq.questionKey))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-[#10B981]/10 hover:border-[#10B981]/30 transition-colors text-xs text-muted-foreground hover:text-foreground whitespace-nowrap flex-shrink-0"
              >
                {sq.icon}
                {t(sq.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input Bar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border border-border bg-card rounded-b-xl p-4">
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              placeholder={t("askAI")}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              className="pr-4 h-11 bg-muted/50 border-border focus-visible:ring-[#10B981]/30 focus-visible:border-[#10B981] rounded-xl text-sm"
            />
          </div>
          <Button
            onClick={() => sendMessage()}
            className="bg-[#10B981] hover:bg-[#059669] text-white h-11 w-11 rounded-xl transition-colors shadow-sm shadow-emerald-200/50"
            disabled={!inputMessage.trim() || isTyping}
            size="icon"
          >
            {isTyping ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
          {t("aiResponseNote")}
        </p>
      </div>
    </div>
  );
};
