"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";

function getMessageText(message: UIMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p: any) => p.type === "text")
    .map((p: any) => p.text as string)
    .join("");
}

export function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, error } = useChat({ transport });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  function handleSend(text?: string) {
    const content = text ?? input;
    if (!content.trim() || isLoading) return;
    sendMessage({ text: content });
    setInput("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend();
  }

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-[60] flex h-14 w-14 items-center justify-center rounded-full shadow-2xl border transition-all duration-500",
          isOpen
            ? "border-gold/60 bg-charcoal-deep text-ivory"
            : "border-gold/40 bg-charcoal text-ivory hover:border-gold hover:bg-gold hover:text-charcoal"
        )}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        aria-label={isOpen ? "Close concierge chat" : "Open concierge chat"}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span
              key="open"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.2 }}
            >
              <MessageSquare className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-24 right-6 z-[60] flex h-[560px] w-[340px] sm:w-[400px] flex-col overflow-hidden rounded-[2rem] border border-gold/15 shadow-2xl"
            style={{
              background:
                "linear-gradient(160deg, rgba(26,26,26,0.98) 0%, rgba(17,17,17,0.99) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-gold/12 px-5 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/10">
                <Sparkles className="h-4 w-4 text-gold" strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-display text-sm text-ivory">AB Concierge</p>
                <p className="font-body text-[0.6rem] uppercase tracking-[0.24em] text-ivory/65">
                  Cultural Event Assistant
                </p>
              </div>
              <div className="ml-auto flex h-2 w-2 rounded-full bg-green-400/80" aria-hidden="true" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
              {messages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="space-y-4"
                >
                  <div className="rounded-[1.25rem] rounded-tl-sm border border-ivory/8 bg-charcoal-light/60 px-4 py-3">
                    <p className="font-body text-sm leading-relaxed text-ivory/80">
                      Good evening. I&apos;m the AB Concierge — your guide to our 2026 season of Indian and Marathi cultural performances across Melbourne.
                    </p>
                  </div>
                  <div className="rounded-[1.25rem] rounded-tl-sm border border-ivory/8 bg-charcoal-light/60 px-4 py-3">
                    <p className="font-body text-sm leading-relaxed text-ivory/80">
                      I can help you explore upcoming events, find venue details, or guide you through the ticketing process.
                    </p>
                  </div>
                  <div className="mt-6 space-y-2">
                    {[
                      "What events are coming up?",
                      "Tell me about Swaranirmiti 2026",
                      "How do I book tickets?",
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className="block w-full rounded-full border border-gold/20 bg-gold/8 px-4 py-2 text-left font-body text-xs text-gold/80 transition-colors hover:border-gold/40 hover:bg-gold/14 hover:text-gold"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className={cn(
                    "flex",
                    m.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[82%] rounded-[1.25rem] px-4 py-3 font-body text-sm leading-relaxed",
                      m.role === "user"
                        ? "rounded-br-sm border border-gold/20 bg-gold/12 text-ivory"
                        : "rounded-tl-sm border border-ivory/8 bg-charcoal-light/60 text-ivory/85"
                    )}
                  >
                    {getMessageText(m)}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-[1.25rem] rounded-tl-sm border border-ivory/8 bg-charcoal-light/60 px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="h-1.5 w-1.5 rounded-full bg-gold/60"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                          transition={{
                            duration: 0.9,
                            repeat: Infinity,
                            delay: i * 0.2,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-center font-body text-xs text-red-400/80">
                  Something went wrong. Please try again.
                </p>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-gold/12 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  className="flex-1 rounded-full border border-ivory/10 bg-charcoal-light/50 px-4 py-2.5 font-body text-sm text-ivory placeholder-ivory/45 outline-none transition-colors focus:border-gold/40 focus:ring-0"
                  value={input}
                  placeholder="Ask about events, venues, tickets…"
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                  aria-label="Message to concierge"
                />
                <motion.button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-gold/30 bg-gold/12 text-gold transition-colors hover:border-gold/60 hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
                  whileTap={{ scale: 0.92 }}
                  aria-label="Send message"
                >
                  <Send className="h-3.5 w-3.5" />
                </motion.button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
