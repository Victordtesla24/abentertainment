'use client';
import { getApiUrl } from '@/lib/api-config';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Event, Sponsor, GalleryImage, SiteSettings } from '@/lib/data';
import EventsManager from './EventsManager';
import SponsorsManager from './SponsorsManager';
import GalleryManager from './GalleryManager';
import SettingsManager from './SettingsManager';
import AdminChatbot from './AdminChatbot';

type Tab = 'events' | 'sponsors' | 'gallery' | 'settings' | 'ai';

interface AdminDashboardProps {
  initialEvents: Event[];
  initialSponsors: Sponsor[];
  initialGallery: GalleryImage[];
  initialSettings: SiteSettings;
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'events', label: 'Events', icon: '📅' },
  { id: 'sponsors', label: 'Sponsors', icon: '🤝' },
  { id: 'gallery', label: 'Gallery', icon: '🖼' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
  { id: 'ai', label: 'AI Agent', icon: '🤖' },
];

export default function AdminDashboard({
  initialEvents,
  initialSponsors,
  initialGallery,
  initialSettings,
}: AdminDashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('events');

  async function handleLogout() {
    await fetch(getApiUrl('/api/admin/auth'), { method: 'DELETE' });
    router.push('/admin/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0A0A0A] border-r border-[#C9A84C]/20 flex flex-col">
        <div className="p-6 border-b border-[#C9A84C]/20">
          <h1 className="text-lg font-display font-bold text-[#C9A84C]">
            AB Entertainment
          </h1>
          <p className="text-xs text-[white/40] mt-1">Admin Portal</p>
        </div>

        <nav className="flex-1 py-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-[#C9A84C] bg-[#C9A84C]/10 border-r-2 border-[#C9A84C]'
                  : 'text-[white/40] hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#C9A84C]/20">
          <button
            onClick={handleLogout}
            className="w-full py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-sm transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-[#0A0A0A] overflow-auto">
        <div className="p-8">
          {activeTab === 'events' && (
            <EventsManager initialEvents={initialEvents} />
          )}
          {activeTab === 'sponsors' && (
            <SponsorsManager initialSponsors={initialSponsors} />
          )}
          {activeTab === 'gallery' && (
            <GalleryManager initialGallery={initialGallery} />
          )}
          {activeTab === 'settings' && (
            <SettingsManager initialSettings={initialSettings} />
          )}
          {activeTab === 'ai' && (
            <AdminChatbot />
          )}
        </div>
      </main>
    </div>
  );
}
