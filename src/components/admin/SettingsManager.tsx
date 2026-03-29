'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState, useRef, FormEvent } from 'react';
import Image from 'next/image';
import type { SiteSettings } from '@/lib/data';

interface SettingsManagerProps {
  initialSettings: SiteSettings;
}

const AVAILABLE_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o (Default)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
];

export default function SettingsManager({ initialSettings }: SettingsManagerProps) {
  const [settings, setSettings] = useState<SiteSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState('/images/AB_Logo_transparent.png');
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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
        const res = await fetch(getApiUrl('/api/admin/settings'), {
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
      const res = await fetch(getApiUrl('/api/admin/settings'), {
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
          <p className="text-[white/40] text-sm mb-4">Upload a new logo. Recommended: PNG with transparent background, min 512px wide.</p>
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
              <p className="text-[white/40] text-xs mt-2">PNG, JPG or WebP. Max 5MB.</p>
            </div>
          </div>
        </div>
        {/* AI Model Selection */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Customer Chatbot Model</h3>
          <p className="text-[white/40] text-sm mb-4">Select which OpenAI model powers the customer-facing chatbot.</p>
          <div className="space-y-2">
            {AVAILABLE_MODELS.map((model) => (
              <label key={model.id} className={`flex items-center gap-3 p-3 rounded-sm border cursor-pointer transition-colors ${settings.chatModel === model.id ? 'border-[#C9A84C] bg-[#C9A84C]/10' : 'border-[#C9A84C]/20 hover:border-[#C9A84C]/40'}`}>
                <input type="radio" name="chatModel" value={model.id} checked={settings.chatModel === model.id} onChange={(e) => setSettings({ ...settings, chatModel: e.target.value })} className="accent-[#C9A84C]" />
                <span className="text-white text-sm">{model.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Hero Content */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Hero Section</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[white/40] mb-1">Hero Title</label>
              <input type="text" value={settings.heroTitle} onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Hero Subtitle</label>
              <textarea value={settings.heroSubtitle} onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })} rows={2} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C] resize-none" />
            </div>
          </div>
        </div>
        {/* Contact Info */}
        <div className="bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm p-6 mb-6">
          <h3 className="text-lg font-display font-semibold text-[#C9A84C] mb-4">Contact Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[white/40] mb-1">Email</label>
              <input type="email" value={settings.contactEmail} onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div>
              <label className="block text-xs text-[white/40] mb-1">Phone</label>
              <input type="text" value={settings.contactPhone} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value })} className="w-full px-3 py-2 bg-[#0A0A0A] border border-[#C9A84C]/20 rounded-sm text-white text-sm focus:outline-none focus:border-[#C9A84C]" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saving} className="px-8 py-3 bg-[#C9A84C] text-white font-semibold rounded-sm hover:bg-[#D4B65C] transition-colors disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
