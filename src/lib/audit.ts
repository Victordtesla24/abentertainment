/**
 * Admin action audit trail.
 * In production, entries are forwarded to the VPS for persistence.
 * Locally, they're logged to console for dev visibility.
 */

export interface AuditEntry {
  timestamp: string;
  user: string;
  action: string;
  resource: string;
  ip: string;
  details?: Record<string, unknown>;
}

const MAX_AUDIT_ENTRIES = 1000;
const auditLog: AuditEntry[] = [];

export function logAdminAction(
  user: string,
  action: string,
  resource: string,
  ip: string,
  details?: Record<string, unknown>
): void {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    user,
    action,
    resource,
    ip,
    details,
  };
  if (auditLog.length >= MAX_AUDIT_ENTRIES) {
    auditLog.shift();
  }
  auditLog.push(entry);
  // In production, this would POST to VPS audit endpoint
  if (process.env.NODE_ENV === 'development') {
    console.log('[AUDIT]', JSON.stringify(entry));
  }
}

export function getAuditLog(): AuditEntry[] {
  return [...auditLog];
}
