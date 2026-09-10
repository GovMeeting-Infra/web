'use client';

import { offlineDb, STORE, idbGet, idbSet } from './db';
import { cacheNamespace } from './uid';
import { newId } from './ids';
import { now } from './clock';
import type { DeadOp, OutboxOp } from './types';

/**
 * The queue of writes that have not reached the server.
 *
 * The one thing stored on the device that is not a copy of something the server
 * already has. Everything else here can be thrown away and refetched; this
 * cannot, which is why nothing evicts from it on a timer and why a failure
 * moves to the dead-letter store rather than disappearing.
 */

const SEQ_KEY = 'outbox-seq';

/**
 * Subscribers, on globalThis rather than in module scope.
 *
 * Same reason as connectivity.ts: a bundler may place this module in more than
 * one chunk, and each copy would then keep its own listener set. A queue change
 * made through one copy would notify only that copy's subscribers, so the
 * banner could sit at "2 waiting" while the queue was empty. BroadcastChannel
 * does not paper over it either — it delivers to other tabs, never to the tab
 * that posted.
 */
const KEY = '__govmeeting_outbox__';

interface OutboxBus {
  listeners: Set<() => void>;
  channel: BroadcastChannel | null;
}

function bus(): OutboxBus {
  const host = globalThis as Record<string, unknown>;
  if (!host[KEY]) {
    const created: OutboxBus = {
      listeners: new Set<() => void>(),
      channel:
        typeof BroadcastChannel !== 'undefined'
          ? new BroadcastChannel('govmeeting-outbox')
          : null,
    };
    created.channel?.addEventListener('message', () => {
      created.listeners.forEach((notify) => notify());
    });
    host[KEY] = created;
  }
  return host[KEY] as OutboxBus;
}

function announce(): void {
  const { listeners, channel } = bus();
  listeners.forEach((notify) => notify());
  channel?.postMessage('changed');
}

