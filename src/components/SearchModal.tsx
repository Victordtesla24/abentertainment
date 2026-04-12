'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import Fuse, { type IFuseOptions, type FuseResult } from 'fuse.js';
import FocusTrap from 'focus-trap-react';
// Bundled fallback for offline/build-time; live data fetched from API on open
let eventsDataFallback: unknown[] = [];
try { eventsDataFallback = require('../../data/events.json'); } catch { /* static import may fail in some contexts */ }

interface SearchableEvent {
  id: string;
  title: string;
  slug: string;
  date: string;
  venue: string;
  description: string;
  category: string;
  image: string;
  price: number;
  currency: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const fuseOptions: IFuseOptions<SearchableEvent> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'date', weight: 0.1 },
    { name: 'venue', weight: 0.15 },
    { name: 'category', weight: 0.15 },
  ],
  threshold: 0.4,
  includeScore: true,
  minMatchCharLength: 2,
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-AU', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<SearchableEvent[]>([]);
  const [results, setResults] = useState<FuseResult<SearchableEvent>[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch live events from API, fall back to bundled JSON
  useEffect(() => {
    if (!isOpen || events.length > 0) return;
    fetch('/api/events')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setEvents(data as SearchableEvent[]);
        else setEvents(eventsDataFallback as unknown as SearchableEvent[]);
      })
      .catch(() => setEvents(eventsDataFallback as unknown as SearchableEvent[]));
  }, [isOpen, events.length]);

  // Search with Fuse.js
  useEffect(() => {
    if (!query.trim() || events.length === 0) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }

    const fuse = new Fuse(events, fuseOptions);
    const searchResults = fuse.search(query);
    setResults(searchResults.slice(0, 8));
    setSelectedIndex(0);
  }, [query, events]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the modal is rendered
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
  }, [isOpen]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Scroll selected result into view during keyboard navigation
  useEffect(() => {
    if (results[selectedIndex]) {
      const el = document.getElementById(
        `search-result-${results[selectedIndex].item.id}`
      );
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, results]);

  const navigateToResult = useCallback(
    (slug: string) => {
      onClose();
      router.push(`/events/${slug}`);
    },
    [onClose, router]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            navigateToResult(results[selectedIndex].item.slug);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, navigateToResult, onClose]
  );

  // Global Escape key handler (Cmd/Ctrl+K is handled in Navigation where state lives)
  useEffect(() => {
    if (!isOpen) return;

    function handleGlobalKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <FocusTrap active={isOpen}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Search events"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
            className="relative w-full max-w-2xl bg-[#111111] border border-[#C9A84C]/20 shadow-[0_25px_50px_rgba(0,0,0,0.5)] overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#C9A84C]/10">
              <svg
                className="w-5 h-5 text-[#C9A84C] shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search events by name, venue, or category..."
                className="flex-1 bg-transparent text-white text-base font-body placeholder-white/30 outline-none"
                autoComplete="off"
                spellCheck={false}
                role="combobox"
                aria-expanded={results.length > 0}
                aria-controls="search-results-listbox"
                aria-activedescendant={
                  results[selectedIndex]
                    ? `search-result-${results[selectedIndex].item.id}`
                    : undefined
                }
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono text-white/30 border border-white/10 rounded">
                ESC
              </kbd>
            </div>

            {/* Accessible live region for result count */}
            <div
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {query.length > 0 && results.length > 0 &&
                `${results.length} result${results.length === 1 ? '' : 's'} found`}
              {query.length > 0 && results.length === 0 && 'No results found'}
            </div>

            {/* Results */}
            <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
              {query.length > 0 && results.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <p className="text-white/40 font-body text-sm">
                    No events found for &ldquo;{query}&rdquo;
                  </p>
                  <p className="text-white/20 font-body text-xs mt-2">
                    Try searching by event name, venue, or category
                  </p>
                </div>
              )}

              {query.length === 0 && (
                <div className="px-5 py-8 text-center text-white/30 font-body text-sm">
                  Start typing to search events...
                </div>
              )}

              {results.length > 0 && (
                <ul role="listbox" id="search-results-listbox" aria-label="Search results">
                  {results.map((result, index) => {
                    const event = result.item;
                    const isSelected = index === selectedIndex;
                    return (
                      <li
                        key={event.id}
                        id={`search-result-${event.id}`}
                        role="option"
                        aria-selected={isSelected}
                        className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors duration-150 ${
                          isSelected
                            ? 'bg-[#C9A84C]/10'
                            : 'hover:bg-white/[0.03]'
                        }`}
                        onClick={() => navigateToResult(event.slug)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        {/* Event Image Thumbnail */}
                        {event.image && (
                          <div className="relative w-14 h-14 shrink-0 overflow-hidden bg-[#0A0A0A]">
                            <img
                              src={event.image}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                        )}

                        {/* Event Details */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`font-display font-bold text-sm truncate transition-colors ${
                              isSelected ? 'text-[#C9A84C]' : 'text-white'
                            }`}
                          >
                            {event.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-white/40 font-body">
                            <span>{formatDate(event.date)}</span>
                            <span className="text-[#C9A84C]/40">|</span>
                            <span className="truncate">{event.venue}</span>
                          </div>
                        </div>

                        {/* Category Badge */}
                        <span className="shrink-0 px-2.5 py-1 text-[10px] uppercase tracking-wider font-body font-semibold bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                          {event.category}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Footer hint */}
            {results.length > 0 && (
              <div className="px-5 py-2.5 border-t border-[#C9A84C]/10 flex items-center gap-4 text-[10px] text-white/25 font-body">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] font-mono">
                    &uarr;
                  </kbd>
                  <kbd className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] font-mono">
                    &darr;
                  </kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] font-mono">
                    Enter
                  </kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 border border-white/10 rounded text-[9px] font-mono">
                    Esc
                  </kbd>
                  close
                </span>
              </div>
            )}
          </motion.div>
        </motion.div>
        </FocusTrap>
      )}
    </AnimatePresence>
  );
}
