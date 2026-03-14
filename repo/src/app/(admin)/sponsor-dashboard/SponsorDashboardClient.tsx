"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Palette,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

const TIERS = [
  {
    value: "platinum",
    label: "Platinum",
    price: "$10,000+",
    summary: "Headline placement, VIP hospitality, naming-rights moments, and premium brand integration.",
    impressions: "148K",
    clicks: "4.7%",
    reach: "Premium hero placement",
  },
  {
    value: "gold",
    label: "Gold",
    price: "$5,000+",
    summary: "Prominent event visibility, reserved seating, sponsor content placement, and social amplification.",
    impressions: "96K",
    clicks: "3.8%",
    reach: "Program and event page priority",
  },
  {
    value: "silver",
    label: "Silver",
    price: "$2,000+",
    summary: "Consistent brand presence across event pages, digital programs, and post-event recap content.",
    impressions: "62K",
    clicks: "2.9%",
    reach: "Cross-channel sponsor visibility",
  },
  {
    value: "community",
    label: "Community",
    price: "$500+",
    summary: "Community-facing placement in program materials, sponsor acknowledgement, and targeted visibility.",
    impressions: "28K",
    clicks: "2.1%",
    reach: "Program listing and social acknowledgement",
  },
] as const;

const PLACEMENT_ZONES = [
  "Homepage hero ribbon",
  "Lead event modules",
  "Digital programs and recap assets",
  "Sponsor spotlight callouts",
];

