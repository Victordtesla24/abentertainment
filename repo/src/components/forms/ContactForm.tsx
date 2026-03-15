"use client";

import { useActionState } from "react";
import { submitContactInquiry } from "@/lib/actions/lead-actions";
import { initialActionState } from "@/lib/actions/form-state";

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(
    submitContactInquiry,
    initialActionState
  );

  const inputClassName =
    "w-full rounded-2xl border border-ivory/10 bg-charcoal px-5 py-4 font-body text-sm text-ivory placeholder:text-ivory/45 transition-colors duration-300 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/30";

  return (
    <form action={formAction} className="space-y-5 rounded-[2rem] border border-ivory/10 bg-charcoal-deep/70 p-8 backdrop-blur-sm">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/65">
            Full name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className={inputClassName}
          />
          {state.fieldErrors?.name ? (
            <p className="mt-2 font-body text-xs text-rose-300">
              {state.fieldErrors.name[0]}
            </p>
          ) : null}
        </div>
        <div>
          <label htmlFor="contact-email" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/65">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className={inputClassName}
          />
          {state.fieldErrors?.email ? (
            <p className="mt-2 font-body text-xs text-rose-300">
              {state.fieldErrors.email[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <div>
          <label htmlFor="contact-phone" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/65">
            Phone
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/65">
            Subject
          </label>
          <input
            id="contact-subject"
            name="subject"
            type="text"
            required
            className={inputClassName}
          />
          {state.fieldErrors?.subject ? (
            <p className="mt-2 font-body text-xs text-rose-300">
              {state.fieldErrors.subject[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/65">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          required
          className={`${inputClassName} resize-none`}
        />
        {state.fieldErrors?.message ? (
          <p className="mt-2 font-body text-xs text-rose-300">
            {state.fieldErrors.message[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 border-t border-ivory/10 pt-5 md:flex-row md:items-center md:justify-between">
        <p className="max-w-xl font-body text-sm text-ivory/45">
          Tell us whether you are reaching out about event bookings, partnerships, sponsorship, or media. The team replies from the details you provide here.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-gold px-8 py-3 font-body text-sm uppercase tracking-[0.2em] text-charcoal transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Sending..." : "Send inquiry"}
        </button>
      </div>

      {state.message ? (
        <p
          className={`font-body text-sm ${
            state.status === "success" ? "text-gold/80" : "text-rose-300"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
