'use client';
import { getApiUrl } from '@/lib/api-config';
import { clearCsrfToken, clearAuthToken, adminFetch } from '@/lib/admin-fetch';
import Image from 'next/image';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Event, Sponsor, GalleryImage, SiteSettings, Video, HeroImage, TimelineChapter, Testimonial } from '@/lib/data';
import EventsManager from './EventsManager';
import SponsorsManager from './SponsorsManager';
import GalleryManager from './GalleryManager';
import SettingsManager from './SettingsManager';
import AdminChatbot from './AdminChatbot';
import HealthDashboard from './HealthDashboard';
import AgentConversations from './AgentConversations';
import VideoManager from './VideoManager';
import HeroImageManager from './HeroImageManager';
import TimelineManager from './TimelineManager';
import TestimonialsManager from './TestimonialsManager';

type Tab = 'health' | 'events' | 'sponsors' | 'gallery' | 'heroes' | 'videos' | 'timeline' | 'testimonials' | 'settings' | 'ai' | 'conversations';

interface AdminDashboardProps {
  initialEvents: Event[];
  initialSponsors: Sponsor[];
  initialGallery: GalleryImage[];
  initialSettings: SiteSettings;
  initialVideos: Video[];
  initialHeroImages: HeroImage[];
  initialTimeline: TimelineChapter[];
  initialTestimonials: Testimonial[];
}

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'health', label: 'Dashboard', desc: 'System overview' },
  { id: 'events', label: 'Events', desc: 'Manage performances' },
  { id: 'sponsors', label: 'Sponsors', desc: 'Partner management' },
  { id: 'gallery', label: 'Gallery', desc: 'Media assets' },
  { id: 'heroes', label: 'Hero Images', desc: 'Page hero banners' },
  { id: 'videos', label: 'Videos', desc: 'Video management' },
  { id: 'timeline', label: 'Timeline', desc: 'Our Story chapters' },
  { id: 'testimonials', label: 'Testimonials', desc: 'Customer reviews' },
  { id: 'settings', label: 'Settings', desc: 'Configuration' },
  { id: 'ai', label: 'AI Agent', desc: 'Intelligent assistant' },
  { id: 'conversations', label: 'Conversations', desc: 'Chat history' },
];

const TAB_ICONS: Record<Tab, React.ReactNode> = {
  health: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
    </svg>
  ),
  events: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  ),
  sponsors: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  gallery: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 6v12z" />
    </svg>
  ),
  settings: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  ai: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
  heroes: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M2.25 18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V6a2.25 2.25 0 00-2.25-2.25h-15A2.25 2.25 0 002.25 6v12zM12.75 8.25a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
    </svg>
  ),
  videos: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  ),
  timeline: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  testimonials: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
    </svg>
  ),
  conversations: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
    </svg>
  ),
};

