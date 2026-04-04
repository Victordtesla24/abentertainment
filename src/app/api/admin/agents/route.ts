export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getAgents, saveAgents } from '@/lib/data';
import type { AgentConfig } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const agents = await getAgents();
  return NextResponse.json({ agents });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const agents = await getAgents();

    const newAgent: AgentConfig = {
      id: `agent-${Date.now()}`,
      name: body.name,
      type: body.type || 'customer',
      model: body.model || 'gpt-4o',
      systemPrompt: body.systemPrompt || '',
      temperature: body.temperature ?? 0.7,
      maxTokens: body.maxTokens ?? 2000,
      status: body.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    agents.push(newAgent);
    await saveAgents(agents);

    try { logAdminAction('admin', 'AGENT_CREATE', '/api/admin/agents', getClientIp(request), { agentId: newAgent.id, name: newAgent.name }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ agent: newAgent }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const agents = await getAgents();
    const index = agents.findIndex((a) => a.id === body.id);

    if (index === -1) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updated: AgentConfig = {
      ...agents[index],
      name: body.name ?? agents[index].name,
      type: body.type ?? agents[index].type,
      model: body.model ?? agents[index].model,
      systemPrompt: body.systemPrompt ?? agents[index].systemPrompt,
      temperature: body.temperature ?? agents[index].temperature,
      maxTokens: body.maxTokens ?? agents[index].maxTokens,
      status: body.status ?? agents[index].status,
      updatedAt: new Date().toISOString(),
    };

    agents[index] = updated;
    await saveAgents(agents);

    try { logAdminAction('admin', 'AGENT_UPDATE', '/api/admin/agents', getClientIp(request), { agentId: updated.id, name: updated.name }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ agent: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const agents = await getAgents();
    const filtered = agents.filter((a) => a.id !== id);

    if (filtered.length === agents.length) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    await saveAgents(filtered);

    try { logAdminAction('admin', 'AGENT_DELETE', '/api/admin/agents', getClientIp(request), { agentId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
