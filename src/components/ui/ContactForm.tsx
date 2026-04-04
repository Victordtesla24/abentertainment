'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { getApiUrl } from '@/lib/api-config';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

const contactSchema = z.object({
  name: z.string().min(2, 'Please enter your full name (at least 2 characters)'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().optional(),
  subject: z.string().min(1, 'Please select a topic'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  // Honeypot fields — hidden from real users, filled by bots
  company: z.string().optional(),
  website: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function ContactForm() {
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      subject: '',
      message: '',
      company: '',
      website: '',
    },
  });

  const onSubmit = async (formData: ContactFormData) => {
    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(getApiUrl('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(
          data.error || 'Failed to send message. Please try again.'
        );
        setStatus('error');
        return;
      }

      setStatus('success');
      reset();
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again later.');
      setStatus('error');
    }
  };

  return (
    <motion.div
      className="lg:col-span-3"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.1, ease: CINEMATIC_EASE }}
    >
      {status === 'success' ? (
        <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 flex items-center justify-center border border-[#C9A84C]/30">
            <svg
              className="w-8 h-8 text-[#C9A84C]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-display text-[#C9A84C] mb-4">
            Message Sent
          </h2>
          <p className="text-white text-lg font-body mb-8">
            Thank you for reaching out. Our team will respond within 24
            hours.
          </p>
          <button
            onClick={() => setStatus('idle')}
            className="px-6 py-3 border border-[#C9A84C] text-[#C9A84C] font-semibold hover:bg-[#C9A84C] hover:text-white transition-all duration-300"
          >
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Honeypot fields — hidden from real users, filled by bots */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            <label htmlFor="contact-company">Company</label>
            <input
              id="contact-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...register('company')}
            />
            <label htmlFor="contact-website">Website</label>
            <input
              id="contact-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              {...register('website')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="contact-name"
                className="block text-xs font-medium text-[#C9A84C] mb-2 uppercase tracking-wider font-body"
              >
                Full Name
              </label>
              <input
                id="contact-name"
                type="text"
                {...register('name')}
                disabled={status === 'submitting'}
                className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/40 text-white font-body placeholder-white/40 focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/30 transition-all duration-300 disabled:opacity-50"
                placeholder="Your name"
              />
              {errors.name && (
                <p className="mt-1.5 text-xs text-red-400 font-body">{errors.name.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="contact-email"
                className="block text-xs font-medium text-[#C9A84C] mb-2 uppercase tracking-wider font-body"
              >
                Email Address
              </label>
              <input
                id="contact-email"
                type="email"
                {...register('email')}
                disabled={status === 'submitting'}
                className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/40 text-white font-body placeholder-white/40 focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/30 transition-all duration-300 disabled:opacity-50"
                placeholder="your@email.com"
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-red-400 font-body">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="contact-phone"
                className="block text-xs font-medium text-[#C9A84C] mb-2 uppercase tracking-wider font-body"
              >
                Phone (optional)
              </label>
              <input
                id="contact-phone"
                type="tel"
                {...register('phone')}
                disabled={status === 'submitting'}
                className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/40 text-white font-body placeholder-white/40 focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/30 transition-all duration-300 disabled:opacity-50"
                placeholder="Your phone number"
              />
              {errors.phone && (
                <p className="mt-1.5 text-xs text-red-400 font-body">{errors.phone.message}</p>
              )}
            </div>
            <div>
              <label
                htmlFor="contact-subject"
                className="block text-xs font-medium text-[#C9A84C] mb-2 uppercase tracking-wider font-body"
              >
                Subject
              </label>
              <select
                id="contact-subject"
                {...register('subject')}
                disabled={status === 'submitting'}
                className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/20 text-white font-body focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/30 transition-all duration-300 disabled:opacity-50"
              >
                <option value="">Select a topic</option>
                <option value="event-inquiry">Event Inquiry</option>
                <option value="sponsorship">Sponsorship</option>
                <option value="booking">Booking / Tickets</option>
                <option value="press">Press &amp; Media</option>
                <option value="other">Other</option>
              </select>
              {errors.subject && (
                <p className="mt-1.5 text-xs text-red-400 font-body">{errors.subject.message}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="contact-message"
              className="block text-xs font-medium text-[#C9A84C] mb-2 uppercase tracking-wider font-body"
            >
              Message
            </label>
            <textarea
              id="contact-message"
              rows={6}
              {...register('message')}
              disabled={status === 'submitting'}
              className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/40 text-white font-body placeholder-white/40 focus:outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/30 transition-all duration-300 resize-vertical disabled:opacity-50"
              placeholder="Tell us about your inquiry..."
            />
            {errors.message && (
              <p className="mt-1.5 text-xs text-red-400 font-body">{errors.message.message}</p>
            )}
          </div>

          {status === 'error' && (
            <div className="p-4 bg-red-900/20 border border-red-500/30">
              <p className="text-red-300 text-sm font-body">
                {errorMessage}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'submitting'}
            className="btn-accent px-8 py-3 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </motion.div>
  );
}
