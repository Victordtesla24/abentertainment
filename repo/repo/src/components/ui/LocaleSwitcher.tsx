'use client';

import { useState } from 'react';

const LOCALES = [
  { code: 'en', label: 'EN', fullLabel: 'English' },
  { code: 'mr', label: 'मर', fullLabel: 'मराठी' },
];

export function LocaleSwitcher({ currentLocale = 'en' }: { currentLocale?: string }) {
  const [switching, setSwitching] = useState(false);

  async function switchLocale(locale: string) {
    if (switching || locale === currentLocale) return;
    setSwitching(true);
    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  return (
    <div className="flex items-center gap-1" aria-label="Language switcher">
      {LOCALES.map((loc, i) => (
        <span key={loc.code} className="flex items-center gap-1">
          {i > 0 && <span className="text-ivory/20 text-xs">|</span>}
          <button
            onClick={() => switchLocale(loc.code)}
            disabled={switching}
            aria-label={`Switch to ${loc.fullLabel}`}
            aria-pressed={currentLocale === loc.code}
            className={`font-body text-xs transition-colors ${
              currentLocale === loc.code
                ? 'text-gold cursor-default'
                : 'text-ivory/40 hover:text-ivory/80'
            } disabled:opacity-50`}
          >
            {loc.label}
          </button>
        </span>
      ))}
    </div>
  );
}
