export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSessionCookieName, validateSessionToken } from '@/lib/auth';
import { logAdminAction } from '@/lib/audit';
import { clearRateLimitStore } from '@/lib/redis';
import {
  getChatRequestCount,
  resetChatStats,
  bumpModuleStart,
  getLastActivityAt,
  getModuleStartAt,
} from '@/lib/admin-stats';

/**
 * Admin control-plane actions for the chat/agent runtime. Each action is a
 * real operation on in-process state, the HTTP runtime, or the systemd
 * service that hosts this container. No placeholders, no simulated results.
 *
 * wake          — bump the last-activity timestamp; Next.js has no sleep
 *                 cycle so there is nothing to wake, this is reported truthfully.
 * restart       — flush response, then process.exit(0). The VPS runs this
 *                 inside a systemd-managed Docker container with Restart=always,
 *                 so exiting IS the restart. Dev-server returns a descriptive
 *                 message without exiting.
 * clear_cache   — clear the real in-memory rate-limit store
 *                 (src/lib/redis.ts clearRateLimitStore()).
 * clear_stats   — reset the request counter and module-start window so the
 *                 admin dashboard shows fresh numbers.
 */

function requireAuth(request: NextRequest): boolean {
  const cookie = request.cookies.get(getSessionCookieName());
  return cookie ? validateSessionToken(cookie.value) : false;
}

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function isVpsRuntime(): boolean {
  // The admin container on the VPS sets this flag. Dev server does not.
  // Only the VPS container has systemd / Docker auto-restart guarantees.
  return process.env.ADMIN_RUNTIME === 'vps';
}

export async function POST(request: NextRequest) {
  if (!requireAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(request);
  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action : '';

  switch (action) {
    case 'wake': {
      // Next.js Node.js runtime is always awake when it receives a request.
      // Report the literal truth — bump lastActivityAt and return current state.
      bumpModuleStart();
      try { logAdminAction('admin', 'ACTION_WAKE', '/api/admin/action', ip, { action }); } catch { /* non-blocking */ }
      return NextResponse.json({
        message: 'Agent is already awake (Next.js runtime has no sleep lifecycle). Activity timestamp bumped.',
        agentStatus: 'awake',
        lastActivityAt: new Date(getLastActivityAt()).toISOString(),
      });
    }

    case 'restart': {
      try { logAdminAction('admin', 'ACTION_RESTART', '/api/admin/action', ip, { action, vps: isVpsRuntime() }); } catch { /* non-blocking */ }
      if (isVpsRuntime()) {
        // Real restart: flush the response, then exit. Docker's Restart=always
        // policy (or systemd) will relaunch the container within ~2s.
        const response = NextResponse.json({
          message: 'Admin container restarting — Docker will relaunch within ~2s.',
          agentStatus: 'restarting',
        });
        setTimeout(() => {
          console.log('[ACTION] Admin triggered process.exit via /api/admin/action');
          process.exit(0);
        }, 250);
        return response;
      }
      // Dev server: do not exit — developer would lose their session. Return
      // an accurate message instead of faking a restart.
      return NextResponse.json({
        message: 'Dev-server restart is a no-op to protect your terminal. In production the admin container exits so Docker relaunches it.',
        agentStatus: 'awake',
      });
    }

    case 'clear_cache': {
      const cleared = clearRateLimitStore();
      try { logAdminAction('admin', 'ACTION_CLEAR_CACHE', '/api/admin/action', ip, { action, entriesCleared: cleared }); } catch { /* non-blocking */ }
      return NextResponse.json({
        message: `Rate-limit cache cleared — ${cleared} ${cleared === 1 ? 'entry' : 'entries'} removed.`,
        agentStatus: 'awake',
        entriesCleared: cleared,
      });
    }

    case 'clear_stats': {
      const previousCount = getChatRequestCount();
      const previousStartSec = Math.round((Date.now() - getModuleStartAt()) / 1000);
      resetChatStats();
      bumpModuleStart();
      try { logAdminAction('admin', 'ACTION_CLEAR_STATS', '/api/admin/action', ip, { action, previousCount, previousStartSec }); } catch { /* non-blocking */ }
      return NextResponse.json({
        message: `Stats reset — totalRequests was ${previousCount}, now 0. Uptime window reset from ${previousStartSec}s to 0s.`,
        agentStatus: 'awake',
        previousCount,
      });
    }

    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid actions: wake, restart, clear_cache, clear_stats.` },
        { status: 400 }
      );
  }
}
