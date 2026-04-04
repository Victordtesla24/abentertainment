'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useRef, useEffect, useMemo, useCallback, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ─── Contextual Suggested Prompts ────────────────────────────────────────────

const SUGGESTED_PROMPTS: Record<string, { label: string; prompt: string }[]> = {
  dashboard: [
    { label: 'System health summary', prompt: 'Show system health summary' },
    { label: 'Error rate trend', prompt: "What's the error rate trend?" },
    { label: 'Server uptime', prompt: 'How long has the server been running?' },
  ],
  events: [
    { label: 'List upcoming events', prompt: 'List upcoming events' },
    { label: 'Top selling event', prompt: 'Which event has the most sales?' },
    { label: 'Event stats table', prompt: 'Show me event stats as a table' },
  ],
  settings: [
    { label: 'Current config', prompt: 'Show current configuration' },
    { label: 'API endpoints', prompt: 'What are the API endpoints?' },
    { label: 'Environment check', prompt: 'Check all environment variables are set' },
  ],
  default: [
    { label: 'Create an event', prompt: 'Help me create a new event' },
    { label: 'Market research', prompt: 'Research Melbourne entertainment market trends' },
    { label: 'Content ideas', prompt: 'Suggest social media content for upcoming events' },
  ],
};

// ─── Markdown Components ─────────────────────────────────────────────────────

const markdownComponents = {
  table: ({ children, ...props }: React.ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto my-3 -mx-1 px-1">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: React.ComponentPropsWithoutRef<'thead'>) => (
    <thead className="bg-[#C9A84C]/10" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }: React.ComponentPropsWithoutRef<'th'>) => (
    <th
      className="border border-[#C9A84C]/20 px-3 py-2 text-left text-xs font-body font-semibold text-[#C9A84C] uppercase tracking-wider"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: React.ComponentPropsWithoutRef<'td'>) => (
    <td
      className="border border-[#C9A84C]/10 px-3 py-2 text-xs font-body text-white/70"
      {...props}
    >
      {children}
    </td>
  ),
  tr: ({ children, ...props }: React.ComponentPropsWithoutRef<'tr'>) => (
    <tr className="even:bg-white/[0.02] hover:bg-[#C9A84C]/5 transition-colors" {...props}>
      {children}
    </tr>
  ),
  p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-2 last:mb-0" {...props}>
      {children}
    </p>
  ),
  code: ({ children, className, ...props }: React.ComponentPropsWithoutRef<'code'> & { className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-white/10 text-[#C9A84C] px-1.5 py-0.5 rounded text-xs font-mono" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-[#0A0A0A] border border-[#C9A84C]/10 p-3 rounded text-xs font-mono overflow-x-auto" {...props}>
        {children}
      </code>
    );
  },
  ul: ({ children, ...props }: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="list-disc list-inside mb-2 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>
      {children}
    </ol>
  ),
  strong: ({ children, ...props }: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="text-[#C9A84C] font-semibold" {...props}>
      {children}
    </strong>
  ),
};

// ─── Main Component ──────────────────────────────────────────────────────────

interface AdminChatbotProps {
  activeTab?: string;
}

