"use client";

import { useActionState } from "react";
import { beginBookingCheckout } from "@/lib/actions/booking-actions";
import { initialActionState } from "@/lib/actions/form-state";

interface BookingCheckoutFormProps {
  eventSlug: string;
}

export function BookingCheckoutForm({ eventSlug }: BookingCheckoutFormProps) {
  const [state, formAction, isPending] = useActionState(
    beginBookingCheckout,
    initialActionState
  );

  const fieldClassName =
    "w-full rounded-2xl border border-ivory/10 bg-charcoal px-4 py-3 font-body text-sm text-ivory placeholder:text-ivory/30 transition-colors duration-300 focus:border-gold/40 focus:outline-none focus:ring-1 focus:ring-gold/30";

  return (
    <form action={formAction} className="space-y-4 rounded-2xl border border-gold/15 bg-charcoal-deep/70 p-5">
      <input type="hidden" name="eventSlug" value={eventSlug} />

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
          className={fieldClassName}
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
          className={fieldClassName}
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
          className={fieldClassName}
        >
          {[1, 2, 3, 4, 5, 6].map((quantity) => (
            <option key={quantity} value={quantity}>
              {quantity} ticket{quantity > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="block w-full rounded-full bg-gold px-6 py-3 text-center font-body text-sm font-semibold uppercase tracking-[0.2em] text-charcoal transition-colors hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Preparing checkout..." : "Book with Stripe"}
      </button>

      <p className="font-body text-xs text-ivory/35">
        You will be redirected to Stripe Checkout to complete payment securely.
      </p>

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
