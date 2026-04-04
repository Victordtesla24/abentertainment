export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/with-auth';
import { getAgentConversations, saveAgentConversations } from '@/lib/data';
import type { AgentConversation } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

export const GET = withAuth(async () => {
  const conversations = await getAgentConversations();
  return NextResponse.json({ conversations });
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const conversations = await getAgentConversations();

    const newConversation: AgentConversation = {
      id: `conv-${Date.now()}`,
      agentId: body.agentId,
      agentName: body.agentName || '',
      messages: body.messages || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    conversations.push(newConversation);
    await saveAgentConversations(conversations);

    try { logAdminAction('admin', 'CONVERSATION_CREATE', '/api/admin/conversations', getClientIp(request), { conversationId: newConversation.id, agentId: newConversation.agentId }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ conversation: newConversation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const { id } = await request.json();
    const conversations = await getAgentConversations();
    const filtered = conversations.filter((c) => c.id !== id);

    if (filtered.length === conversations.length) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    await saveAgentConversations(filtered);

    try { logAdminAction('admin', 'CONVERSATION_DELETE', '/api/admin/conversations', getClientIp(request), { conversationId: id }); } catch { /* audit must not block operation */ }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
});
