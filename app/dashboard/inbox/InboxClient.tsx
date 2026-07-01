"use client";

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, CheckCheck, Check } from "lucide-react";
import { toast } from "sonner";

type Conversation = {
  id: string;
  unreadCount: number;
  lastMessageAt: string;
  contact: { name: string; phone: string };
  messages: { content: unknown; direction: string; createdAt: string }[];
};

type Message = {
  id: string;
  direction: string;
  status: string;
  content: { text?: string };
  createdAt: string;
  sentAt?: string;
};

export default function InboxClient({ conversations: initial }: { conversations: Conversation[] }) {
  const [conversations, setConversations] = useState(initial);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`/api/inbox/messages?conversationId=${selected.id}`)
      .then(r => r.json())
      .then(data => { setMessages(Array.isArray(data) ? data : []); })
      .finally(() => setLoading(false));
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !selected || sending) return;
    setSending(true);
    const msgText = text.trim();
    setText("");
    try {
      const res = await fetch("/api/inbox/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selected.id, text: msgText }),
      });
      const msg = await res.json();
      setMessages(p => [...p, msg]);
      setConversations(p => p.map(c => c.id === selected.id ? { ...c, lastMessageAt: new Date().toISOString() } : c));
    } catch {
      toast.error("Failed to send message");
      setText(msgText);
    } finally {
      setSending(false);
    }
  }

  function formatTime(date: string) {
    return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatDate(date: string) {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    if (d.toDateString() === new Date(now.getTime() - 86400000).toDateString()) return "Yesterday";
    return d.toLocaleDateString();
  }

  return (
    <div className="h-[calc(100vh-7rem)] flex rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Sidebar */}
      <div className="w-72 flex-shrink-0 border-r border-slate-100 dark:border-slate-800 flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Inbox</h2>
          <p className="text-xs text-slate-400">{conversations.length} conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No conversations yet</p>
            </div>
          ) : conversations.map((conv) => {
            const lastMsg = conv.messages[0];
            const lastMsgText = (lastMsg?.content as { text?: string })?.text ?? "Media message";
            return (
              <button key={conv.id} onClick={() => setSelected(conv)}
                className={`w-full text-left px-4 py-3 border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
                  selected?.id === conv.id ? "bg-emerald-50 dark:bg-emerald-900/10 border-l-2 border-l-emerald-500" : ""
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {conv.contact.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{conv.contact.name}</p>
                      <p className="text-xs text-slate-400">{conv.contact.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{formatDate(conv.lastMessageAt)}</p>
                    {conv.unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center w-4 h-4 bg-emerald-500 text-white text-[10px] font-bold rounded-full mt-0.5">{conv.unreadCount}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-400 truncate pl-10">{lastMsgText}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat window */}
      {selected ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white font-bold">
              {selected.contact.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{selected.contact.name}</p>
              <p className="text-xs text-slate-400">{selected.contact.phone}</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-slate-400">Online</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-slate-50 dark:bg-slate-950">
            {loading ? (
              <div className="flex justify-center pt-8">
                <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.map((msg) => {
              const isOut = msg.direction === "OUTBOUND";
              return (
                <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-xs lg:max-w-sm xl:max-w-md px-4 py-2.5 rounded-2xl ${
                    isOut ? "bg-[#DCF8C6] rounded-tr-sm" : "bg-white dark:bg-slate-800 rounded-tl-sm shadow-sm"
                  }`}>
                    <p className="text-sm text-slate-800 dark:text-slate-100">{msg.content?.text ?? "Media message"}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOut ? "justify-end" : ""}`}>
                      <span className="text-[10px] text-slate-400">{formatTime(msg.createdAt)}</span>
                      {isOut && (
                        msg.status === "READ" ? <CheckCheck size={12} className="text-blue-500" /> :
                        msg.status === "DELIVERED" ? <CheckCheck size={12} className="text-slate-400" /> :
                        <Check size={12} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="flex items-center gap-3 px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:text-white" />
            <button type="submit" disabled={!text.trim() || sending} className="w-10 h-10 flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50 shadow-sm">
              <Send size={16} />
            </button>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <MessageSquare size={40} className="mx-auto mb-3 text-slate-200" />
            <p className="font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose a conversation from the sidebar</p>
          </div>
        </div>
      )}
    </div>
  );
}
