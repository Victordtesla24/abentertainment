'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '@/lib/api-config';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Floating chatbot widget — black & gold theme matching the site.
 * Connects to /api/chat which uses the OpenAI API with in-memory rate limiting.
 */
export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Welcome to AB Entertainment! I\'m your concierge. Ask me about upcoming events, tickets, or anything about our cultural experiences in Melbourne.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(getApiUrl('/api/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      // Check if response is HTML (static hosting — no API routes)
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: 'I\'m currently available when the site is running on a server with the OpenAI API configured. For now, please contact us directly at abhi@abentertainment.com.au or call (+61) 430082646 for any inquiries about events, tickets, or sponsorship.',
          },
        ]);
        return;
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = `a-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Skip SSE data prefixes if present
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: assistantContent } : m))
        );
      }

      // If response was empty, show fallback
      if (!assistantContent.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'I received your message but couldn\'t generate a response. Please try again or contact us at abhi@abentertainment.com.au.' }
              : m
          )
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', content: 'I\'m having trouble connecting. Please try again shortly.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[900] w-14 h-14 flex items-center justify-center bg-gradient-to-br from-[#C9A84C] to-[#D4B65C] text-black shadow-[0_4px_20px_rgba(201,168,76,0.4)] hover:shadow-[0_6px_30px_rgba(201,168,76,0.6)] transition-shadow duration-300"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.svg key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }} className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </motion.svg>
          ) : (
            <motion.svg key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }} className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </motion.svg>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="fixed bottom-24 right-6 z-[900] w-[380px] max-w-[calc(100vw-3rem)] h-[520px] max-h-[70vh] flex flex-col bg-[#0A0A0A] border border-[#C9A84C]/15 shadow-[0_8px_40px_rgba(0,0,0,0.6),0_0_0_1px_rgba(201,168,76,0.1)]"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#C9A84C]/10 bg-[#0A0A0A]">
              <div className="w-8 h-8 flex items-center justify-center bg-gradient-to-br from-[#C9A84C] to-[#D4B65C] text-black font-bold text-xs">
                AB
              </div>
              <div className="flex-1">
                <h3 className="text-white text-sm font-body font-semibold">AB Concierge</h3>
                <p className="text-[#C9A84C]/50 text-[10px] font-body uppercase tracking-wider">Event Assistant</p>
              </div>
              <div className="w-2 h-2 bg-[#1BBFA1] rounded-full animate-pulse" />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-4 py-3 text-sm leading-relaxed font-body ${
                      msg.role === 'user'
                        ? 'bg-[#C9A84C]/10 text-white border border-[#C9A84C]/20'
                        : 'bg-white/[0.03] text-white/80 border border-white/5'
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-[#C9A84C] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-[#C9A84C]/10 bg-[#0A0A0A]">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about events, tickets..."
                  disabled={isLoading}
                  className="flex-1 px-4 py-2.5 bg-white/[0.03] border border-[#C9A84C]/10 text-white text-sm font-body placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/30 disabled:opacity-50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={isLoading || !input.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#C9A84C] to-[#D4B65C] text-black font-bold text-xs uppercase tracking-wider disabled:opacity-30 hover:shadow-[0_0_15px_rgba(201,168,76,0.3)] transition-all duration-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