export function SponsorDashboardClient({ firstName }: { firstName: string }) {
  const [tier, setTier] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const activeTier = TIERS.find((item) => item.value === tier) ?? TIERS[0];

  function handleLogoChange(file: File | null) {
    if (!file) {
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();
    reader.onload = (event) => setLogoPreview(event.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!tier) {
      setSaveResult({
        success: false,
        message: "Select a sponsorship tier before saving your partner profile.",
      });
      return;
    }

    setSaving(true);
    setSaveResult(null);

    const formData = new FormData();
    formData.append("tier", tier);

    if (logoFile) {
      formData.append("logo", logoFile);
    }

    try {
      const res = await fetch("/api/sponsor/save", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json()) as {
        success?: boolean;
        message?: string;
        error?: string;
      };

      if (res.ok && data.success) {
        setSaveResult({
          success: true,
          message: data.message ?? "Partner profile updated successfully.",
        });
      } else {
        setSaveResult({
          success: false,
          message: data.error ?? "Unable to save your sponsor profile.",
        });
      }
    } catch {
      setSaveResult({
        success: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stage-shell min-h-screen bg-charcoal-deep pb-24">
      <div className="relative overflow-hidden px-6 pb-14 pt-32 md:pt-40">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(201,168,76,0.16),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(107,29,58,0.2),transparent_24%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 xl:grid-cols-[1fr_0.92fr]">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="eyebrow-label"
            >
              Sponsor Portal
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 max-w-4xl font-display text-[clamp(3rem,6vw,5.4rem)] leading-[0.94] text-ivory"
            >
              Partner command suite for premium event placement and sponsor ROI.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 max-w-2xl font-body text-base leading-relaxed text-ivory/58 md:text-lg"
            >
              Welcome back, {firstName || "Partner"}. Update your tier, upload brand assets, preview AB-styled placements, and track how your sponsorship appears across the digital theatre.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="stage-card-dark rounded-[2.2rem] p-6 md:p-8"
          >
            <p className="eyebrow-label">Partner Snapshot</p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Impressions</p>
                <p className="mt-2 font-display text-2xl text-gold">{activeTier.impressions}</p>
              </div>
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">CTR</p>
                <p className="mt-2 font-display text-2xl text-gold">{activeTier.clicks}</p>
              </div>
              <div className="stat-chip rounded-[1.3rem] p-4 text-center">
                <p className="numeric-label">Placement</p>
                <p className="mt-2 font-display text-2xl text-gold">Live</p>
              </div>
            </div>
            <p className="mt-7 font-body text-sm leading-relaxed text-ivory/52">
              The portal should reassure partners immediately: refined placement logic, strong visibility, and clear outcomes tied to the selected tier.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 px-6 xl:grid-cols-[0.98fr_1.02fr] lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          <div className="stage-card-dark rounded-[2.4rem] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="numeric-label !text-gold/66">Tier Selection</p>
                <p className="mt-3 font-display text-3xl leading-tight text-ivory">
                  Choose the sponsorship tier that best matches your visibility goals.
                </p>
              </div>
              <div className="rounded-full border border-gold/16 bg-gold/10 px-4 py-2 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/76">
                {tier ? `${activeTier.label} selected` : "Selection required"}
              </div>
            </div>

            <div className="mt-7 grid gap-4">
              {TIERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setTier(option.value)}
                  className={`rounded-[1.7rem] border p-5 text-left transition-all duration-300 ${
                    tier === option.value
                      ? "border-gold/28 bg-gold/10 shadow-[0_18px_40px_-30px_rgba(201,168,76,0.45)]"
                      : "border-ivory/10 bg-ivory/5 hover:border-gold/16"
                  }`}
                  data-magnetic
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl text-ivory">{option.label}</p>
                      <p className="mt-1 font-body text-xs uppercase tracking-[0.24em] text-gold/74">
                        {option.price}
                      </p>
                    </div>
                    {tier === option.value ? (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/18 bg-gold text-charcoal">
                        <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-4 font-body text-sm leading-relaxed text-ivory/56">
                    {option.summary}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div className="stage-card-dark rounded-[2.4rem] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="numeric-label !text-gold/66">Brand Assets</p>
                <p className="mt-3 font-display text-3xl leading-tight text-ivory">
                  Upload your logo to preview AB-styled sponsor treatments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="button-secondary px-5 py-3 text-[0.68rem]"
                data-magnetic
              >
                <Upload className="h-3.5 w-3.5" strokeWidth={1.8} />
                Browse Files
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              className="hidden"
              id="logo-upload"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              onChange={(event) => handleLogoChange(event.target.files?.[0] ?? null)}
            />

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-7 flex w-full flex-col items-center justify-center rounded-[2rem] border border-dashed border-ivory/16 bg-ivory/5 px-6 py-12 text-center transition-all duration-300 hover:border-gold/22 hover:bg-ivory/7"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                <Upload className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <p className="mt-5 font-display text-2xl text-ivory">
                {logoFile ? logoFile.name : "Drop in your logo or browse assets"}
              </p>
              <p className="mt-3 max-w-xl font-body text-sm leading-relaxed text-ivory/52">
                SVG, PNG, or high-resolution JPG. The portal uses this upload to preview sponsor placement and generate AB-themed banner treatments.
              </p>
            </button>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-6"
        >
          <div className="stage-card rounded-[2.4rem] p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="numeric-label !text-gold/66">Placement Preview</p>
                <p className="mt-3 font-display text-3xl leading-tight text-charcoal dark:text-ivory">
                  Live AB Entertainment styling for the selected sponsor tier.
                </p>
              </div>
              <div className="rounded-full border border-gold/16 bg-gold/10 px-4 py-2 font-body text-[0.58rem] uppercase tracking-[0.3em] text-gold/76">
                {activeTier.label} Sponsor
              </div>
            </div>

            <div className="mt-7 overflow-hidden rounded-[2.2rem] border border-gold/14 bg-charcoal shadow-[0_30px_90px_-50px_rgba(0,0,0,0.5)]">
              <div className="relative h-[20rem] bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(107,29,58,0.22),transparent_30%),linear-gradient(180deg,rgba(14,13,16,0.9),rgba(26,26,26,1))] p-6 md:p-8">
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:88px_88px] opacity-30" />
                <div className="relative flex h-full flex-col justify-between">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="numeric-label !text-gold/68">Sponsor Highlight</p>
                      <p className="mt-3 max-w-md font-display text-3xl leading-tight text-ivory md:text-[2.4rem]">
                        {activeTier.label} placement aligned to the AB season design system.
                      </p>
                    </div>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                      <Sparkles className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                  </div>

                  <div className="rounded-[1.8rem] border border-ivory/10 bg-ivory/5 p-5 backdrop-blur-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="numeric-label !text-gold/66">Brand Lockup</p>
                        <div className="mt-3 flex items-center gap-4">
                          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.4rem] border border-gold/18 bg-charcoal">
                            {logoPreview ? (
                              <Image
                                src={logoPreview}
                                alt="Sponsor logo preview"
                                width={80}
                                height={80}
                                unoptimized
                                className="h-full w-full object-contain p-3"
                              />
                            ) : (
                              <span className="font-display text-2xl text-gold">SB</span>
                            )}
                          </div>
                          <div>
                            <p className="font-display text-3xl text-ivory">Your Brand</p>
                            <p className="mt-2 font-body text-xs uppercase tracking-[0.24em] text-gold/74">
                              {activeTier.price}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-[1.4rem] border border-gold/16 bg-gold/10 px-4 py-3">
                        <p className="font-body text-xs uppercase tracking-[0.22em] text-gold/76">
                          Placement Reach
                        </p>
                        <p className="mt-2 font-display text-2xl text-ivory">{activeTier.reach}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="stat-chip rounded-[1.6rem] p-5">
                <p className="numeric-label !text-gold/66">Visibility</p>
                <p className="mt-3 font-display text-2xl leading-tight text-charcoal dark:text-ivory">
                  {activeTier.impressions} projected impressions
                </p>
              </div>
              <div className="stat-chip rounded-[1.6rem] p-5">
                <p className="numeric-label !text-gold/66">Engagement</p>
                <p className="mt-3 font-display text-2xl leading-tight text-charcoal dark:text-ivory">
                  {activeTier.clicks} click-through rate benchmark
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="stage-card-dark rounded-[2rem] p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                  <BarChart3 className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="numeric-label !text-gold/66">Placement Zones</p>
                  <p className="mt-1 font-display text-2xl text-ivory">Live brand surfaces</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {PLACEMENT_ZONES.map((zone, index) => (
                  <div
                    key={zone}
                    className="rounded-[1.35rem] border border-ivory/10 bg-ivory/5 px-4 py-4"
                  >
                    <p className="numeric-label !text-gold/66">0{index + 1}</p>
                    <p className="mt-2 font-body text-sm leading-relaxed text-ivory/56">
                      {zone}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="stage-card-dark rounded-[2rem] p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/18 bg-gold/10 text-gold">
                  <TrendingUp className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="numeric-label !text-gold/66">Quarterly ROI</p>
                  <p className="mt-1 font-display text-2xl text-ivory">AI insight summary</p>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-[1.35rem] border border-ivory/10 bg-ivory/5 p-4">
                  <p className="font-body text-xs uppercase tracking-[0.22em] text-gold/72">
                    Recommendation
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-ivory/56">
                    Increase lead-event placement around the next flagship announcement to amplify sponsor recall and click-through.
                  </p>
                </div>
                <div className="rounded-[1.35rem] border border-ivory/10 bg-ivory/5 p-4">
                  <p className="font-body text-xs uppercase tracking-[0.22em] text-gold/72">
                    Best Performing Surface
                  </p>
                  <p className="mt-2 font-body text-sm leading-relaxed text-ivory/56">
                    Lead event modules outperform standard sponsor strips due to stronger storytelling and warmer visual context.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="stage-card-dark rounded-[2rem] p-6 md:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="numeric-label !text-gold/66">Partner Controls</p>
                <p className="mt-3 max-w-3xl font-display text-2xl leading-tight text-ivory md:text-3xl">
                  Save your current tier and asset selection to update the sponsor profile.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2 font-body text-[0.62rem] uppercase tracking-[0.24em] text-ivory/56">
                  <Palette className="h-3.5 w-3.5 text-gold" strokeWidth={1.8} />
                  Brand-safe preview
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-ivory/10 bg-ivory/5 px-4 py-2 font-body text-[0.62rem] uppercase tracking-[0.24em] text-ivory/56">
                  <ShieldCheck className="h-3.5 w-3.5 text-gold" strokeWidth={1.8} />
                  Secure profile save
                </div>
              </div>
            </div>

            {saveResult ? (
              <p
                className={`mt-6 rounded-[1.4rem] px-4 py-3 font-body text-sm ${
                  saveResult.success
                    ? "border border-emerald-400/20 bg-emerald-400/8 text-emerald-300"
                    : "border border-rose-400/20 bg-rose-400/8 text-rose-300"
                }`}
              >
                {saveResult.message}
              </p>
            ) : null}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="button-primary glow-on-hover gold-shimmer mt-6 w-full justify-center px-6 py-4 text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-60"
              data-magnetic
            >
              {saving ? "Saving Profile..." : "Save Sponsor Profile"}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