export function subscribeToOutbox(onChange: () => void): () => void {
  const { listeners } = bus();
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

async function nextSeq(): Promise<number> {
  const current = (await idbGet<number>('meta', SEQ_KEY)) ?? 0;
  const next = current + 1;
  await idbSet('meta', SEQ_KEY, next);
  return next;
}

export interface EnqueueInput {
  kind: OutboxOp['kind'];
  path: string;
  method: OutboxOp['method'];
  body: unknown;
  entity: OutboxOp['entity'];
  baseUpdatedAt?: string | null;
  dependsOn?: string[];
  label: string;
  /**
   * When set, a new op replaces any pending one for the same entity instead of
   * queueing behind it.
   *
   * Minutes are saved as a whole list rather than a patch, so an older queued
   * save has nothing the newer one lacks — and without this the editor's
   * debounce plus a long meeting would leave hundreds of writes to replay in
   * order, every one of them overwritten by the next.
   */
  collapseByEntity?: boolean;
}

/**
 * Which queued writes this one cannot land without.
 *
 * Worked out from the address rather than declared by the caller. An action
 * item recorded during an outage is written to
 * /api/v1/events/<event id>/minutes/action-items, and if that event is itself
 * still sitting in the queue then its id appears as a segment of this path.
 * That is the dependency, and it is visible without anybody having to remember
 * to state it.
 *
 * Ordering by `seq` already sends them in the right sequence, so this is not
 * what makes the normal case work. It is what makes the abnormal one safe: if
 * the meeting is refused, everything written inside it is marked blocked rather
 * than fired at a record that does not exist and never will.
 */
function inferDependencies(path: string, pending: OutboxOp[]): string[] {
  const segments = new Set(path.split('/').filter(Boolean));
  return pending
    .filter((other) => other.entity.id && segments.has(other.entity.id))
    .map((other) => other.opId);
}

export async function enqueue(input: EnqueueInput): Promise<OutboxOp> {
  const existingOps = await listOps();

  const op: OutboxOp = {
    opId: newId(),
    seq: await nextSeq(),
    actorUid: cacheNamespace(),
    kind: input.kind,
    path: input.path,
    method: input.method,
    body: input.body,
    entity: input.entity,
    dependsOn: input.dependsOn ?? inferDependencies(input.path, existingOps),
    baseUpdatedAt: input.baseUpdatedAt ?? null,
    capturedAt: now().toISOString(),
    attempts: 0,
    nextAttemptAt: 0,
    status: 'pending',
    label: input.label,
  };

  const db = await offlineDb();
  const tx = db.transaction(STORE.outbox, 'readwrite');
  const store = tx.objectStore(STORE.outbox);

  if (input.collapseByEntity) {
    const existing = (await store.getAll()) as OutboxOp[];
    const superseded = existing.filter(
      (candidate) =>
        candidate.actorUid === op.actorUid &&
        candidate.kind === op.kind &&
        candidate.entity.id === op.entity.id &&
        // Never touch one already in the air: the response decides its fate,
        // and deleting it here would lose the record of a write that landed.
        candidate.status === 'pending',
    );

    for (const stale of superseded) {
      await store.delete(stale.opId);
      /*
       * Keep the earliest base version, not the newest.
       *
       * What matters for the overwrite warning is the last copy this person
       * actually saw from the server, and that was captured by the first save
       * in the run. Taking the newest would compare against the device's own
       * previous write and report every save as clean.
       */
      if (stale.baseUpdatedAt && !op.baseUpdatedAt) {
        op.baseUpdatedAt = stale.baseUpdatedAt;
      }
    }
  }

  await store.put(op, op.opId);
  await tx.done;

  announce();
  return op;
}

/** Everything queued for the person currently signed in, oldest first. */
export async function listOps(): Promise<OutboxOp[]> {
  try {
    const db = await offlineDb();
    const all = (await db.getAll(STORE.outbox)) as OutboxOp[];
    const uid = cacheNamespace();
    return all
      .filter((op) => op.actorUid === uid)
      .sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

export async function listDead(): Promise<DeadOp[]> {
  try {
    const db = await offlineDb();
    const all = (await db.getAll(STORE.deadLetter)) as DeadOp[];
    const uid = cacheNamespace();
    return all
      .filter((op) => op.actorUid === uid)
      .sort((a, b) => a.seq - b.seq);
  } catch {
    return [];
  }
}

export async function updateOp(
  opId: string,
  changes: Partial<OutboxOp>,
): Promise<void> {
  const db = await offlineDb();
  const tx = db.transaction(STORE.outbox, 'readwrite');
  const store = tx.objectStore(STORE.outbox);
  const existing = (await store.get(opId)) as OutboxOp | undefined;
  if (existing) await store.put({ ...existing, ...changes }, opId);
  await tx.done;
  announce();
}

/** Landed. The only path by which a write leaves the queue without a trace. */
export async function resolveOp(opId: string): Promise<void> {
  const db = await offlineDb();
  await db.delete(STORE.outbox, opId);
  announce();
}

/**
 * Refused for a reason retrying will not fix.
 *
 * Moved rather than deleted, and the body goes with it. A 403 because an edit
 * window closed during a long outage is still a meeting's minutes, and the
 * person who typed them needs them back — a queue that silently drops work is
 * worse than one that never existed.
 */
export async function killOp(op: OutboxOp, reason: string): Promise<void> {
  const db = await offlineDb();
  const tx = db.transaction(
    [STORE.outbox, STORE.deadLetter],
    'readwrite',
  );
  const dead: DeadOp = {
    ...op,
    status: 'dead',
    diedAt: now().toISOString(),
    reason,
  };
  await tx.objectStore(STORE.deadLetter).put(dead, op.opId);
  await tx.objectStore(STORE.outbox).delete(op.opId);

  // Anything waiting on it can never land either. Marked rather than killed, so
  // the queue screen can explain which failure blocked what.
  const store = tx.objectStore(STORE.outbox);
  const remaining = (await store.getAll()) as OutboxOp[];
  for (const other of remaining) {
    if (other.dependsOn.includes(op.opId)) {
      await store.put({ ...other, status: 'blocked' as const }, other.opId);
    }
  }

  await tx.done;
  announce();
}

/** Drop a dead write once the person has taken what they need from it. */
export async function discardDead(opId: string): Promise<void> {
  const db = await offlineDb();
  await db.delete(STORE.deadLetter, opId);
  announce();
}

export async function countPending(): Promise<number> {
  return (await listOps()).length;
}
