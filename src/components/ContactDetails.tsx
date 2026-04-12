'use client';

import { useState, useEffect } from 'react';
import { SITE_CONFIG } from '@/lib/constants';

export default function ContactDetails() {
  const [email, setEmail] = useState(SITE_CONFIG.contact.email);
  const [phone, setPhone] = useState(SITE_CONFIG.contact.phone);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.contactEmail) setEmail(data.contactEmail);
        if (data?.contactPhone) setPhone(data.contactPhone);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="bg-[#111111]/40 border border-[#C9A84C]/40 p-8 space-y-6">
      <h3 className="text-xl font-display text-[#C9A84C] mb-4">Contact Details</h3>

      <div>
        <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Phone</p>
        <a href={`tel:${phone}`} className="text-white hover:text-[#C9A84C] transition-colors font-body font-medium">
          {phone}
        </a>
      </div>

      <div>
        <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Email</p>
        <a href={`mailto:${email}`} className="text-white hover:text-[#C9A84C] transition-colors font-body font-medium">
          {email}
        </a>
      </div>

      <div>
        <p className="text-xs text-[#C9A84C]/60 uppercase tracking-[0.2em] mb-1 font-body">Location</p>
        <address className="not-italic text-white leading-relaxed font-body">
          {SITE_CONFIG.contact.address.city}, {SITE_CONFIG.contact.address.state}
          <br />
          {SITE_CONFIG.contact.address.country}
        </address>
      </div>
    </div>
  );
}
