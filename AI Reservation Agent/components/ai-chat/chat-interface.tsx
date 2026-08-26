"use client";

import { useState, useRef, useEffect } from "react";
import { useActionState } from "react";
import {
  sendMessageAction,
  staffReplyAction,
  takeOverAction,
  releaseToAiAction,
} from "@/app/(dashboard)/dashboard/ai-chat/actions";
import type { ActionResult } from "@/app/(dashboard)/dashboard/ai-chat/actions";

type ChatToolCall = {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  success: boolean;
};

type Message = {
  id: string;
  sender: "CUSTOMER" | "AI" | "STAFF";
  content: string;
  language?: string | null;
  metadata?: { toolCalls?: ChatToolCall[] } | null;
  createdAt: string;
};

const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20";

const L = {
  en: {
    placeholder: "Type a message...",
    send: "Send",
    takeOver: "Take Over",
    release: "Release to AI",
    staffReply: "Reply as staff",
    conversations: "Conversations",
    noConversations: "No conversations yet",
    handoverRequested: "Handover requested",
    toolCall: "Tool call",
    loading: "AI is thinking...",
    newChat: "New Chat",
    status: { AI_HANDLING: "AI", HUMAN_HANDLING: "Staff", NEEDS_ATTENTION: "Needs Attention", CLOSED: "Closed" },
  },
  ar: {
    placeholder: "اكتب رسالة...",
    send: "إرسال",
    takeOver: "تولى المحادثة",
    release: "إعادة للذكاء الاصطناعي",
    staffReply: "رد كموظف",
    conversations: "المحادثات",
    noConversations: "لا توجد محادثات بعد",
    handoverRequested: "تم طلب التحويل",
    toolCall: "استدعاء أداة",
    loading: "الذكاء الاصطناعي يفكر...",
    newChat: "محادثة جديدة",
    status: { AI_HANDLING: "ذكاء اصطناعي", HUMAN_HANDLING: "موظف", NEEDS_ATTENTION: "يحتاج انتباه", CLOSED: "مغلق" },
  },
};

function ToolCallDisplay({ toolCall }: { toolCall: ChatToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const toolNameMap: Record<string, string> = {
    check_availability: "Checked availability",
    calculate_price: "Calculated price",
    create_reservation: "Created reservation",
    get_reservation: "Looked up reservation",
    modify_reservation: "Modified reservation",
    cancel_reservation: "Cancelled reservation",
    handover_to_staff: "Handing over to staff",
  };

  const label = toolNameMap[toolCall.toolName] ?? toolCall.toolName;

  return (
    <div className="my-1 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 text-left text-stone-600 hover:text-stone-800"
      >
        <span>{toolCall.success ? "✓" : "✗"}</span>
        <span className="font-medium">{label}</span>
        <span className="ml-auto text-stone-400">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded ? (
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-stone-500">
          {JSON.stringify({ args: toolCall.args, result: toolCall.result }, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.sender === "CUSTOMER" || msg.sender === "STAFF";
  const senderLabel = msg.sender === "STAFF" ? " [Staff]" : "";
  const toolCalls = msg.metadata?.toolCalls;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-emerald-600 text-white"
            : "bg-stone-100 text-stone-900"
        }`}
      >
        {senderLabel ? (
          <p className="mb-1 text-xs font-semibold opacity-70">{senderLabel}</p>
        ) : null}
        <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
        {toolCalls && toolCalls.length > 0 ? (
          <div className="mt-2 space-y-1">
            {toolCalls.map((tc, i) => (
              <ToolCallDisplay key={i} toolCall={tc} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChatInterface({
  propertyId,
  locale,
}: {
  propertyId: string | null;
  locale: "en" | "ar";
}) {
  const lang = locale === "ar" ? L.ar : L.en;
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [status, setStatus] = useState<string>("AI_HANDLING");
  const [customerId] = useState(() => `webchat-staff-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sendState, sendFormAction, sendPending] = useActionState(sendMessageAction, { ok: false } as ActionResult);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- state needed by useActionState hook
  const [_staffState, staffFormAction, staffPending] = useActionState(staffReplyAction, { ok: false } as ActionResult);
  const [takeOverState, takeOverFormAction] = useActionState(takeOverAction, { ok: false } as ActionResult);
  const [releaseState, releaseFormAction] = useActionState(releaseToAiAction, { ok: false } as ActionResult);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (sendState.ok && sendState.data) {
      const data = sendState.data as {
        conversationId: string;
        aiMessage: string;
        toolCalls?: ChatToolCall[];
        handoverRequested?: boolean;
        language?: string;
      };
      setTimeout(() => {
        setConversationId(data.conversationId);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            sender: "AI",
            content: data.aiMessage,
            language: data.language,
            metadata: data.toolCalls ? { toolCalls: data.toolCalls } : undefined,
            createdAt: new Date().toISOString(),
          },
        ]);
        if (data.handoverRequested) setStatus("NEEDS_ATTENTION");
        setIsAiThinking(false);
      }, 0);
    } else if (!sendState.ok && sendState.error) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            sender: "AI",
            content: `Error: ${sendState.error}`,
            createdAt: new Date().toISOString(),
          },
        ]);
        setIsAiThinking(false);
      }, 0);
    }
  }, [sendState]);

  useEffect(() => {
    if (takeOverState.ok) {
      setTimeout(() => setStatus("HUMAN_HANDLING"), 0);
    }
  }, [takeOverState]);

  useEffect(() => {
    if (releaseState.ok) {
      setTimeout(() => setStatus("AI_HANDLING"), 0);
    }
  }, [releaseState]);

  function handleSend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || !propertyId) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: "CUSTOMER",
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsAiThinking(true);

    const formData = new FormData();
    formData.set("message", input.trim());
    formData.set("customerId", customerId);
    if (conversationId) formData.set("conversationId", conversationId);
    setInput("");
    sendFormAction(formData);
  }

  function handleStaffReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || !conversationId) return;

    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("message", input.trim());
    setMessages((prev) => [
      ...prev,
      {
        id: `staff-${Date.now()}`,
        sender: "STAFF" as const,
        content: input.trim(),
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");
    staffFormAction(formData);
  }

  function handleTakeOver() {
    if (!conversationId) return;
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    takeOverFormAction(formData);
  }

  function handleRelease() {
    if (!conversationId) return;
    const formData = new FormData();
    formData.set("conversationId", conversationId);
    releaseFormAction(formData);
  }

  const isHumanMode = status === "HUMAN_HANDLING";
  const isHandover = status === "NEEDS_ATTENTION";

  return (
    <div className="flex h-[calc(100vh-12rem)] rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Status bar */}
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${
              isHumanMode ? "bg-amber-500" : isHandover ? "bg-red-500" : "bg-emerald-500"
            }`} />
            <span className="text-sm font-medium text-stone-700">
              {lang.status[status as keyof typeof lang.status] ?? status}
            </span>
          </div>
          <div className="flex gap-2">
            {isHumanMode ? (
              <button
                onClick={handleRelease}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                {lang.release}
              </button>
            ) : (
              <button
                onClick={handleTakeOver}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              >
                {lang.takeOver}
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-stone-400">{lang.newChat}</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))
          )}
          {isAiThinking ? (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-500">
                {lang.loading}
              </div>
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={isHumanMode ? handleStaffReply : handleSend}
          className="border-t border-stone-200 px-4 py-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isHumanMode ? lang.staffReply : lang.placeholder}
              className={inputClass}
              disabled={sendPending || staffPending}
            />
            <button
              type="submit"
              disabled={sendPending || staffPending || !input.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {sendPending || staffPending ? "…" : lang.send}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
