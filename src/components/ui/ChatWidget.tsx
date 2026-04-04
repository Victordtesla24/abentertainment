'use client';

import { useState, useRef, useEffect, useCallback, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiUrl } from '@/lib/api-config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_MESSAGES = 100;

const QUICK_PROMPTS = [
  { icon: '🎭', label: 'Upcoming Events', prompt: 'What events are coming up?' },
  { icon: '🎫', label: 'Buy Tickets', prompt: 'How do I buy tickets for your shows?' },
  { icon: '🎵', label: 'About Shows', prompt: 'Tell me about your cultural performances.' },
  { icon: '📞', label: 'Contact', prompt: 'How can I reach the AB Entertainment team?' },
];

const WELCOME_MESSAGE =
  "Namaste! 🙏 I'm your personal AB Concierge — here to help you discover **Melbourne's finest Indian & Marathi cultural experiences**. Ask me about upcoming events, tickets, venues, or anything about our shows. I'm delighted to assist!";

// ─── Markdown Components ──────────────────────────────────────────────────────

const markdownComponents = {
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
      {children}
    </p>
  ),
  strong: ({ children, ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold text-white" {...props}>
      {children}
    </strong>
  ),
  em: ({ children, ...props }: React.ComponentPropsWithoutRef<'em'>) => (
    <em className="italic text-white/85" {...props}>
      {children}
    </em>
  ),
  ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="mb-2 space-y-1.5 last:mb-0" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="mb-2 space-y-1.5 last:mb-0 list-none" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }: React.ComponentPropsWithoutRef<'li'>) => (
    <li className="flex gap-2 leading-relaxed" {...props}>
      <span className="text-[#C9A84C] flex-shrink-0 font-bold mt-px select-none">›</span>
      <span>{children}</span>
    </li>
  ),
  h1: ({ children, ...props }: React.ComponentPropsWithoutRef<'h1'>) => (
    <h1 className="text-white font-semibold text-base mb-1.5 mt-2 first:mt-0" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="text-white font-semibold text-[13.5px] mb-1.5 mt-2 first:mt-0" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="text-[#C9A84C] font-semibold text-[13px] mb-1 mt-1.5 first:mt-0" {...props}>
      {children}
    </h3>
  ),
  a: ({ href, children, ...props }: React.ComponentPropsWithoutRef<'a'>) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#C9A84C] underline underline-offset-2 hover:text-[#D4B65C] transition-colors"
      {...props}
    >
      {children}
    </a>
  ),
  code: ({
    children,
    className,
    ...props
  }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code
          className="block bg-[#0a0a06] border border-[#C9A84C]/10 px-3 py-2 my-2 text-[11.5px] font-mono text-[#C9A84C]/90 overflow-x-auto leading-relaxed"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-white/8 text-[#C9A84C]/90 px-1.5 py-0.5 text-[11px] font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  blockquote: ({ children, ...props }: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote
      className="border-l-2 border-[#C9A84C]/40 pl-3 my-2 text-white/60 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: ({ ...props }: React.ComponentPropsWithoutRef<'hr'>) => (
    <hr className="border-[#C9A84C]/15 my-3" {...props} />
  ),
};

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: true });
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 bg-[#1a1a0e] border border-[#C9A84C]/20 flex items-center justify-center">
        <Image src="/images/AB_Logo_transparent.png" alt="AB" width={18} height={18} className="object-contain opacity-80" unoptimized />
      </div>
      <div className="bg-[#111108] border border-[#C9A84C]/10 px-4 py-3 rounded-2xl rounded-tl-sm max-w-fit">
        <div className="flex items-center gap-1.5 h-4">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]"
              animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const welcomeTsRef = useRef(Date.now());

  const welcomeMsg: Message = {
    id: 'welcome',
    role: 'assistant',
    content: WELCOME_MESSAGE,
    ts: welcomeTsRef.current,
  };

  const visibleMessages = messages.length === 0
    ? [welcomeMsg]
    : messages;

  const conversationStarted = messages.length > 0;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  function openChat() {
    setIsOpen(true);
    setHasOpened(true);
  }

  function sendPrompt(prompt: string) {
    setInput(prompt);
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: prompt, ts: Date.now() };
    submitMessage(userMsg);
  }

  async function submitMessage(userMsg: Message) {
    const priorMessages = messages.length === 0 ? [] : messages;
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(getApiUrl('/api/chat'), {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...priorMessages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (!res.ok || contentType.includes('text/html')) {
        setMessages(prev => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content:
              "I'm currently unavailable on static hosting. Please reach us directly:\n\n📧 **abhi@abentertainment.com.au**\n📞 **(+61) 430082646**\n\nOr visit our **Contact** page — we'd love to hear from you!",
            ts: Date.now(),
          },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let content = '';
      const assistantId = `a-${Date.now()}`;
      setStreamingId(assistantId);
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', ts: Date.now() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // toTextStreamResponse() sends plain text — append chunk directly to preserve
        // all whitespace, newlines, and paragraph separators the AI generates.
        content += decoder.decode(value, { stream: true });

        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId ? { ...msg, content } : msg
          ).slice(-MAX_MESSAGES)
        );
      }

      setStreamingId(null);
      if (!content.trim()) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: "I couldn't generate a response. Please try again or contact us at **abhi@abentertainment.com.au**." }
              : msg
          )
        );
      }
    } catch (e) {
      setStreamingId(null);
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setMessages(prev => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: "I'm having trouble connecting right now. Please try again shortly, or contact us at **(+61) 430082646**.",
          ts: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim(), ts: Date.now() };
    await submitMessage(userMsg);
  }

  function clearConversation() {
    abortRef.current?.abort();
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setStreamingId(null);
  }

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-[901] flex flex-col items-end gap-2 md:bottom-6">

        {/* "Chat with us" label — shown before first open */}
        <AnimatePresence>
          {!hasOpened && !isOpen && (
            <motion.div
              initial={{ opacity: 0, x: 12, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 12, scale: 0.9 }}
              transition={{ delay: 1.5, duration: 0.4, ease: 'easeOut' }}
              className="bg-[#0A0A0A] border border-[#C9A84C]/30 px-4 py-2 shadow-lg shadow-black/40 pointer-events-none"
            >
              <p className="text-[#C9A84C] text-xs font-body font-semibold tracking-wide whitespace-nowrap">
                Ask our Concierge ✨
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FAB button */}
        <div className="relative">
          {/* Pulse ring when closed */}
          {!isOpen && (
            <motion.span
              className="absolute inset-0 rounded-full"
              animate={{ scale: [1, 1.35], opacity: [0.5, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              style={{ background: 'radial-gradient(circle, rgba(201,168,76,0.4) 0%, transparent 70%)' }}
            />
          )}

          <motion.button
            onClick={() => (isOpen ? setIsOpen(false) : openChat())}
            className="relative w-14 h-14 md:w-[60px] md:h-[60px] flex items-center justify-center text-black shadow-[0_6px_30px_rgba(201,168,76,0.45)] hover:shadow-[0_8px_40px_rgba(201,168,76,0.65)] transition-shadow duration-300 overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #D4B65C 0%, #C9A84C 50%, #B8942E 100%)' }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            aria-label={isOpen ? 'Close concierge chat' : 'Open concierge chat'}
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.svg key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }} className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </motion.svg>
              ) : (
                <motion.div key="icon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }} className="flex flex-col items-center gap-0.5">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* ── Chat Panel ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-[5.25rem] right-6 z-[900] w-[min(420px,calc(100vw-1.5rem))] flex flex-col bg-[#060606] shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_0_1px_rgba(201,168,76,0.12)]"
            style={{ maxHeight: 'min(600px, calc(100dvh - 7rem))' }}
          >
            {/* Gold accent bar */}
            <div className="h-[3px] w-full flex-shrink-0" style={{ background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #D4B65C 50%, #C9A84C 70%, transparent)' }} />

            {/* ── Header ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#C9A84C]/10 flex-shrink-0 bg-[#080808]">
              <div className="w-9 h-9 rounded-full flex-shrink-0 bg-[#111108] border border-[#C9A84C]/20 flex items-center justify-center overflow-hidden">
                <Image src="/images/AB_Logo_transparent.png" alt="AB Entertainment" width={28} height={28} className="object-contain" unoptimized />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white text-[13px] font-display font-semibold leading-tight tracking-wide">
                  AB Concierge
                </h3>
                <p className="text-[#C9A84C]/50 text-[10px] font-body uppercase tracking-[0.12em] mt-0.5">
                  Your Cultural Event Expert
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {/* Live status */}
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-body text-emerald-400/70">Live</span>
                </div>
                {/* Clear conversation */}
                {conversationStarted && (
                  <button
                    onClick={clearConversation}
                    title="Start new conversation"
                    className="text-white/20 hover:text-white/50 transition-colors p-0.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                )}
                {/* Close */}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/25 hover:text-white/60 transition-colors p-0.5"
                  aria-label="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Messages ─────────────────────────────────────────────────── */}
            <div
              className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 scroll-smooth"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,168,76,0.15) transparent' }}
            >
              {visibleMessages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx === 0 ? 0 : 0 }}
                >
                  {msg.role === 'assistant' ? (
                    /* ── Assistant message ── */
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full flex-shrink-0 bg-[#111108] border border-[#C9A84C]/20 flex items-center justify-center overflow-hidden mt-0.5">
                        <Image src="/images/AB_Logo_transparent.png" alt="AB" width={18} height={18} className="object-contain opacity-85" unoptimized />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="bg-[#0f0f09] border border-[#C9A84C]/10 px-4 py-3 rounded-2xl rounded-tl-sm max-w-[88%] text-[13.5px] text-white/80 font-body leading-relaxed">
                          {msg.content ? (
                            <>
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {msg.content}
                              </ReactMarkdown>
                              {streamingId === msg.id && (
                                <motion.span
                                  className="inline-block w-[2px] h-3.5 bg-[#C9A84C] ml-0.5 align-middle"
                                  animate={{ opacity: [1, 0] }}
                                  transition={{ duration: 0.7, repeat: Infinity }}
                                />
                              )}
                            </>
                          ) : (
                            <span className="text-white/30 italic text-xs">Thinking…</span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/20 font-body mt-1 ml-1">{formatTime(msg.ts)}</p>
                      </div>
                    </div>
                  ) : (
                    /* ── User message ── */
                    <div className="flex justify-end">
                      <div className="max-w-[85%]">
                        <div className="bg-[#C9A84C]/12 border border-[#C9A84C]/20 px-4 py-3 rounded-2xl rounded-tr-sm text-[13.5px] text-white font-body leading-relaxed">
                          {msg.content}
                        </div>
                        <p className="text-[10px] text-white/20 font-body mt-1 text-right mr-1">{formatTime(msg.ts)}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isLoading && !streamingId && <TypingIndicator />}

              {/* Quick prompts — shown only in welcome state */}
              {!conversationStarted && !isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.35 }}
                  className="mt-2"
                >
                  <p className="text-[10px] font-body uppercase tracking-[0.15em] text-white/25 mb-3 ml-10">
                    Quick questions
                  </p>
                  <div className="grid grid-cols-2 gap-2 ml-10">
                    {QUICK_PROMPTS.map((qp) => (
                      <motion.button
                        key={qp.label}
                        onClick={() => sendPrompt(qp.prompt)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        className="text-left p-3 bg-[#0f0f09] border border-[#C9A84C]/15 hover:border-[#C9A84C]/40 hover:bg-[#141408] transition-all duration-200 group"
                      >
                        <span className="block text-base mb-1">{qp.icon}</span>
                        <span className="block text-[11px] font-body text-white/55 group-hover:text-white/80 transition-colors leading-tight">
                          {qp.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* ── Input Area ─────────────────────────────────────────────────── */}
            <div className="border-t border-[#C9A84C]/10 bg-[#080808] flex-shrink-0">
              <form onSubmit={handleSubmit} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask me anything about our events…"
                    disabled={isLoading}
                    maxLength={600}
                    className="flex-1 px-4 py-2.5 bg-[#0f0f09] border border-[#C9A84C]/15 text-white text-[13px] font-body placeholder-white/20 focus:outline-none focus:border-[#C9A84C]/45 disabled:opacity-40 transition-colors duration-200"
                  />
                  <motion.button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="w-10 h-10 flex items-center justify-center flex-shrink-0 text-black disabled:opacity-25 transition-all duration-200 hover:shadow-[0_0_18px_rgba(201,168,76,0.4)]"
                    style={{ background: 'linear-gradient(135deg, #D4B65C, #C9A84C)' }}
                    aria-label="Send"
                  >
                    <svg className="w-4 h-4 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  </motion.button>
                </div>
              </form>
              {/* Footer */}
              <div className="px-4 pb-3 flex items-center justify-between">
                <p className="text-[9px] font-body text-white/15 tracking-wide">
                  Powered by <span className="text-[#C9A84C]/40">AB Entertainment AI</span>
                </p>
                <p className="text-[9px] font-body text-white/15">
                  abhi@abentertainment.com.au
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
