'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { Event } from '@/types';

interface EventCardProps {
  event: Event;
  isPast?: boolean;
}

function getImageUrl(event: Event): string | null {
  if (typeof event.image === 'string' && event.image) return event.image;
  return null;
}

export default function EventCard({ event, isPast = false }: EventCardProps) {
  const formattedDate = new Date(event.date).toLocaleDateString('en-AU', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
      viewport={{ once: true }}
      className="group"
    >
      <div
        className={`h-full bg-gradient-to-br from-[#252545] to-[#1a1a2e] rounded-lg border overflow-hidden transition-all duration-500 hover:shadow-[0_0_30px_rgba(201,168,76,0.15)] ${
          isPast
            ? 'border-gray-700/30 opacity-75 hover:opacity-100'
            : 'border-[#c9a84c]/20 hover:border-[#c9a84c]/60'
        }`}
      >
        {getImageUrl(event) && (
          <div className="relative h-48 overflow-hidden">
            <Image
              src={getImageUrl(event)!}
              alt={event.title}
              fill
              className={`object-cover transition-transform duration-700 group-hover:scale-105 ${
                isPast ? 'grayscale-[30%]' : ''
              }`}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-transparent to-transparent opacity-60" />
            {isPast && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-gray-700/80 text-gray-300 rounded text-xs font-semibold uppercase tracking-wider">
                Past Event
              </div>
            )}
          </div>
        )}

        {!getImageUrl(event) && (
          <div className="h-48 bg-gradient-to-br from-[#722f37]/20 to-[#1a1a2e] flex items-center justify-center relative">
            <svg
              className="w-16 h-16 text-[#c9a84c]/15"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {isPast && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-gray-700/80 text-gray-300 rounded text-xs font-semibold uppercase tracking-wider">
                Past Event
              </div>
            )}
          </div>
        )}

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-xl font-serif font-bold text-white group-hover:text-[#c9a84c] transition-colors duration-300 line-clamp-2 mb-2">
              {event.title}
            </h3>
            {event.description && (
              <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                {event.description}
              </p>
            )}
          </div>

          <div className="space-y-2 pt-3 border-t border-[#c9a84c]/10">
            <div className="flex items-center gap-2 text-sm">
              <svg
                className="w-4 h-4 text-[#c9a84c] flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <time className="text-gray-300">{formattedDate}</time>
            </div>

            {event.venue && (
              <div className="flex items-center gap-2 text-sm">
                <svg
                  className="w-4 h-4 text-[#c9a84c] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-gray-300 truncate">{event.venue}</span>
              </div>
            )}
          </div>

          {!isPast && (
            <Link
              href="/book"
              className="block w-full mt-4 px-4 py-2.5 bg-gradient-to-r from-[#c9a84c] to-[#a68a3d] text-[#1a1a2e] rounded font-semibold text-sm text-center hover:from-[#d4b356] hover:to-[#b39549] transition-all duration-300 hover:shadow-[0_0_20px_rgba(201,168,76,0.3)]"
            >
              Get Tickets
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}
