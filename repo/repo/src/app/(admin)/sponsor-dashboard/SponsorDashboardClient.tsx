'use client';

import { useState, useRef } from 'react';

const TIERS = [
  { value: 'platinum', label: 'Platinum', price: '$10,000+' },
  { value: 'gold', label: 'Gold', price: '$5,000+' },
  { value: 'silver', label: 'Silver', price: '$2,000+' },
  { value: 'community', label: 'Community', price: '$500+' },
];

export function SponsorDashboardClient({ firstName }: { firstName: string }) {
  const [tier, setTier] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!tier) {
      setSaveResult({ success: false, message: 'Please select a sponsorship tier before saving.' });
      return;
    }

    setSaving(true);
    setSaveResult(null);

    const formData = new FormData();
    formData.append('tier', tier);
    if (logoFile) {
      formData.append('logo', logoFile);
    }

    try {
      const res = await fetch('/api/sponsor/save', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        setSaveResult({ success: true, message: data.message ?? 'Changes saved successfully.' });
      } else {
        setSaveResult({ success: false, message: data.error ?? 'Failed to save changes.' });
      }
    } catch {
      setSaveResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="font-playfair text-4xl text-gold">Sponsor Dashboard</h1>

        <div className="bg-charcoal/50 border border-gold/20 rounded-2xl p-8">
          <h2 className="font-satoshi text-2xl text-ivory mb-2">
            Welcome back, {firstName || 'Partner'}
          </h2>
          <p className="text-ivory/60 mb-8 font-body text-sm">
            Manage your sponsorship tier, assets, and view analytics here.
          </p>

          {/* Analytics cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-charcoal rounded-xl p-6 border border-gold/10 hover:border-gold/40 transition-colors">
              <h3 className="font-playfair text-xl text-gold mb-2">Active Tier</h3>
              <p className="text-2xl font-satoshi text-ivory capitalize">
                {tier || 'Not Selected'}
              </p>
            </div>
            <div className="bg-charcoal rounded-xl p-6 border border-gold/10 hover:border-gold/40 transition-colors">
              <h3 className="font-playfair text-xl text-gold mb-2">Total Impressions</h3>
              <p className="text-3xl font-jetbrainsMono text-ivory">—</p>
            </div>
            <div className="bg-charcoal rounded-xl p-6 border border-gold/10 hover:border-gold/40 transition-colors">
              <h3 className="font-playfair text-xl text-gold mb-2">Clicks</h3>
              <p className="text-3xl font-jetbrainsMono text-ivory">—</p>
            </div>
          </div>

          {/* Management section */}
          <div className="space-y-6">
            <h3 className="font-playfair text-2xl text-ivory border-b border-ivory/10 pb-4">
              Manage Sponsorship
            </h3>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h4 className="font-satoshi text-lg text-gold">Select Tier</h4>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full rounded-xl border border-ivory/10 bg-charcoal px-4 py-3 font-body text-sm text-ivory focus:border-gold/40 focus:outline-none"
                >
                  <option value="">Choose a tier...</option>
                  {TIERS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label} ({t.price})
                    </option>
                  ))}
                </select>

                <h4 className="font-satoshi text-lg text-gold mt-6">Upload Company Logo</h4>
                <div
                  className="border border-dashed border-ivory/20 rounded-xl p-6 text-center bg-charcoal/30 cursor-pointer hover:border-gold/40 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    id="logo-upload"
                    accept="image/svg+xml,image/png,image/jpeg,image/webp"
                    onChange={handleLogoChange}
                  />
                  <span className="block text-sm text-ivory/60 mb-2">SVG, PNG, or high-res JPEG</span>
                  <span className="inline-block rounded-full bg-ivory/10 px-4 py-2 text-xs font-semibold text-ivory uppercase tracking-widest hover:bg-gold hover:text-charcoal transition-colors">
                    {logoFile ? logoFile.name : 'Browse Files'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-satoshi text-lg text-gold">Placement Preview</h4>
                <div className="aspect-[4/3] rounded-xl border border-ivory/10 bg-charcoal flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                  {logoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="max-h-24 max-w-full object-contain mb-4"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-ivory/5 mb-4 animate-pulse" />
                  )}
                  <p className="text-sm font-satoshi text-ivory/40">
                    {logoPreview && tier
                      ? `${tier.charAt(0).toUpperCase() + tier.slice(1)} sponsor placement — AB Entertainment styled banner will be generated upon saving.`
                      : 'Upload your logo and select a tier to see AI-generated banner previews in AB Entertainment styling.'}
                  </p>
                </div>

                {/* Save result feedback */}
                {saveResult && (
                  <p
                    className={`text-sm font-body px-4 py-3 rounded-xl border ${
                      saveResult.success
                        ? 'text-green-400 border-green-400/30 bg-green-400/5'
                        : 'text-red-400 border-red-400/30 bg-red-400/5'
                    }`}
                  >
                    {saveResult.message}
                  </p>
                )}

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full mt-4 rounded-full bg-gold px-6 py-3 text-center font-body text-sm font-semibold uppercase tracking-[0.2em] text-charcoal transition-all hover:bg-gold/80 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tier benefits reference */}
        <div className="bg-charcoal/30 border border-ivory/10 rounded-2xl p-8">
          <h3 className="font-playfair text-xl text-gold mb-6">Sponsorship Tier Benefits</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm font-body text-ivory/60">
            {TIERS.map((t) => (
              <div key={t.value} className="flex gap-3">
                <span className="text-gold font-semibold capitalize min-w-[80px]">{t.label}</span>
                <span>{t.price} — Logo on homepage, event pages, printed programs, and digital assets.</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