export default function AdminDashboard({
  initialEvents,
  initialSponsors,
  initialGallery,
  initialSettings,
  initialVideos,
  initialHeroImages,
  initialTimeline,
  initialTestimonials,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('health');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [events, setEvents] = useState(initialEvents);
  const [sponsors, setSponsors] = useState(initialSponsors);
  const [gallery, setGallery] = useState(initialGallery);
  const [settings, setSettings] = useState(initialSettings);
  const [videos, setVideos] = useState(initialVideos);
  const [heroImages, setHeroImages] = useState(initialHeroImages);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [testimonials, setTestimonials] = useState(initialTestimonials);

  // Refresh data when switching tabs so externally-added items appear
  const refreshData = useCallback(async () => {
    const [evtRes, spRes, galRes, setRes, vidRes, heroRes, tlRes, testRes] = await Promise.allSettled([
      adminFetch('/api/admin/events').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/sponsors').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/gallery').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/settings').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/videos').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/hero-images').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/timeline').then(r => r.ok ? r.json() : null),
      adminFetch('/api/admin/testimonials').then(r => r.ok ? r.json() : null),
    ]);
    if (evtRes.status === 'fulfilled' && evtRes.value?.events) setEvents(evtRes.value.events);
    if (spRes.status === 'fulfilled' && spRes.value?.sponsors) setSponsors(spRes.value.sponsors);
    if (galRes.status === 'fulfilled' && galRes.value?.images) setGallery(galRes.value.images);
    if (setRes.status === 'fulfilled' && setRes.value?.settings) setSettings(setRes.value.settings);
    if (vidRes.status === 'fulfilled' && vidRes.value?.videos) setVideos(vidRes.value.videos);
    if (heroRes.status === 'fulfilled' && heroRes.value?.images) setHeroImages(heroRes.value.images);
    if (tlRes.status === 'fulfilled' && tlRes.value?.chapters) setTimeline(tlRes.value.chapters);
    if (testRes.status === 'fulfilled' && testRes.value?.testimonials) setTestimonials(testRes.value.testimonials);
  }, []);

  useEffect(() => { refreshData(); }, [activeTab, refreshData]);

  async function handleLogout() {
    await fetch(getApiUrl('/api/admin/auth'), { method: 'DELETE', credentials: 'include' });
    clearCsrfToken();
    clearAuthToken();
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-[#060606]">
      {/* Executive Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'} bg-[#0A0A0A] border-r border-white/[0.06] flex flex-col transition-all duration-300 ease-out relative`}>
        {/* Brand Header */}
        <div className={`${sidebarCollapsed ? 'px-3 py-5' : 'px-6 py-6'} border-b border-white/[0.06]`}>
            <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-[#0A0A0A]">
                <Image
                  src="/images/AB_Logo_transparent.png"
                  alt="AB Entertainment"
                  width={36}
                  height={36}
                  className="w-full h-full object-contain"
                  unoptimized
                />
              </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <h1 className="text-[13px] font-semibold text-white tracking-wide truncate">
                  AB Entertainment
                </h1>
                <p className="text-[10px] text-white/25 tracking-[0.08em] uppercase mt-0.5">Executive Portal</p>
              </div>
            )}
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-[72px] w-6 h-6 bg-[#111] border border-white/[0.08] rounded-full flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/20 transition-all z-10"
        >
          <svg className={`w-3 h-3 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 space-y-0.5">
          {!sidebarCollapsed && (
            <p className="text-[9px] font-medium text-white/20 uppercase tracking-[0.2em] px-3 mb-3">Navigation</p>
          )}
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={sidebarCollapsed ? tab.label : undefined}
              className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2' : 'px-3'} py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                activeTab === tab.id
                  ? 'text-[#C9A84C] bg-[#C9A84C]/[0.08]'
                  : 'text-white/35 hover:text-white/70 hover:bg-white/[0.03]'
              }`}
            >
              {activeTab === tab.id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#C9A84C] rounded-r-full" />
              )}
              <span className={`flex-shrink-0 ${activeTab === tab.id ? 'text-[#C9A84C]' : 'text-white/30 group-hover:text-white/50'} transition-colors`}>
                {TAB_ICONS[tab.id]}
              </span>
              {!sidebarCollapsed && (
                <div className="ml-3 text-left min-w-0">
                  <span className="block text-[13px] leading-tight truncate">{tab.label}</span>
                  <span className="block text-[10px] text-white/20 leading-tight mt-0.5 truncate">{tab.desc}</span>
                </div>
              )}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className={`${sidebarCollapsed ? 'px-2' : 'px-4'} py-4 border-t border-white/[0.06]`}>
          {!sidebarCollapsed && (
            <div className="px-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#C9A84C]/30 to-[#C9A84C]/10 flex items-center justify-center">
                  <span className="text-[10px] text-[#C9A84C] font-semibold">A</span>
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-white/50 truncate">Administrator</p>
                  <p className="text-[9px] text-white/20">Active session</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className={`w-full ${sidebarCollapsed ? 'px-2' : 'px-3'} py-2 text-[11px] text-white/30 hover:text-red-400 hover:bg-red-400/[0.06] rounded-lg transition-all duration-200 flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2'}`}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            {!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Top Bar */}
        <div className="sticky top-0 z-10 bg-[#060606]/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="px-8 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold text-white tracking-wide">
                {TABS.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-[11px] text-white/25 mt-0.5">
                {TABS.find(t => t.id === activeTab)?.desc}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-white/15 font-mono">
                {new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <div className="w-px h-4 bg-white/[0.06]" />
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-emerald-500/70">Live</span>
              </div>
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="p-8">
          {activeTab === 'health' && <HealthDashboard events={events} sponsors={sponsors} />}
          {activeTab === 'events' && <EventsManager initialEvents={events} allSponsors={sponsors} />}
          {activeTab === 'sponsors' && <SponsorsManager initialSponsors={sponsors} allEvents={events} />}
          {activeTab === 'gallery' && <GalleryManager initialGallery={gallery} allEvents={events} initialSiteImageOverrides={settings.siteImageOverrides} />}
          {activeTab === 'heroes' && <HeroImageManager initialImages={heroImages} />}
          {activeTab === 'videos' && <VideoManager initialVideos={videos} events={events} />}
          {activeTab === 'timeline' && <TimelineManager initialChapters={timeline} />}
          {activeTab === 'testimonials' && <TestimonialsManager initialTestimonials={testimonials} />}
          {activeTab === 'settings' && <SettingsManager initialSettings={settings} />}
          {activeTab === 'ai' && <AdminChatbot activeTab={activeTab} />}
          {activeTab === 'conversations' && <AgentConversations />}
        </div>
      </main>
    </div>
  );
}
