export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';


const DATA_DIR = join(process.cwd(), 'data');

interface TelemetryData {
  actions: Array<{ action: string; section: string; timestamp: string }>;
  totals: Record<string, number>;
  lastLogin: string | null;
}

async function readTelemetry(): Promise<TelemetryData> {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const fp = join(DATA_DIR, 'telemetry.json');
    const content = await readFile(fp, 'utf-8');
    return JSON.parse(content) as TelemetryData;
  } catch {
    return { actions: [], totals: {}, lastLogin: null };
  }
}

async function writeTelemetry(data: TelemetryData): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(join(DATA_DIR, 'telemetry.json'), JSON.stringify(data, null, 2), 'utf-8');
}

export const GET = withAuth(async () => {
  const tel = await readTelemetry();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayActions = tel.actions.filter(a => a.timestamp.startsWith(todayStr));
  const recentActions = [...tel.actions].slice(-20).reverse();
  return NextResponse.json({
    totals: tel.totals,
    todayCount: todayActions.length,
    totalCount: tel.actions.length,
    recentActions,
    lastLogin: tel.lastLogin,
  });
});

export const POST = withAuth(async (request: import('next/server').NextRequest) => {
  try {
    const body = await request.json() as { action: string; section: string };
    const tel = await readTelemetry();
    const entry = { action: body.action || '', section: body.section || '', timestamp: new Date().toISOString() };
    tel.actions.push(entry);
    if (tel.actions.length > 1000) tel.actions = tel.actions.slice(-500);
    tel.totals[body.section] = (tel.totals[body.section] || 0) + 1;
    await writeTelemetry(tel);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
