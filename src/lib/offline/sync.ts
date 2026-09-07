'use client';

import { ApiError, apiFetch, isOffline } from '@/lib/api/client';
import {
  listOps,
  resolveOp,
  updateOp,
  killOp,
  subscribeToOutbox,
} from './outbox';
import type { OutboxOp } from './types';
import { cacheNamespace } from './uid';
import type { WriteConflict } from './conflict';

/**
 * Drains the queue when there is somewhere to drain it to.
 *
 * Strictly one at a time, in the order the writes were made. Not for want of
 * throughput — the volumes here are tens of operations — but because parallel
 * sync with dependencies is where this goes quietly wrong, and a meeting's
 * minutes arriving out of order is not a failure anyone would notice until it
 * mattered.
 */

/** Notified when a run finishes with something the person should see. */
export interface SyncReport {
  synced: number;
  conflicts: Array<{ label: string; conflict: WriteConflict }>;
  died: Array<{ label: string; reason: string }>;
}

type ReportListener = (report: SyncReport) => void;
const reportListeners = new Set<ReportListener>();

export function onSyncReport(listener: ReportListener): () => void {
  reportListeners.add(listener);
  return () => reportListeners.delete(listener);
}

let running = false;

/** Exponential, capped, and jittered so many devices reconnecting do not arrive together. */
function backoffMs(attempts: number): number {
  const base = Math.min(30_000 * 2 ** attempts, 15 * 60_000);
  return base * (0.8 + Math.random() * 0.4);
}

/**
 * What a failure means for the write that caused it.
 *
 * The distinction that matters is between "not yet" and "never". Retrying a
 * never wastes nothing but hides the failure behind a spinner; treating a not
 * yet as a never throws away someone's work.
 */
function classify(
  error: unknown,
): { verdict: 'retry' | 'dead' | 'stop'; reason: string } {
  if (isOffline(error)) {
    // The connection went again mid-run. Not this write's fault, and working
    // through the rest of the queue would only fail them all in turn.
    return { verdict: 'stop', reason: 'The connection dropped again.' };
  }

  const status = error instanceof ApiError ? error.status : 0;

  if (status === 401 || status === 403) {
    if (status === 401) {
      return {
        verdict: 'stop',
        reason: 'You need to sign in again before this can be saved.',
      };
    }
    // A 403 here is a rule, not a hiccup: the edit window closed while the
    // device was offline, or the record was archived. Retrying cannot change
    // either, and the text has to be handed back rather than retried forever.
    return {
      verdict: 'dead',
      reason:
        error instanceof ApiError
          ? error.message
          : 'The server refused this change.',
    };
  }

  if (status === 404 || status === 410) {
    return {
      verdict: 'dead',
      reason: 'The meeting this belonged to no longer exists.',
    };
  }

  if (status === 400 || status === 422) {
    // Our bug, almost certainly. Keep the payload for support rather than
    // retrying something the server will refuse identically every time.
    return {
      verdict: 'dead',
      reason:
        error instanceof ApiError
          ? error.message
          : 'The server could not accept this change.',
    };
  }

  return { verdict: 'retry', reason: 'The server could not be reached.' };
}

/** Ten attempts is roughly a day of backoff. Kept, but no longer tried on its own. */
const MAX_ATTEMPTS = 10;

async function sendOne(op: OutboxOp): Promise<unknown> {
  return apiFetch(
    op.path,
    { method: op.method, body: JSON.stringify(op.body) },
    {
      // Already queued. Queueing the send would put it in twice.
      offline: 'never',
      baseUpdatedAt: op.baseUpdatedAt,
      clientOpId: op.opId,
      // A background sync must never navigate. Someone mid-sentence in the
      // minutes editor should not be thrown at a login page because a queue
      // drained behind them; the 401 is classified above instead.
      authRedirect: false,
    },
  );
}

export async function syncNow(): Promise<SyncReport> {
  const report: SyncReport = { synced: 0, conflicts: [], died: [] };
  if (running) return report;
  running = true;

  try {
    const uid = cacheNamespace();
    const ops = (await listOps()).filter(
      (op) =>
        op.status === 'pending' &&
        op.actorUid === uid &&
        op.nextAttemptAt <= Date.now(),
    );

    for (const op of ops) {
      await updateOp(op.opId, { status: 'inflight' });

      try {
        const result = (await sendOne(op)) as { conflict?: WriteConflict };
        await resolveOp(op.opId);
        report.synced += 1;
        if (result?.conflict) {
          report.conflicts.push({ label: op.label, conflict: result.conflict });
        }
      } catch (error) {
        const { verdict, reason } = classify(error);

        if (verdict === 'stop') {
          // Put it back untouched. A dropped connection is not an attempt, and
          // counting it would burn the backoff budget on the network rather
          // than on anything this write did.
          await updateOp(op.opId, { status: 'pending' });
          break;
        }

        if (verdict === 'dead') {
          await killOp(op, reason);
          report.died.push({ label: op.label, reason });
          continue;
        }

        const attempts = op.attempts + 1;
        await updateOp(op.opId, {
          status: 'pending',
          attempts,
          nextAttemptAt: Date.now() + backoffMs(attempts),
          lastError: {
            status: error instanceof ApiError ? error.status : undefined,
            message: reason,
          },
        });

        if (attempts >= MAX_ATTEMPTS) {
          // Still in the queue and still retryable by hand — this only stops
          // it being tried automatically, so a long server outage does not
          // hammer it forever and the person is told rather than left guessing.
          await updateOp(op.opId, { nextAttemptAt: Number.MAX_SAFE_INTEGER });
        }
      }
    }
  } finally {
    running = false;
  }

  if (report.conflicts.length || report.died.length) {
    reportListeners.forEach((listener) => listener(report));
  }

  return report;
}

/**
 * Only one tab drains at a time.
 *
 * Two tabs sending the same queue would each get an answer for writes the other
 * had already resolved. Where the Lock API is missing the in-process `running`
 * flag still covers the common case of one tab.
 */
async function syncExclusive(): Promise<void> {
  if (!navigator.locks?.request) {
    await syncNow();
    return;
  }
  await navigator.locks.request(
    'govmeeting-sync',
    { ifAvailable: true },
    async (lock) => {
      if (lock) await syncNow();
    },
  );
}

/**
 * Try again when there is reason to think it might work.
 *
 * `online` is the obvious trigger and the least reliable — the browser reports
 * an interface, not a route to the server. The one that actually earns its
 * place is a successful request elsewhere in the app, which is proof rather
 * than a guess.
 */
export function startSyncEngine(): () => void {
  const attempt = () => void syncExclusive();

  const onVisible = () => {
    if (document.visibilityState === 'visible') attempt();
  };

  window.addEventListener('online', attempt);
  document.addEventListener('visibilitychange', onVisible);

  // A slow heartbeat rather than a poll: it exists so a queue left behind by a
  // failed run is not stranded until the next navigation.
  const timer = window.setInterval(attempt, 60_000);

  const unsubscribe = subscribeToOutbox(() => {
    // Something was just queued or changed. If there is a connection this
    // sends it within the second, which is what makes an online save that
    // briefly failed feel like it simply worked.
    attempt();
  });

  attempt();

  return () => {
    window.removeEventListener('online', attempt);
    document.removeEventListener('visibilitychange', onVisible);
    if (timer) window.clearInterval(timer);
    unsubscribe();
  };
}
