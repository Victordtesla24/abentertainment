'use client';
import { adminFetch } from '@/lib/admin-fetch';
import { useState, FormEvent } from 'react';
import type { AgentConfig } from '@/lib/data';

interface AgentManagerProps {
  initialAgents: AgentConfig[];
}

const AVAILABLE_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o', description: 'High quality, balanced speed.' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fastest OpenAI. Lower cost.' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Strong reasoning, large context.' },
  { id: 'claude-opus-4.6', label: 'Claude Opus 4.6', description: 'Top-tier Anthropic model.' },
  { id: 'claude-sonnet-4.6', label: 'Claude Sonnet 4.6', description: 'Fast Anthropic model.' },
  { id: 'claude-sonnet-4.6-max-thinking', label: 'Claude Sonnet 4.6 (Max Thinking)', description: 'Extended thinking. 1M token context. Best for complex reasoning.' },
  { id: 'claude-opus-4.6-high-thinking', label: 'Claude Opus 4.6 (High Thinking)', description: 'Extended thinking. Deep analysis and reasoning.' },
  { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Ultra-fast Google model.' },
  { id: 'deepseek-v3.2', label: 'DeepSeek V3.2', description: 'Open-weight powerhouse.' },
];

const EMPTY_FORM = {
  name: '',
  type: 'customer' as 'customer' | 'admin',
  model: 'gpt-4o',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 2000,
  status: 'active' as 'active' | 'inactive',
};

