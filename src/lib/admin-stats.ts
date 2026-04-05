/**
 * Shared in-process counters for the admin chat/agent runtime. Exported via
 * functions (not raw exported `let`) so both readers (health endpoint) and
 * writers (chat route, action route) consume the same authoritative numbers.
 *
 * Numbers are real: incremented by the chat route on every POST and reset
 * only when the admin explicitly calls POST /api/admin/action {action: "clear_stats"}.
 */

let chatRequestCount = 0;
let lastActivityAt = Date.now();
let moduleStartAt = Date.now();

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
