"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function FooterNewsletter() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || status === "loading") {
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (res.ok && data.success) {
        setStatus("success");
        setMessage("You are on the list. Expect first access to season drops and premium updates.");
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Subscription failed. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  }

  return (
    <div className="stage-card rounded-[2rem] p-6 md:p-7">
      <p className="eyebrow-label">Stay In The Loop</p>
      <h3 className="mt-6 font-display text-3xl leading-tight text-charcoal dark:text-ivory">
        Early access to event announcements and curated cultural notes.
      </h3>
      <p className="mt-4 max-w-lg font-body text-sm leading-relaxed text-charcoal/58 dark:text-ivory/56">
        Subscribe for season launches, premium seating updates, and thoughtful program highlights from the AB Entertainment team.
      </p>

      {status === "success" ? (
        <p className="mt-6 rounded-[1.4rem] border border-gold/18 bg-gold/10 px-5 py-4 font-body text-sm leading-relaxed text-charcoal dark:text-ivory">
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4" aria-label="Newsletter subscription">
          <label htmlFor="footer-newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="footer-newsletter-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
            disabled={status === "loading"}
            aria-label="Email address"
            className="luxury-input"
          />
          <button
            type="submit"
            disabled={status === "loading"}
            className="button-primary glow-on-hover gold-shimmer w-full justify-center px-5 py-4 text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-60"
            data-magnetic
          >
            {status === "loading" ? "Joining..." : "Join The Guest List"}
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </form>
      )}

      {status === "error" ? (
        <p className="mt-4 rounded-[1.25rem] border border-rose-400/20 bg-rose-400/8 px-4 py-3 font-body text-sm text-rose-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
