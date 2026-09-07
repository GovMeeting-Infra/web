'use client';

/** What kind of thing a queued write is, so the sync engine can reason about it. */
export type OpKind = 'minutes.upsert' | 'attendance.register';

export type OpStatus =
  | 'pending'
  | 'inflight'
  /** A parent operation died, so this one can never land. */
  | 'blocked';

export interface OutboxOp {
  opId: string;
  /**
   * Monotonic, and the only thing that decides order.
   *
   * Timestamps would be the obvious choice and are the wrong one: the clock on
   * a device that has just come back from a power cut can move backwards, which
   * would reorder a meeting's saves.
   */
  seq: number;
  /**
   * Whose work this is.
   *
   * A shared tablet may be signed into by someone else before the queue drains,
   * and one person's minutes must never be sent under another person's session.
   */
  actorUid: string;
  kind: OpKind;
  /** Fully resolved, because client-minted ids mean no path needs rewriting later. */
  path: string;
  method: 'POST' | 'PATCH';
  body: unknown;
  entity: { type: 'minutes' | 'attendance'; id: string };
  /** opIds that must land first. */
  dependsOn: string[];
  /** `updatedAt` of the copy this was written against, for conflict reporting. */
  baseUpdatedAt: string | null;
  /** When the person actually did this, corrected for clock skew. */
  capturedAt: string;
  attempts: number;
  nextAttemptAt: number;
  status: OpStatus;
  lastError?: { status?: number; code?: string; message: string };
  /** Human-readable, for the queue screen and for a failure someone has to act on. */
  label: string;
}

/** A write the server refused for a reason retrying will not fix. */
export interface DeadOp extends Omit<OutboxOp, 'status'> {
  status: 'dead';
  diedAt: string;
  /** Why, in words the person who typed it can act on. */
  reason: string;
}
