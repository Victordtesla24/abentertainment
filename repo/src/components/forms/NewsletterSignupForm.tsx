"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { subscribeToNewsletter } from "@/lib/actions/lead-actions";
import { initialActionState } from "@/lib/actions/form-state";

export function NewsletterSignupForm() {
  const [state, formAction, isPending] = useActionState(
    subscribeToNewsletter,
    initialActionState
  );

  return (
    <div>
      <form
        action={formAction}
        className="mx-auto mt-5 flex max-w-xl flex-col gap-3 sm:flex-row"
        aria-label="Newsletter signup"
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          placeholder="Enter your email"
          autoComplete="email"
          required
          className="luxury-input flex-1"
        />
        <button
          type="submit"
          disabled={isPending}
          className="button-primary glow-on-hover gold-shimmer justify-center px-5 py-4 text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-60"
          data-magnetic
        >
          {isPending ? "Submitting..." : "Subscribe"}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </form>

      {state.message ? (
        <p
          className={`mt-4 rounded-[1.2rem] px-4 py-3 font-body text-sm ${
            state.status === "success"
              ? "border border-gold/18 bg-gold/10 text-charcoal dark:text-ivory"
              : "border border-rose-400/20 bg-rose-400/8 text-rose-300"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
