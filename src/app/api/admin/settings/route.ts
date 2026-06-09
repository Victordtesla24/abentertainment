export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getSettings, saveSettings, getAgents, saveAgents } from '@/lib/data';
import { revalidateSettings } from '@/lib/revalidate';

export const GET = withAuth(async () => {
  const settings = await getSettings();
  return NextResponse.json({ settings });
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const current = await getSettings();
    // Merge: preserve every existing field; only overwrite what's in the body.
    // Uses string-type guards so empty strings overwrite (clears a field)
    // but undefined keys retain the previous value.
    const merged = {
      chatModel: typeof body.chatModel === 'string' ? body.chatModel : current.chatModel,
      adminChatModel: typeof body.adminChatModel === 'string' ? body.adminChatModel : current.adminChatModel,
      customerChatModel: typeof body.customerChatModel === 'string' ? body.customerChatModel : current.customerChatModel,
      heroTitle: typeof body.heroTitle === 'string' ? body.heroTitle : current.heroTitle,
      heroSubtitle: typeof body.heroSubtitle === 'string' ? body.heroSubtitle : current.heroSubtitle,
      heroVideoUrl: typeof body.heroVideoUrl === 'string' ? body.heroVideoUrl : current.heroVideoUrl,
      contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail : current.contactEmail,
      contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone : current.contactPhone,
      pageTitles: Array.isArray(body.pageTitles) ? body.pageTitles : current.pageTitles,
      siteImageOverrides: body.siteImageOverrides !== undefined ? body.siteImageOverrides : current.siteImageOverrides,
    };
    await saveSettings(merged);
    revalidateSettings();

    // Sync admin chat model → admin agent config so every reader stays aligned.
    // adminChatModel wins, falls back to chatModel. If neither changed, skip.
    // This is a best-effort secondary write: the settings save above already
    // succeeded, so a failure here must NOT bubble into the outer catch and
    // return a misleading "Invalid request" 400 as if nothing was saved.
    try {
      const newAdminModel = merged.adminChatModel || merged.chatModel;
      const prevAdminModel = current.adminChatModel || current.chatModel;
      if (newAdminModel && newAdminModel !== prevAdminModel) {
        const agents = await getAgents();
        const idx = agents.findIndex((a) => a.type === 'admin');
        if (idx !== -1) {
          agents[idx] = { ...agents[idx], model: newAdminModel, updatedAt: new Date().toISOString() };
          await saveAgents(agents);
        }
      }
    } catch (err) {
      console.error('[settings] admin agent model sync failed (settings were saved):', err);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
