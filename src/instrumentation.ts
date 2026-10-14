/**
 * Runs once when the Node.js server starts (Next.js instrumentation hook). It schedules the first look for welcome emails
 * that are still waiting, so a restart (a deploy, a crash) never strands a subscriber who was saved before it: the sweeper
 * sends what it can and waits out a provider hold (a quota that resets at midnight UTC) instead of asking again at once.
 * It is a no-op in the static export (no server) and when EMAIL_SWEEP_DISABLED=1.
 */

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  try {
    const { scheduleBootSweep } = await import('@/lib/email/sender');
    scheduleBootSweep();
  } catch (err) {
    console.error('[email] could not schedule the welcome sweeper at start:', err instanceof Error ? err.name : 'error');
  }
}
