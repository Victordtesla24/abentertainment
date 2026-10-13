'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';
import { adminFetch, setCsrfToken, setAuthToken } from '@/lib/admin-fetch';
import type { Event, Sponsor, GalleryImage, SiteSettings, Video, HeroImage, TimelineChapter, Testimonial, SiteMetric } from '@/lib/data';

const DEFAULT_SETTINGS: SiteSettings = {
  chatModel: 'gpt-4o-mini',
  heroTitle: 'AB ENTERTAINMENT',
  heroSubtitle: 'Experience Events Like No Other',
  contactEmail: 'abhi@abentertainment.com.au',
  contactPhone: '(+61) 430082646',
};

export default function AdminPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [videos, setVideos] = useState<Video[]>([]);
  const [heroImages, setHeroImages] = useState<HeroImage[]>([]);
  const [timeline, setTimeline] = useState<TimelineChapter[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [metrics, setMetrics] = useState<SiteMetric[]>([]);

  useEffect(() => {
    let isCancelled = false;

    const verify = async () => {
      try {
        // The httpOnly session cookie is the source of truth. Ask the server
        // directly instead of gating on sessionStorage, which is per-tab: a
        // valid session must also open the dashboard in a new tab or after the
        // browser restored the page.
        const response = await adminFetch('/api/admin/auth', {
          method: 'GET',
          cache: 'no-store',
        });

        if (!response.ok) {
          router.replace('/admin/login');
          return;
        }

        const auth: { authenticated?: boolean; csrfToken?: string } = await response.json();
        if (!auth.authenticated) {
          router.replace('/admin/login');
          return;
        }
        if (auth.csrfToken) {
          // Re-arm the CSRF double-submit header for this tab.
          setCsrfToken(auth.csrfToken);
          setAuthToken(auth.csrfToken);
        }

        if (!isCancelled) {
          setIsAuthed(true);
          // Fetch all data in parallel
          const [eventsRes, sponsorsRes, galleryRes, settingsRes, videosRes, heroRes, timelineRes, testimonialsRes, metricsRes] = await Promise.allSettled([
            adminFetch('/api/admin/events').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/sponsors').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/gallery').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/settings').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/videos').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/hero-images').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/timeline').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/testimonials').then(r => r.ok ? r.json() : null),
            adminFetch('/api/admin/metrics').then(r => r.ok ? r.json() : null),
          ]);

          if (!isCancelled) {
            if (eventsRes.status === 'fulfilled' && eventsRes.value) setEvents(eventsRes.value.events || []);
            if (sponsorsRes.status === 'fulfilled' && sponsorsRes.value) setSponsors(sponsorsRes.value.sponsors || []);
            if (galleryRes.status === 'fulfilled' && galleryRes.value) setGallery(galleryRes.value.images || []);
            if (settingsRes.status === 'fulfilled' && settingsRes.value) setSettings(settingsRes.value.settings || DEFAULT_SETTINGS);
            if (videosRes.status === 'fulfilled' && videosRes.value) setVideos(videosRes.value.videos || []);
            if (heroRes.status === 'fulfilled' && heroRes.value) setHeroImages(heroRes.value.images || []);
            if (timelineRes.status === 'fulfilled' && timelineRes.value) setTimeline(timelineRes.value.chapters || []);
            if (testimonialsRes.status === 'fulfilled' && testimonialsRes.value) setTestimonials(testimonialsRes.value.testimonials || []);
            if (metricsRes.status === 'fulfilled' && metricsRes.value) setMetrics(metricsRes.value.metrics || []);
          }
        }
      } catch {
        router.replace('/admin/login');
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void verify();

    return () => {
      isCancelled = true;
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <div className="text-white/50 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthed) return null;

  return (
    <AdminDashboard
      initialEvents={events}
      initialSponsors={sponsors}
      initialGallery={gallery}
      initialSettings={settings}
      initialVideos={videos}
      initialHeroImages={heroImages}
      initialTimeline={timeline}
      initialTestimonials={testimonials}
      initialMetrics={metrics}
    />
  );
}
