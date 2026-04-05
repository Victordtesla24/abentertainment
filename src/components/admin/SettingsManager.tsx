'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useState, useRef, useEffect, FormEvent } from 'react';
import Image from 'next/image';
import type { SiteSettings, PageTitle } from '@/lib/data';

interface SettingsManagerProps {
  initialSettings: SiteSettings;
}

interface ModelOption {
  id: string;
  label: string;
  description: string;
}

// Must match ALLOWED_MODELS in src/app/api/admin/chat/route.ts. Model ids
// prefixed with a provider slug (e.g. "anthropic/…", "google/…") are routed
// through OpenRouter; unprefixed "gpt-*" ids go directly to api.openai.com.
// Any id not in this list is silently coerced to the chat-route default and
// the admin's selection would not take effect.
//
// Every model below supports tool calling — required for the admin agent's
// CRUD operations on events, sponsors, testimonials, site settings, and the
// codebase. List curated from OpenRouter's /api/v1/models endpoint filtered
// by supported_parameters.tools.
const AVAILABLE_MODELS: ModelOption[] = [
  // OpenAI — direct api.openai.com (requires OPENAI_API_KEY)
  { id: 'gpt-4.1',                          label: 'GPT-4.1 (OpenAI)',                 description: 'Flagship OpenAI reasoning model. Best accuracy + tool-calling quality.' },
  { id: 'gpt-4.1-mini',                     label: 'GPT-4.1 Mini (OpenAI)',            description: 'Fast, cost-efficient. Default for admin agent tasks.' },
  { id: 'gpt-4o',                           label: 'GPT-4o (OpenAI)',                  description: 'Balanced quality + speed. Strong multimodal.' },
  { id: 'gpt-4o-mini',                      label: 'GPT-4o Mini (OpenAI)',             description: 'Fastest + cheapest OpenAI. Good for simple interactions.' },
  { id: 'gpt-4-turbo',                      label: 'GPT-4 Turbo (OpenAI)',             description: 'Strong reasoning, large context window.' },
  { id: 'gpt-3.5-turbo',                    label: 'GPT-3.5 Turbo (OpenAI)',           description: 'Economical option for high-volume simple tasks.' },
  // Claude 4.6 with extended thinking — via OpenRouter (requires OPENROUTER_API_KEY)
  { id: 'anthropic/claude-opus-4.6:thinking-max',    label: 'Claude Opus 4.6 (Max Thinking, 1M ctx)',    description: 'Anthropic flagship + max thinking budget (32K reasoning tokens). Deepest analysis.' },
  { id: 'anthropic/claude-opus-4.6:thinking-high',   label: 'Claude Opus 4.6 (High Thinking, 1M ctx)',   description: 'Anthropic flagship + high thinking effort (~80% of max_tokens as reasoning).' },
  { id: 'anthropic/claude-sonnet-4.6:thinking-max',  label: 'Claude Sonnet 4.6 (Max Thinking, 1M ctx)',  description: 'Anthropic balanced + max thinking budget. Strong reasoning at lower cost.' },
  { id: 'anthropic/claude-sonnet-4.6:thinking-high', label: 'Claude Sonnet 4.6 (High Thinking, 1M ctx)', description: 'Anthropic balanced + high thinking effort. Great quality-to-speed ratio.' },
  // Anthropic — base variants (no thinking)
  { id: 'anthropic/claude-opus-4.6',        label: 'Claude Opus 4.6 (Anthropic, 1M ctx)',  description: 'Anthropic flagship. Deepest reasoning, 1M context window.' },
  { id: 'anthropic/claude-sonnet-4.6',      label: 'Claude Sonnet 4.6 (Anthropic, 1M ctx)', description: 'Anthropic balanced. Excellent quality-to-speed ratio, 1M context.' },
  { id: 'anthropic/claude-opus-4.5',        label: 'Claude Opus 4.5 (Anthropic)',      description: 'Prior-gen Anthropic flagship. 200K context.' },
  { id: 'anthropic/claude-sonnet-4.5',      label: 'Claude Sonnet 4.5 (Anthropic, 1M ctx)', description: 'Prior-gen Anthropic balanced, 1M context.' },
  { id: 'anthropic/claude-haiku-4.5',       label: 'Claude Haiku 4.5 (Anthropic, fast)',   description: 'Fastest Anthropic. Low latency, 200K context.' },
  // Google — via OpenRouter
  { id: 'google/gemini-3.1-pro-preview',    label: 'Gemini 3.1 Pro (Google, preview)', description: 'Latest Google flagship. Strong multimodal reasoning, 1M context.' },
  { id: 'google/gemini-2.5-pro',            label: 'Gemini 2.5 Pro (Google, stable)',  description: 'Stable Google flagship. 1M context, strong tool use.' },
  { id: 'google/gemini-3-flash-preview',    label: 'Gemini 3 Flash (Google, fast)',    description: 'Fast Google model. Low cost, 1M context.' },
  // xAI — via OpenRouter
  { id: 'x-ai/grok-4.20',                   label: 'Grok 4.20 (xAI, 2M ctx)',          description: 'Latest xAI flagship. 2M context window.' },
  { id: 'x-ai/grok-4.1-fast',               label: 'Grok 4.1 Fast (xAI, 2M ctx)',      description: 'Fast xAI model. 2M context, low cost.' },
  // DeepSeek — via OpenRouter
  { id: 'deepseek/deepseek-v3.2',           label: 'DeepSeek V3.2 (open weights)',     description: 'Strong coding and math. 164K context.' },
  // Qwen — via OpenRouter
  { id: 'qwen/qwen3-max-thinking',          label: 'Qwen3 Max Thinking (Alibaba)',     description: 'Deep reasoning model. Multilingual, 262K context.' },
];

