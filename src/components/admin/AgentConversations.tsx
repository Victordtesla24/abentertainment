'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useState, useEffect } from 'react';
import type { AgentConversation } from '@/lib/data';

interface AgentConversationsProps {
  agentId?: string;
}

export default function AgentConversations({ agentId }: AgentConversationsProps) {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState<string>(agentId || '');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  useEffect(() => {
    fetchConversations();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchConversations() {
    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/conversations');
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Failed to load conversations'}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await adminFetch('/api/admin/conversations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete conversation');
      setConversations((prev) => prev.filter((c) => c.id !== id));
      setDeleteConfirmId(null);
      if (expandedId === id) setExpandedId(null);
      showMessage('Conversation deleted');
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function exportConversation(conversation: AgentConversation, format: 'json' | 'text') {
    const timestamp = new Date(conversation.createdAt).toISOString().slice(0, 10);
    const safeName = conversation.agentName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    if (format === 'json') {
      const data = JSON.stringify(
        conversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
        null,
        2,
      );
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${safeName}-${timestamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const text = conversation.messages
        .map((m) => `[${m.role.toUpperCase()}]\n${m.content}\n`)
        .join('\n---\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${safeName}-${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  // Derive unique agent names for the filter dropdown
  const agentNames = Array.from(
    new Map(conversations.map((c) => [c.agentId, c.agentName])).entries()
  );

  // Filter conversations
  const filtered = filterAgent
    ? conversations.filter((c) => c.agentId === filterAgent)
    : conversations;

  // Sort by most recent first
  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  function formatDate(iso: string) {
    try {
      return new Date(iso).toLocaleString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">Conversation History</h2>
          <p className="text-white/30 text-[11px] mt-0.5">
            Browse and export past agent conversations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Agent Filter */}
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
          >
            <option value="">All Agents</option>
            {agentNames.map(([id, name]) => (
              <option key={id} value={id}>
                {name || id}
              </option>
            ))}
          </select>
          <button
            onClick={fetchConversations}
            className="px-4 py-2 bg-white/[0.03] text-white/40 text-sm border border-white/[0.08] rounded-sm hover:bg-white/[0.06] hover:text-white/60 transition-all"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-2 rounded-sm text-sm font-body ${
            message.startsWith('Error')
              ? 'bg-red-400/10 text-red-400 border border-red-400/20'
              : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
          }`}
        >
          {message}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <p className="text-white/25 text-sm font-body">Loading conversations...</p>
        </div>
      ) : sorted.length === 0 ? (
        /* Empty State */
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-white/10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
            />
          </svg>
          <p className="text-white/25 text-sm font-body">No conversations found.</p>
          <p className="text-white/15 text-[11px] font-body mt-1">
            Conversations will appear here after interacting with AI agents.
          </p>
        </div>
      ) : (
        /* Conversation List */
        <div className="space-y-2">
          {sorted.map((conv) => (
            <div
              key={conv.id}
              className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm overflow-hidden"
            >
              {/* List Row */}
              <button
                onClick={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
                className="w-full px-4 py-3 flex items-center gap-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                {/* Expand Indicator */}
                <svg
                  className={`w-3.5 h-3.5 text-white/20 flex-shrink-0 transition-transform ${
                    expandedId === conv.id ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>

                {/* Agent Name */}
                <span className="text-sm font-display font-semibold text-white truncate min-w-[120px] max-w-[160px]">
                  {conv.agentName || 'Unknown Agent'}
                </span>

                {/* Date */}
                <span className="text-[11px] text-white/25 font-body flex-shrink-0">
                  {formatDate(conv.createdAt)}
                </span>

                {/* Message Count */}
                <span className="text-[10px] text-white/20 font-body flex-shrink-0">
                  {conv.messages.length} message{conv.messages.length !== 1 ? 's' : ''}
                </span>

                {/* First Message Preview */}
                <span className="text-[11px] text-white/15 font-body truncate flex-1">
                  {conv.messages[0]?.content.slice(0, 80) || '(empty)'}
                  {(conv.messages[0]?.content.length || 0) > 80 ? '...' : ''}
                </span>
              </button>

              {/* Expanded View */}
              {expandedId === conv.id && (
                <div className="border-t border-[#C9A84C]/10">
                  {/* Actions Bar */}
                  <div className="px-4 py-2 flex items-center gap-2 border-b border-white/[0.04] bg-[#080808]">
                    <button
                      onClick={() => exportConversation(conv, 'json')}
                      className="text-[10px] font-body px-3 py-1.5 bg-white/[0.03] text-white/40 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white/60 transition-all rounded-sm"
                    >
                      Export JSON
                    </button>
                    <button
                      onClick={() => exportConversation(conv, 'text')}
                      className="text-[10px] font-body px-3 py-1.5 bg-white/[0.03] text-white/40 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white/60 transition-all rounded-sm"
                    >
                      Export Text
                    </button>
                    <div className="flex-1" />
                    {deleteConfirmId === conv.id ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-400/60 font-body mr-1">Delete?</span>
                        <button
                          onClick={() => handleDelete(conv.id)}
                          className="text-[10px] font-body px-3 py-1.5 bg-red-400/10 text-red-400 border border-red-400/20 rounded-sm hover:bg-red-400/20 transition-all"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="text-[10px] font-body px-3 py-1.5 bg-white/[0.03] text-white/40 border border-white/[0.08] rounded-sm hover:bg-white/[0.06] transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(conv.id)}
                        className="text-[10px] font-body px-3 py-1.5 text-red-400/60 border border-red-400/10 rounded-sm hover:bg-red-400/[0.06] hover:text-red-400 transition-all"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {/* Messages */}
                  <div className="px-4 py-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {conv.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] px-4 py-3 rounded-sm text-sm leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#C9A84C]/20 text-white'
                              : 'bg-[#0A0A0A] text-[#FDF8F1] border border-[#C9A84C]/10'
                          }`}
                        >
                          <pre className="whitespace-pre-wrap font-body text-sm">
                            {msg.content}
                          </pre>
                          {msg.timestamp && (
                            <p className="text-white/20 text-[10px] mt-1 font-body">
                              {msg.timestamp}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Summary */}
      {!loading && sorted.length > 0 && (
        <div className="mt-4 text-[10px] text-white/15 font-body text-center">
          Showing {sorted.length} of {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          {filterAgent ? ' (filtered)' : ''}
        </div>
      )}
    </div>
  );
}
