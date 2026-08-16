export type AuditStatus = 'SUCCESS' | 'FAILURE' | 'PARTIAL';

export interface AuditEntry {
  id: string;
  createdAt: string;
  action: string;
  actionCategory: string;
  entityType: string;
  entityId: string;
  entityName: string | null;
  status: AuditStatus;
  description: string | null;
  ipAddress: string | null;
  actor: { id: string; name: string; email: string } | null;
  /** Null for platform-level events that belong to no ministry. */
  ministry: { id: string; name: string } | null;
}

export interface AuditListResponse {
  data: AuditEntry[];
  total: number;
  scope: 'ministry' | 'all';
}

export const AUDIT_STATUS_STYLES: Record<AuditStatus, string> = {
  SUCCESS: 'border-stat-green-border bg-stat-green-bg text-success',
  FAILURE: 'border-destructive/20 bg-destructive/5 text-destructive',
  PARTIAL: 'border-stat-gold-border bg-stat-gold-bg text-stat-gold-fg',
};

/** ACTION_NAME → "Action name", so the log reads as prose. */
export function humanise(value: string): string {
  const text = value.replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Date and time to the second, which is what an audit trail needs. */
export function auditTimestamp(value: string): string {
  const d = new Date(value);
  return `${d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })} ${d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })}`;
}
