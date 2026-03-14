"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { beginBookingCheckout } from "@/lib/actions/booking-actions";
import { initialActionState } from "@/lib/actions/form-state";

interface BookingCheckoutFormProps {
  eventSlug: string;
  mode: "checkout" | "request";
}

export function BookingCheckoutForm({
  eventSlug,
  mode,
}: BookingCheckoutFormProps) {
  const [state, formAction, isPending] = useActionState(
    beginBookingCheckout,
    initialActionState
  );
  const isRequestMode = mode === "request";

  return (
    <form
      action={formAction}
      className="space-y-5 rounded-[2rem] border border-gold/14 bg-charcoal-deep/72 p-5 backdrop-blur-xl"
    >
      <input type="hidden" name="eventSlug" value={eventSlug} />

      <div>
        <p className="numeric-label !text-gold/66">Booking Concierge</p>
        <p className="mt-3 font-display text-2xl leading-tight text-ivory">
          Reserve your seats with a premium, low-friction checkout flow.
        </p>
      </div>

      <div>
        <label htmlFor={`booking-name-${eventSlug}`} className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
          Full name
        </label>
        <input
          id={`booking-name-${eventSlug}`}
          name="customerName"
          type="text"
          autoComplete="name"
          required
          className="luxury-input"
        />
        {state.fieldErrors?.customerName ? (
          <p className="mt-2 font-body text-xs text-rose-300">
            {state.fieldErrors.customerName[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`booking-email-${eventSlug}`} className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
          Email
        </label>
        <input
          id={`booking-email-${eventSlug}`}
          name="customerEmail"
          type="email"
          autoComplete="email"
          required
          className="luxury-input"
        />
        {state.fieldErrors?.customerEmail ? (
          <p className="mt-2 font-body text-xs text-rose-300">
            {state.fieldErrors.customerEmail[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`booking-quantity-${eventSlug}`} className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-ivory/40">
          Quantity
        </label>
        <select
          id={`booking-quantity-${eventSlug}`}
          name="quantity"
          defaultValue="1"
          className="luxury-input"
        >
          {[1, 2, 3, 4, 5, 6].map((quantity) => (
            <option key={quantity} value={quantity}>
              {quantity} ticket{quantity > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-[1.4rem] border border-ivory/10 bg-ivory/5 p-4">
        <p className="font-body text-xs uppercase tracking-[0.22em] text-gold/72">
          {isRequestMode ? "Reservation Request" : "Secure Checkout"}
        </p>
        <p className="mt-2 font-body text-sm leading-relaxed text-ivory/52">
          {isRequestMode
            ? "Submit your request and the AB Entertainment team will confirm availability, payment details, and next steps."
            : "Complete payment through Stripe Checkout with a flow designed to keep the experience calm, fast, and secure."}
        </p>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="button-primary glow-on-hover gold-shimmer w-full justify-center px-6 py-4 text-[0.68rem] disabled:cursor-not-allowed disabled:opacity-60"
        data-magnetic
      >
        {isPending
          ? isRequestMode
            ? "Sending Request..."
            : "Preparing Checkout..."
          : isRequestMode
            ? "Request Reservation"
            : "Book With Stripe"}
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
      </button>

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