export default function AgentManager({ initialAgents }: AgentManagerProps) {
  const [agents, setAgents] = useState<AgentConfig[]>(initialAgents);
  const [editing, setEditing] = useState<AgentConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  function startCreate() {
    setEditing(null);
    setCreating(true);
    setForm(EMPTY_FORM);
  }

  function startEdit(agent: AgentConfig) {
    setCreating(false);
    setEditing(agent);
    setForm({
      name: agent.name,
      type: agent.type,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      status: agent.status,
    });
  }

  function cancelForm() {
    setEditing(null);
    setCreating(false);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    setMessage('');

    try {
      const method = creating ? 'POST' : 'PUT';
      const body = creating ? form : { ...form, id: editing!.id };

      const res = await adminFetch('/api/admin/agents', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save agent');

      const data = await res.json();
      if (creating) {
        setAgents((prev) => [...prev, data.agent]);
      } else {
        setAgents((prev) =>
          prev.map((a) => (a.id === data.agent.id ? data.agent : a))
        );
      }

      cancelForm();
      showMessage(creating ? 'Agent created' : 'Agent updated');
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await adminFetch('/api/admin/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error('Failed to delete');
      setAgents((prev) => prev.filter((a) => a.id !== id));
      setDeleteConfirmId(null);
      showMessage('Agent deleted');
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function toggleStatus(agent: AgentConfig) {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await adminFetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      const data = await res.json();
      setAgents((prev) =>
        prev.map((a) => (a.id === data.agent.id ? data.agent : a))
      );
      showMessage(`Agent ${newStatus}`);
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function handleRename(agent: AgentConfig) {
    if (!renameValue.trim() || renameValue === agent.name) {
      setRenamingId(null);
      return;
    }
    try {
      const res = await adminFetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agent.id, name: renameValue.trim() }),
      });

      if (!res.ok) throw new Error('Failed to rename');
      const data = await res.json();
      setAgents((prev) =>
        prev.map((a) => (a.id === data.agent.id ? data.agent : a))
      );
      setRenamingId(null);
      showMessage('Agent renamed');
    } catch (err) {
      showMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function moveAgent(index: number, direction: 'up' | 'down') {
    const newAgents = [...agents];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newAgents.length) return;
    [newAgents[index], newAgents[swapIndex]] = [newAgents[swapIndex], newAgents[index]];
    setAgents(newAgents);
    try {
      await Promise.all([
        adminFetch('/api/admin/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newAgents[index].id, name: newAgents[index].name }),
        }),
        adminFetch('/api/admin/agents', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newAgents[swapIndex].id, name: newAgents[swapIndex].name }),
        }),
      ]);
    } catch {
      showMessage('Error: Failed to save order');
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-white">AI Agent Configuration</h2>
          <p className="text-white/30 text-[11px] mt-0.5">
            Manage AI agents, models, and system prompts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/20 font-body">
            {agents.length} agent{agents.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={startCreate}
            className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
          >
            + New Agent
          </button>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm font-body ${
          message.startsWith('Error')
            ? 'bg-red-400/10 text-red-400 border border-red-400/20'
            : 'bg-[#1BBFA1]/10 text-[#1BBFA1] border border-[#1BBFA1]/20'
        }`}>
          {message}
        </div>
      )}

      {/* Create / Edit Form */}
      {(creating || editing) && (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4 mb-6">
          <h3 className="text-sm font-display font-semibold text-white mb-4">
            {creating ? 'Create New Agent' : `Edit: ${editing!.name}`}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div>
                <label className="block text-[11px] text-white/40 font-body mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Agent name..."
                  required
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-[11px] text-white/40 font-body mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'customer' | 'admin' })}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                >
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Model */}
              <div>
                <label className="block text-[11px] text-white/40 font-body mb-1">Model</label>
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label} — {m.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-[11px] text-white/40 font-body mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Temperature */}
              <div>
                <label className="block text-[11px] text-white/40 font-body mb-1">
                  Temperature ({form.temperature})
                </label>
                <input
                  type="number"
                  min={0}
                  max={2}
                  step={0.1}
                  value={form.temperature}
                  onChange={(e) => setForm({ ...form, temperature: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {/* Max Tokens */}
              <div>
                <label className="block text-[11px] text-white/40 font-body mb-1">Max Tokens</label>
                <input
                  type="number"
                  min={1}
                  value={form.maxTokens}
                  onChange={(e) => setForm({ ...form, maxTokens: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]"
                />
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label className="block text-[11px] text-white/40 font-body mb-1">System Prompt</label>
              <textarea
                value={form.systemPrompt}
                onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                placeholder="Enter the system prompt for this agent..."
                rows={5}
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-y"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : creating ? 'Create Agent' : 'Update Agent'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="px-4 py-2 bg-white/[0.03] text-white/40 text-sm border border-white/[0.08] rounded-sm hover:bg-white/[0.06] hover:text-white/60 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Agent Cards Grid */}
      {agents.length === 0 ? (
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-8 text-center">
          <p className="text-white/25 text-sm font-body">No agents configured yet.</p>
          <button
            onClick={startCreate}
            className="mt-3 px-4 py-2 bg-[#C9A84C] text-white text-sm font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors"
          >
            Create Your First Agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent, index) => (
            <div
              key={agent.id}
              className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-4 flex flex-col"
            >
              {/* Header: Name + Status */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  {renamingId === agent.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(agent)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(agent);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="w-full px-2 py-1 bg-[#111111] border border-[#C9A84C]/40 rounded-sm text-white text-sm font-display font-semibold focus:outline-none focus:border-[#C9A84C]"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setRenamingId(agent.id);
                        setRenameValue(agent.name);
                      }}
                      className="text-left text-white font-display font-semibold text-sm hover:text-[#C9A84C] transition-colors truncate block w-full"
                      title="Click to rename"
                    >
                      {agent.name}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => toggleStatus(agent)}
                  title={`Click to ${agent.status === 'active' ? 'deactivate' : 'activate'}`}
                  className={`ml-2 px-2 py-0.5 text-[10px] font-body rounded-sm cursor-pointer transition-colors flex-shrink-0 ${
                    agent.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                      : 'bg-white/10 text-white/30 hover:bg-white/20'
                  }`}
                >
                  {agent.status}
                </button>
              </div>

              {/* Meta Row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2 py-0.5 text-[10px] font-body rounded-sm ${
                  agent.type === 'admin'
                    ? 'bg-purple-400/20 text-purple-300'
                    : 'bg-[#1BBFA1]/20 text-[#1BBFA1]'
                }`}>
                  {agent.type}
                </span>
                <span className="text-[11px] text-white/40 font-body">
                  {AVAILABLE_MODELS.find((m) => m.id === agent.model)?.label || agent.model}
                </span>
              </div>

              {/* Details */}
              <div className="flex items-center gap-3 text-[11px] text-white/25 font-body mb-3">
                <span>Temp: {agent.temperature}</span>
                <span>Max: {agent.maxTokens.toLocaleString()}</span>
              </div>

              {/* Divider */}
              <div className="border-t border-[#C9A84C]/10 my-2" />

              {/* System Prompt Preview */}
              <p className="text-[11px] text-white/25 font-body leading-relaxed line-clamp-3 mb-3 flex-1">
                {agent.systemPrompt || 'No system prompt configured.'}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(agent)}
                    className="px-3 py-1.5 text-[10px] font-body bg-white/[0.03] text-white/40 border border-white/[0.08] rounded-sm hover:bg-white/[0.06] hover:text-white/60 transition-all"
                  >
                    Edit
                  </button>
                  {deleteConfirmId === agent.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="px-3 py-1.5 text-[10px] font-body bg-red-400/10 text-red-400 border border-red-400/20 rounded-sm hover:bg-red-400/20 transition-all"
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 text-[10px] font-body bg-white/[0.03] text-white/40 border border-white/[0.08] rounded-sm hover:bg-white/[0.06] transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirmId(agent.id)}
                      className="px-3 py-1.5 text-[10px] font-body text-red-400/60 border border-red-400/10 rounded-sm hover:bg-red-400/[0.06] hover:text-red-400 transition-all"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => moveAgent(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-white/20 hover:text-white/50 disabled:opacity-20 transition-colors"
                    title="Move up"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveAgent(index, 'down')}
                    disabled={index === agents.length - 1}
                    className="p-1 text-white/20 hover:text-white/50 disabled:opacity-20 transition-colors"
                    title="Move down"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
