'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { SITE_CONFIG } from '@/lib/constants';
import PageHero from '@/components/ui/PageHero';
import { getApiUrl } from '@/lib/api-config';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const CINEMATIC_EASE: [number, number, number, number] = [0.25, 1, 0.5, 1];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again later.');
      setStatus('error');
    }
  };

  return (
    <main className="bg-[#0A0A0A]">
      <PageHero
        image="/images/heroes/contact-hero.png"
        badge="Contact"
        title="Get in"
        highlight="Touch"
        subtitle="Whether you're interested in attending an event, exploring sponsorship opportunities, or simply want to connect"
      />

      {/* Form section */}
      <section className="py-16 md:py-20">
        <div className="container-eu">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: CINEMATIC_EASE }}
          >
            <p className="text-[rgba(255,255,255,0.4)] text-lg font-body max-w-2xl mb-8">
              We&apos;d love to hear from you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Form + Sidebar */}
      <section className="pb-24">
        <div className="container-eu">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 lg:gap-16">
            {/* Contact Form */}
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
                  <p className="text-[white] text-lg font-body mb-8">
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
                <form onSubmit={handleSubmit} className="space-y-6">
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
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        disabled={status === 'submitting'}
                        className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/20 text-white font-body placeholder-[rgba(255,255,255,0.4)] focus:outline-none focus:border-[#C9A84C] transition-all duration-300 disabled:opacity-50"
                        placeholder="Your name"
                      />
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
                        required
                        value={formData.email}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            email: e.target.value,
                          }))
                        }
                        disabled={status === 'submitting'}
                        className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/20 text-white font-body placeholder-[rgba(255,255,255,0.4)] focus:outline-none focus:border-[#C9A84C] transition-all duration-300 disabled:opacity-50"
                        placeholder="your@email.com"
                      />
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
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone: e.target.value,
                          }))
                        }
                        disabled={status === 'submitting'}
                        className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/20 text-white font-body placeholder-[rgba(255,255,255,0.4)] focus:outline-none focus:border-[#C9A84C] transition-all duration-300 disabled:opacity-50"
                        placeholder="Your phone number"
                      />
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
                        value={formData.subject}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            subject: e.target.value,
                          }))
                        }
                        disabled={status === 'submitting'}
                        className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/20 text-white font-body focus:outline-none focus:border-[#C9A84C] transition-all duration-300 disabled:opacity-50"
                      >
                        <option value="">Select a topic</option>
                        <option value="event-inquiry">Event Inquiry</option>
                        <option value="sponsorship">Sponsorship</option>
                        <option value="booking">Booking / Tickets</option>
                        <option value="press">Press & Media</option>
                        <option value="other">Other</option>
                      </select>
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
                      required
                      rows={6}
                      value={formData.message}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          message: e.target.value,
                        }))
                      }
                      disabled={status === 'submitting'}
                      className="w-full px-4 py-3 bg-[#111111]/50 border border-[#C9A84C]/20 text-white font-body placeholder-[rgba(255,255,255,0.4)] focus:outline-none focus:border-[#C9A84C] transition-all duration-300 resize-vertical disabled:opacity-50"
                      placeholder="Tell us about your inquiry..."
                    />
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

            {/* Contact Info Sidebar */}
            <motion.aside
              className="lg:col-span-2 space-y-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: CINEMATIC_EASE }}
            >
              <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8 space-y-6">
                <h3 className="text-xl font-display text-[#C9A84C] mb-4">
                  Contact Details
                </h3>

                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Phone
                  </p>
                  <a
                    href={`tel:${SITE_CONFIG.contact.phone}`}
                    className="text-[white] hover:text-[#C9A84C] transition-colors font-body font-medium"
                  >
                    {SITE_CONFIG.contact.phone}
                  </a>
                </div>

                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Email
                  </p>
                  <a
                    href={`mailto:${SITE_CONFIG.contact.email}`}
                    className="text-[white] hover:text-[#C9A84C] transition-colors font-body font-medium"
                  >
                    {SITE_CONFIG.contact.email}
                  </a>
                </div>

                <div>
                  <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">
                    Location
                  </p>
                  <address className="not-italic text-[white] leading-relaxed font-body">
                    {SITE_CONFIG.contact.address.city},{' '}
                    {SITE_CONFIG.contact.address.state}
                    <br />
                    {SITE_CONFIG.contact.address.country}
                  </address>
                </div>
              </div>

              <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8">
                <h3 className="text-xl font-display text-[#C9A84C] mb-4">
                  Office Hours
                </h3>
                <div className="space-y-2 text-sm font-body">
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.4)]">Monday - Friday</span>
                    <span className="text-[white]">9:00 AM - 6:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.4)]">Saturday</span>
                    <span className="text-[white]">10:00 AM - 4:00 PM</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[rgba(255,255,255,0.4)]">Sunday</span>
                    <span className="text-[white]">Closed</span>
                  </div>
                </div>
              </div>

              <div className="bg-[#111111]/40 border border-[#C9A84C]/10 p-8">
                <h3 className="text-xl font-display text-[#C9A84C] mb-4">
                  Follow Us
                </h3>
                <div className="flex gap-3">
                  <a
                    href={SITE_CONFIG.social.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 flex items-center justify-center border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white transition-all duration-300"
                    aria-label="Instagram"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                    </svg>
                  </a>
                  <a
                    href={SITE_CONFIG.social.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 flex items-center justify-center border border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C] hover:text-white transition-all duration-300"
                    aria-label="Facebook"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </a>
                </div>
              </div>
            </motion.aside>
          </div>
        </div>
      </section>
    </main>
  );
}
