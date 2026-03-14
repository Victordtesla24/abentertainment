"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { submitContactInquiry } from "@/lib/actions/lead-actions";
import { initialActionState } from "@/lib/actions/form-state";

const INQUIRY_OPTIONS = [
  "Event Booking",
  "Sponsor Partnership",
  "Private Production",
  "Media & Press",
  "General Enquiry",
];

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(
    submitContactInquiry,
    initialActionState
  );

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-[2rem] border border-ivory/10 bg-charcoal-deep/68 p-6 backdrop-blur-xl md:p-8"
    >
      <div>
        <p className="numeric-label !text-gold/66">Enquiry Form</p>
        <h3 className="mt-3 font-display text-3xl leading-tight text-ivory">
          Tell us how you would like to work with AB Entertainment.
        </h3>
        <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-ivory/52">
          We route every message based on your enquiry type so the right team member can respond quickly and with context.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label htmlFor="contact-name" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
            Full name
          </label>
          <input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="luxury-input"
          />
          {state.fieldErrors?.name ? (
            <p className="mt-2 font-body text-xs text-rose-300">
              {state.fieldErrors.name[0]}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="contact-email" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
            Email
          </label>
          <input
            id="contact-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="luxury-input"
          />
          {state.fieldErrors?.email ? (
            <p className="mt-2 font-body text-xs text-rose-300">
              {state.fieldErrors.email[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <label htmlFor="contact-phone" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
            Phone
          </label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="luxury-input"
          />
        </div>

        <div>
          <label htmlFor="contact-subject" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
            Enquiry type
          </label>
          <select
            id="contact-subject"
            name="subject"
            defaultValue=""
            required
            className="luxury-input"
          >
            <option value="" disabled>
              Select an enquiry route
            </option>
            {INQUIRY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {state.fieldErrors?.subject ? (
            <p className="mt-2 font-body text-xs text-rose-300">
              {state.fieldErrors.subject[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <label htmlFor="contact-message" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          rows={7}
          required
          className="luxury-input resize-none"
          placeholder="Tell us about your event, preferred dates, audience size, sponsorship idea, or anything else that will help us respond thoughtfully."
        />
        {state.fieldErrors?.message ? (
          <p className="mt-2 font-body text-xs text-rose-300">
            {state.fieldErrors.message[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-[1.6rem] border border-ivory/10 bg-ivory/5 p-5 md:flex-row md:items-center md:justify-between">
        <p className="max-w-2xl font-body text-sm leading-relaxed text-ivory/46">
          We reply to bookings, sponsorship, media, and private production enquiries from the details you provide here.
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="button-primary glow-on-hover gold-shimmer justify-center px-6 py-4 text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-60"
          data-magnetic
        >
          {isPending ? "Sending..." : "Send Enquiry"}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {state.message ? (
        <p
          className={`rounded-[1.25rem] px-4 py-3 font-body text-sm ${
            state.status === "success"
              ? "border border-gold/18 bg-gold/10 text-gold"
              : "border border-rose-400/20 bg-rose-400/8 text-rose-300"
          }`}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
