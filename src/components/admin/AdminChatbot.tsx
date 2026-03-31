'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState, useRef, useEffect, FormEvent } from 'react';
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

  const suggestedPrompts = SUGGESTED_PROMPTS[activeTab] || SUGGESTED_PROMPTS.default;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

    try {
      const res = await fetch(getApiUrl('/api/admin/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const contentType = res.headers.get('content-type') || '';

      if (!res.ok || contentType.includes('text/html')) {
        throw new Error('API not available');
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

      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        assistantContent += chunk;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content:
            'Sorry, I encountered an error. Please ensure the OpenAI API key is configured in .env and try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-white mb-2">AI Agent</h2>
      <p className="text-white/40 text-sm mb-6">
        Agentic assistant with access to events, market research, and content creation
        capabilities.
      </p>

      <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm flex flex-col h-[600px]">
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
        <div className="border-t border-[#C9A84C]/20 p-4">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the agent to create events, research markets..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm placeholder-white/40 focus:outline-none focus:border-[#C9A84C] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