export default function AdminChatbot({ activeTab = 'default' }: AdminChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm the AB Entertainment Admin Agent. I can help you manage events, research market trends, and assist with content creation. What would you like to do?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const suggestedPrompts = SUGGESTED_PROMPTS[activeTab] || SUGGESTED_PROMPTS.default;

  const tokenEstimate = useMemo(() =>
    messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0),
    [messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  function submitPrompt(text: string) {
    setInput(text);
    // Auto-submit after setting input
    const syntheticEvent = { preventDefault: () => {} } as FormEvent;
    handleSubmitWithContent(syntheticEvent, text);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    await handleSubmitWithContent(e, input.trim());
  }

  async function handleSubmitWithContent(e: FormEvent, content: string) {
    e.preventDefault();
    if (!content || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let streamedContent = '';
    let assistantStreamId: string | null = null;

    try {
      const res = await adminFetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortController.signal,
      });

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('text/html')) {
        throw new Error('API not available');
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const waitSec = retryAfter ? parseInt(retryAfter) : 60;
        const assistantId = `error-ratelimit-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: `⏱ **Rate limit reached.** Too many requests — please wait ${waitSec} seconds before trying again.`,
          },
        ]);
        setLoading(false);
        return;
      }

      if (res.status >= 500) {
        const assistantId = `error-server-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: `🔧 **AI service temporarily unavailable.** The server returned a ${res.status} error. Please try again in a moment.`,
          },
        ]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      // Agent returns JSON with { response, productionApproved }
      if (contentType.includes('application/json')) {
        const data = await res.json();
        const assistantId = `assistant-${Date.now()}`;
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: 'assistant',
            content: data.response || data.error || 'No response',
          },
        ]);
        setLoading(false);
        return;
      }

      // Fallback: streaming response
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      const assistantId = `assistant-${Date.now()}`;
      assistantStreamId = assistantId;

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;
        streamedContent = assistantContent;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (streamedContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: `stopped-${Date.now()}`,
              role: 'assistant',
              content: 'Generation stopped.',
            },
          ]);
        } else if (assistantStreamId) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantStreamId));
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content:
              '📡 **Network connection lost.** Unable to reach the AI service. Please check your internet connection and try again.',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }

  const saveConversation = useCallback(async (msgs: Message[]) => {
    const nonWelcome = msgs.filter((m) => m.id !== 'welcome');
    if (nonWelcome.length < 2) return;
    try {
      await adminFetch('/api/admin/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: 'agent-admin-default',
          agentName: 'Admin Assistant',
          messages: nonWelcome.map((m) => ({
            role: m.role,
            content: m.content,
            timestamp: new Date().toISOString(),
          })),
        }),
      });
    } catch {
      // Silent fail -- conversation save must not block chat
    }
  }, []);

  // Save conversation when user navigates away
  useEffect(() => {
    return () => {
      const nonWelcome = messages.filter((m) => m.id !== 'welcome');
      if (nonWelcome.length >= 2) {
        saveConversation(messages);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exportConversation(format: 'json' | 'text') {
    const timestamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      const data = JSON.stringify(messages.map(m => ({ role: m.role, content: m.content, timestamp: m.id })), null, 2);
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-conversation-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const text = messages.map(m => `[${m.role.toUpperCase()}]\n${m.content}\n`).join('\n---\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-conversation-${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">AI Agent</h2>
          <p className="text-white/30 text-[11px] mt-0.5">
            Intelligent assistant with access to events, market research, and content creation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportConversation('json')}
            className="text-[10px] font-body px-3 py-1.5 bg-white/[0.03] text-white/40 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white/60 transition-all rounded-md"
          >
            Export JSON
          </button>
          <button
            onClick={() => exportConversation('text')}
            className="text-[10px] font-body px-3 py-1.5 bg-white/[0.03] text-white/40 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white/60 transition-all rounded-md"
          >
            Export Text
          </button>
          <button
            onClick={() => { setMessages([messages[0]]); }}
            className="text-[10px] font-body px-3 py-1.5 text-red-400/60 border border-red-400/10 hover:bg-red-400/[0.06] hover:text-red-400 transition-all rounded-md"
          >
            Clear Chat
          </button>
        </div>
      </div>

      <div className="bg-[#0A0A0A] border border-white/[0.06] rounded-lg flex flex-col h-[600px] shadow-2xl shadow-black/40">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-sm text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'bg-[#C9A84C]/20 text-white'
                    : 'bg-[#0A0A0A] text-[#FDF8F1] border border-[#C9A84C]/10'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="font-body prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={markdownComponents}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-body">{message.content}</pre>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#0A0A0A] border border-[#C9A84C]/10 px-4 py-3 rounded-sm">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-[#C9A84C] rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-[#C9A84C] rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-[#C9A84C] rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        <div className="px-4 pt-3 pb-1 border-t border-[#C9A84C]/10 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {suggestedPrompts.map((sp) => (
              <button
                key={sp.prompt}
                onClick={() => submitPrompt(sp.prompt)}
                disabled={loading}
                className="px-3 py-1.5 bg-[#C9A84C]/10 border border-[#C9A84C]/20 text-[#C9A84C] text-xs font-body rounded-full whitespace-nowrap hover:bg-[#C9A84C]/20 hover:border-[#C9A84C]/40 transition-all duration-200 disabled:opacity-40"
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.06] p-4 bg-[#080808]">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent to create events, research markets..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-white/[0.08] rounded-lg text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#C9A84C]/40 focus:ring-1 focus:ring-[#C9A84C]/20 disabled:opacity-50 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 bg-gradient-to-r from-[#C9A84C] to-[#B8973F] text-black text-sm font-semibold rounded-lg hover:from-[#D4B65C] hover:to-[#C9A84C] transition-all disabled:opacity-30 shadow-lg shadow-[#C9A84C]/10"
            >
              Send
            </button>
            {loading && (
              <button
                type="button"
                onClick={() => abortControllerRef.current?.abort()}
                className="px-4 py-3 border border-red-500/20 text-red-400/70 text-sm rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all"
              >
                Stop
              </button>
            )}
          </form>
          <div className="flex items-center justify-between mt-2">
            <p className="text-white/15 text-[10px] font-body">
              {messages.length - 1} message{messages.length !== 2 ? 's' : ''} in conversation
            </p>
            <p className="text-white/15 text-[10px] font-body">
              {tokenEstimate.toLocaleString()} / 128K tokens
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
