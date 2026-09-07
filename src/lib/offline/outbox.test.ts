import { describe, it, expect } from 'vitest';
import { enqueue, listOps, listDead, killOp, resolveOp } from './outbox';
import type { OutboxOp } from './types';

/**
 * The queue itself.
 *
 * This is the only thing on the device that is not a copy of something the
 * server already has, so its rules are the ones with teeth: what may replace
 * what, what must wait for what, and what happens to a write nobody can send.
 */

const minutesOp = (
  decisions: string[],
  baseUpdatedAt: string | null = null,
) => ({
  kind: 'minutes.upsert' as const,
  path: '/api/v1/events/e1/minutes',
  method: 'POST' as const,
  body: { decisions },
  entity: { type: 'minutes' as const, id: 'e1' },
  baseUpdatedAt,
  label: 'Meeting minutes',
  collapseByEntity: true,
});

describe('outbox', () => {
  it('keeps a write that could not be sent', async () => {
    await enqueue(minutesOp(['Approved the budget']));
    const queued = await listOps();

    expect(queued).toHaveLength(1);
    expect(queued[0].body).toEqual({ decisions: ['Approved the budget'] });
    expect(queued[0].status).toBe('pending');
  });

  describe('collapsing repeated saves', () => {
    it('replaces an earlier save of the same record', async () => {
      // The editor debounces, so a meeting produces a run of saves and only the
      // last one describes the record. Without this, replaying them in order
      // would send hundreds of writes, every one overwritten by the next.
      await enqueue(minutesOp(['One']));
      await enqueue(minutesOp(['One', 'Two']));
      await enqueue(minutesOp(['One', 'Two', 'Three']));

      const queued = await listOps();
      expect(queued).toHaveLength(1);
      expect(queued[0].body).toEqual({ decisions: ['One', 'Two', 'Three'] });
    });

    it('keeps the base version from the FIRST save, not the newest', async () => {
      /*
       * The subtle one.
       *
       * The overwrite warning compares against the last copy the person
       * actually saw from the server, and that was captured by the first save
       * in the run — every save after it was made against the device's own
       * previous write. Taking the newest base would compare a save to itself
       * and report every one of them as clean, which is worse than not warning
       * at all: it would say "nobody else touched this" while somebody had.
       */
      await enqueue(minutesOp(['One'], '2026-09-07T10:00:00.000Z'));
      await enqueue(minutesOp(['One', 'Two'], null));
      await enqueue(minutesOp(['One', 'Two', 'Three'], null));

      const queued = await listOps();
      expect(queued[0].baseUpdatedAt).toBe('2026-09-07T10:00:00.000Z');
    });

    it('does not collapse different records together', async () => {
      await enqueue(minutesOp(['For e1']));
      await enqueue({
        ...minutesOp(['For e2']),
        path: '/api/v1/events/e2/minutes',
        entity: { type: 'minutes' as const, id: 'e2' },
      });

      expect(await listOps()).toHaveLength(2);
    });

    it('leaves an attendance batch alone', async () => {
      /*
       * The register is append-only in a way a minutes list is not: each send
       * carries the people recorded since the last one, so replacing an earlier
       * batch with a newer one would drop everybody in it.
       */
      const batch = (name: string) => ({
        kind: 'attendance.register' as const,
        path: '/api/v1/checkin/e1/offline-register',
        method: 'POST' as const,
        body: { records: [{ signedName: name }] },
        entity: { type: 'attendance' as const, id: 'e1' },
        label: 'Attendance register',
        collapseByEntity: false,
      });

      await enqueue(batch('Aminata'));
      await enqueue(batch('Mohamed'));

      expect(await listOps()).toHaveLength(2);
    });
  });

  describe('dependencies', () => {
    it('waits for the meeting a write was made inside', async () => {
      // An action item recorded during an outage may belong to a meeting still
      // sitting in the queue behind it.
      const event = await enqueue({
        kind: 'event.create',
        path: '/api/v1/events',
        method: 'POST',
        body: { id: 'newmeetingid0000000000aa', title: 'Cabinet' },
        entity: { type: 'event', id: 'newmeetingid0000000000aa' },
        label: 'Meeting: Cabinet',
        collapseByEntity: false,
      });

      const item = await enqueue({
        kind: 'actionItem.create',
        path: '/api/v1/events/newmeetingid0000000000aa/minutes/action-items',
        method: 'POST',
        body: { title: 'Follow up' },
        entity: { type: 'actionItem', id: 'actionitemid00000000000a' },
        label: 'Action item: Follow up',
        collapseByEntity: false,
      });

      expect(item.dependsOn).toContain(event.opId);
    });

    it('depends on nothing when the meeting already exists on the server', async () => {
      const item = await enqueue({
        kind: 'actionItem.create',
        path: '/api/v1/events/anexistingserverid0000/minutes/action-items',
        method: 'POST',
        body: { title: 'Follow up' },
        entity: { type: 'actionItem', id: 'actionitemid00000000000b' },
        label: 'Action item: Follow up',
        collapseByEntity: false,
      });

      expect(item.dependsOn).toEqual([]);
    });
  });

  describe('a write nobody can send', () => {
    it('is kept with its content, not discarded', async () => {
      /*
       * A 403 because an edit window closed during a long outage is still a
       * meeting's minutes. Silently dropping them is the worst thing this
       * feature could do, so the body moves to the dead letter with the op.
       */
      await enqueue(minutesOp(['Written during the outage']));
      const [op] = await listOps();

      await killOp(op, 'Edit window expired (2 days after event)');

      expect(await listOps()).toHaveLength(0);
      const dead = await listDead();
      expect(dead).toHaveLength(1);
      expect(dead[0].body).toEqual({
        decisions: ['Written during the outage'],
      });
      expect(dead[0].reason).toContain('Edit window expired');
    });

    it('blocks whatever was waiting on it rather than firing at nothing', async () => {
      const event = await enqueue({
        kind: 'event.create',
        path: '/api/v1/events',
        method: 'POST',
        body: { id: 'doomedmeetingid000000aa' },
        entity: { type: 'event', id: 'doomedmeetingid000000aa' },
        label: 'Meeting',
        collapseByEntity: false,
      });
      await enqueue({
        kind: 'minutes.upsert',
        path: '/api/v1/events/doomedmeetingid000000aa/minutes',
        method: 'POST',
        body: { decisions: ['Inside a meeting that never lands'] },
        entity: { type: 'minutes', id: 'doomedmeetingid000000aa' },
        label: 'Meeting minutes',
        collapseByEntity: true,
      });

      await killOp(event as OutboxOp, 'Refused');

      const remaining = await listOps();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].status).toBe('blocked');
    });
  });

  it('forgets a write once it has landed', async () => {
    await enqueue(minutesOp(['Sent']));
    const [op] = await listOps();
    await resolveOp(op.opId);
    expect(await listOps()).toHaveLength(0);
    // Landing is the one exit that leaves no trace; everything else is kept.
    expect(await listDead()).toHaveLength(0);
  });
});
