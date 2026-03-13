"use client";

import { useActionState } from "react";
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
        className="mx-auto mt-4 flex max-w-md flex-col gap-3 sm:flex-row"
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
          className="flex-1 rounded-full border border-ivory/10 bg-charcoal px-6 py-3 font-body text-sm text-ivory placeholder:text-ivory/30 transition-colors duration-300 focus:border-gold/50 focus:outline-none focus:ring-1 focus:ring-gold/30"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full border border-gold/40 bg-gold/10 px-6 py-3 font-body text-sm uppercase tracking-wider text-gold transition-all duration-300 hover:bg-gold hover:text-charcoal disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Submitting..." : "Subscribe"}
        </button>
      </form>

      {state.message ? (
        <p
          className={`mt-3 font-body text-xs ${
            state.status === "success" ? "text-gold/80" : "text-rose-300"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