interface PageTitleEntry {
  slug: string;
  label: string;
  title: string;
}

const DEFAULT_PAGES: PageTitleEntry[] = [
  { slug: '/', label: 'Home', title: 'Home' },
  { slug: '/about', label: 'About', title: 'About' },
  { slug: '/events', label: 'Events', title: 'Events' },
  { slug: '/gallery', label: 'Gallery', title: 'Gallery' },
  { slug: '/sponsors', label: 'Sponsors', title: 'Sponsors' },
  { slug: '/contact', label: 'Contact', title: 'Contact' },
];

export default function SettingsManager({ initialSettings }: SettingsManagerProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState('/images/AB_Logo_transparent.png');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pageTitles, setPageTitles] = useState<PageTitleEntry[]>(DEFAULT_PAGES);
  const [editingPage, setEditingPage] = useState<string | null>(null);

  useEffect(() => {
    async function loadPageTitles() {
      try {
        const res = await adminFetch('/api/admin/pages');
        if (res.ok) {
          const data = await res.json();
          if (data.pages) setPageTitles(data.pages.map((p: PageTitle) => ({
            slug: p.slug,
            label: p.slug === '/' ? 'Home' : p.slug.replace('/', '').charAt(0).toUpperCase() + p.slug.replace('/', '').slice(1),
            title: p.title,
          })));
        }
      } catch { /* use defaults */ }
    }
    loadPageTitles();
  }, []);

  // If the loaded settings contain a model id the admin chat route can no
  // longer serve (e.g., a legacy Claude/Gemini entry from an older UI),
  // normalize it to the chat default once so the in-memory state matches
  // what a subsequent Save will persist, and the selector stays in sync.
  useEffect(() => {
    const hasValid = (id: string | undefined) => !!id && AVAILABLE_MODELS.some(m => m.id === id);
    const adminRaw = settings.adminChatModel || settings.chatModel;
    const customerRaw = settings.customerChatModel || settings.chatModel;
    const chatRaw = settings.chatModel;
    const needsAdmin = !hasValid(adminRaw);
    const needsCustomer = !hasValid(customerRaw);
    const needsChat = !hasValid(chatRaw);
    if (needsAdmin || needsCustomer || needsChat) {
      setSettings(prev => ({
        ...prev,
        ...(needsAdmin ? { adminChatModel: 'gpt-4.1-mini' } : {}),
        ...(needsCustomer ? { customerChatModel: 'gpt-4.1-mini' } : {}),
        ...(needsChat ? { chatModel: 'gpt-4.1-mini' } : {}),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage('Error: Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { setMessage('Error: Logo must be under 5MB'); return; }
    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setLogoPreview(dataUrl);
      try {
        const res = await adminFetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ logoDataUrl: dataUrl, logoFilename: file.name }),
        });
        if (res.ok) { setMessage('Logo updated successfully!'); }
        else { setMessage('Logo preview updated. Save settings to apply.'); }
      } catch { setMessage('Logo preview updated locally.'); }
      setLogoUploading(false);
      setTimeout(() => setMessage(''), 4000);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save settings');
      setMessage('Settings saved successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }

  function handleExportSettings() {
    const exportData = {
      ...settings,
      pageTitles,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `site-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setMessage('Settings exported successfully');
    setTimeout(() => setMessage(''), 3000);
  }

  function handlePageTitleChange(slug: string, newTitle: string) {
    setPageTitles((prev) =>
      prev.map((p) => (p.slug === slug ? { ...p, title: newTitle } : p))
    );
  }

  async function handlePageTitleSave(slug: string, newTitle: string) {
    try {
      const res = await adminFetch('/api/admin/pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, title: newTitle }),
      });
      if (res.ok) {
        setPageTitles(prev => prev.map(p => p.slug === slug ? { ...p, title: newTitle } : p));
        setEditingPage(null);
        setMessage('Page title saved');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      setMessage('Error: Failed to save page title');
    }
  }

  function renderModelSelector(
    label: string,
    description: string,
    fieldKey: 'adminChatModel' | 'customerChatModel',
    fallbackField: 'chatModel'
  ) {
    // If the stored value is not one of the models the admin chat route
    // supports (e.g., a legacy Claude/Gemini id left over from an earlier
    // UI revision), fall back to the chat route's default so the dropdown
    // always shows a valid selection that matches what the chat will use.
    // The mount-time useEffect above normalizes the underlying state in
    // step, so a subsequent Save will persist the valid value.
    const rawValue = settings[fieldKey] || settings[fallbackField] || 'gpt-4.1-mini';
    const currentValue = AVAILABLE_MODELS.some(m => m.id === rawValue) ? rawValue : 'gpt-4.1-mini';
    const currentModel = AVAILABLE_MODELS.find(m => m.id === currentValue);
    return (
      <div>
        <h4 className="text-sm font-semibold text-white mb-1">{label}</h4>
        <p className="text-white/40 text-xs mb-2">{description}</p>
        <select
          value={currentValue}
          onChange={(e) => setSettings({ ...settings, [fieldKey]: e.target.value })}
          className="w-full px-3 py-2.5 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23C9A84C' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', backgroundSize: '16px', paddingRight: '40px' }}
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.label} — {model.description}
            </option>
          ))}
        </select>
        {currentModel && (
          <p className="text-[10px] text-white/30 mt-1.5">
            Currently: <span className="text-[#C9A84C]">{currentModel.label}</span> — {currentModel.description}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-white mb-8">Settings</h2>
      {message && (
        <div className={`mb-4 px-4 py-2 rounded-sm text-sm ${message.startsWith('Error') ? 'bg-red-400/10 text-red-400' : 'bg-[#1BBFA1]/10 text-[#1BBFA1]'}`}>
          {message}
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        {/* Site Logo Upload */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Site Logo</h3>
          <p className="text-white/40 text-sm mb-4">Upload a new logo. Recommended: PNG with transparent background, min 512px wide.</p>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24 bg-black/50 border border-[#C9A84C]/20 rounded-sm flex items-center justify-center overflow-hidden">
              <Image src={logoPreview} alt="Current logo" fill className="object-contain p-2" unoptimized />
            </div>
            <div className="flex-1">
              <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoSelect} className="hidden" />
              <button type="button" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                className="px-5 py-2.5 bg-[#C9A84C]/20 border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold hover:bg-[#C9A84C]/30 transition-colors disabled:opacity-50">
                {logoUploading ? 'Uploading...' : 'Upload New Logo'}
              </button>
              <p className="text-white/40 text-xs mt-2">PNG, JPG or WebP. Max 5MB.</p>
            </div>
          </div>
        </div>

        {/* AI Model Configuration */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-6">AI Model Configuration</h3>
          <div className="space-y-8">
            {renderModelSelector(
              'Admin AI Agent',
              'The model used for internal admin tasks such as content generation, analytics summaries, and operational assistance.',
              'adminChatModel',
              'chatModel'
            )}
            <hr className="border-[#C9A84C]/10" />
            {renderModelSelector(
              'Customer-facing Chatbot',
              'The model that powers the public chatbot your visitors interact with on the website.',
              'customerChatModel',
              'chatModel'
            )}
          </div>
        </div>

        {/* Hero Content */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Hero Section</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Hero Title</label>
              <input type="text" value={settings.heroTitle} onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Hero Subtitle</label>
              <textarea value={settings.heroSubtitle} onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })} rows={2} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Highlight Video URL</label>
              <input
                type="text"
                value={settings.heroVideoUrl || ''}
                onChange={(e) => setSettings({ ...settings, heroVideoUrl: e.target.value })}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] placeholder-white/20"
              />
              <p className="text-[9px] text-white/25 mt-1">YouTube URL for the homepage highlight video. Leave empty to show placeholder.</p>
            </div>
          </div>
        </div>

        {/* Page Configuration */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Page Configuration</h3>
          <p className="text-white/40 text-sm mb-4">Rename page titles displayed in navigation and browser tabs.</p>
          <div className="space-y-2">
            {pageTitles.map((page) => (
              <div
                key={page.slug}
                className="flex items-center gap-3 p-3 rounded-sm border border-[#C9A84C]/20"
              >
                <span className="text-white/40 text-xs font-mono w-24 shrink-0">{page.slug}</span>
                {editingPage === page.slug ? (
                  <input
                    type="text"
                    value={page.title}
                    onChange={(e) => handlePageTitleChange(page.slug, e.target.value)}
                    onBlur={() => handlePageTitleSave(page.slug, page.title)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handlePageTitleSave(page.slug, page.title);
                    }}
                    autoFocus
                    className="flex-1 px-2 py-1 bg-[#0A0A0A] border border-[#C9A84C] rounded-sm text-white text-sm focus:outline-none"
                  />
                ) : (
                  <span className="flex-1 text-white text-sm">{page.title}</span>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (editingPage === page.slug) {
                      handlePageTitleSave(page.slug, page.title);
                    } else {
                      setEditingPage(page.slug);
                    }
                  }}
                  className="px-3 py-1 text-xs text-[#C9A84C] border border-[#C9A84C]/30 rounded-sm hover:bg-[#C9A84C]/10 transition-colors"
                >
                  {editingPage === page.slug ? 'Save' : 'Edit'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-white/40 mb-1">Email</label>
              <input type="email" value={settings.contactEmail} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-white/40 mb-1">Phone</label>
              <input type="text" value={settings.contactPhone} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="px-8 py-3 bg-[#C9A84C] text-white font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            type="button"
            onClick={handleExportSettings}
            className="px-6 py-3 bg-transparent border border-[#C9A84C]/40 text-[#C9A84C] font-semibold rounded-sm hover:bg-[#C9A84C]/10 transition-colors"
          >
            Export Settings as JSON
          </button>
        </div>
      </form>
    </div>
  );
}
