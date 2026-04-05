/**
 * Shared in-process counters AND lifecycle state for the admin chat/agent
 * runtime. Exported via functions (not raw exported `let`) so every caller
 * (health endpoint, chat handler, action endpoint) consumes the same
 * authoritative state.
 *
 * Default state = 'sleeping'. Each container start begins asleep — the
 * admin must explicitly POST /api/admin/action {action: "wake"} from the
 * HealthDashboard before chat can be used. While sleeping the agent
 * refuses chat requests and reports zero memory/uptime so it does not
 * appear to be consuming resources on the VPS.
 */

export type AgentStatus = 'sleeping' | 'awake';

let chatRequestCount = 0;
let lastActivityAt = Date.now();
let moduleStartAt = Date.now();

// Lifecycle. Default = sleeping. wokeAt is null while sleeping; set on wake.
let agentStatus: AgentStatus = 'sleeping';
let wokeAt: number | null = null;
let totalWakes = 0;
let totalSleeps = 0;

export function incrementChatRequests(): void {
  chatRequestCount += 1;
  lastActivityAt = Date.now();
}

export function getChatRequestCount(): number {
  return chatRequestCount;
}

export function getLastActivityAt(): number {
  return lastActivityAt;
}

export function getModuleStartAt(): number {
  return moduleStartAt;
}

/**
 * Reset request counter to zero. Invoked by the admin action endpoint.
 * Preserves moduleStartAt so uptime/totalRequests can be distinguished.
 */
export function resetChatStats(): void {
  chatRequestCount = 0;
  lastActivityAt = Date.now();
}

/**
 * Treat this moment as the new module start. Used by clear_stats to also
 * reset the idle-seconds window admins see on the dashboard.
 */
export function bumpModuleStart(): void {
  moduleStartAt = Date.now();
  lastActivityAt = Date.now();
}

// ─── Agent lifecycle (wake/sleep) ────────────────────────────────────────────

export function getAgentStatus(): AgentStatus {
  return agentStatus;
}

export function isAwake(): boolean {
  return agentStatus === 'awake';
}

/**
 * Transition from sleeping → awake. Records the wake timestamp so uptime
 * is measured FROM the wake moment, not from process start. No-op if
 * already awake.
 */
export function wakeAgent(): { changed: boolean; wokeAt: number; totalWakes: number } {
  if (agentStatus === 'awake' && wokeAt !== null) {
    return { changed: false, wokeAt, totalWakes };
  }
  agentStatus = 'awake';
  wokeAt = Date.now();
  lastActivityAt = wokeAt;
  totalWakes += 1;
  return { changed: true, wokeAt, totalWakes };
}

/**
 * Transition from awake → sleeping. Clears wokeAt so subsequent uptime
 * queries return 0. Preserves totalWakes and totalSleeps counters.
 */
export function sleepAgent(): { changed: boolean; totalSleeps: number } {
  if (agentStatus === 'sleeping') {
    return { changed: false, totalSleeps };
  }
  agentStatus = 'sleeping';
  wokeAt = null;
  totalSleeps += 1;
  return { changed: true, totalSleeps };
}

/**
 * Seconds the agent has been awake. Returns 0 when sleeping so the
 * dashboard shows uptime=0 while the agent is idle.
 */
export function getAgentUptimeSeconds(): number {
  if (agentStatus === 'sleeping' || wokeAt === null) return 0;
  return Math.round((Date.now() - wokeAt) / 1000);
}

export function getTotalWakes(): number {
  return totalWakes;
}

export function getTotalSleeps(): number {
  return totalSleeps;
}
