import { describe, it, expect } from 'vitest';
import { matchOfflineRoute } from './routes';

/**
 * Which writes may wait, and — the part worth guarding — which may not.
 *
 * Deferring a write changes what it means. A request that emails people, or
 * whose meaning depends on the moment it runs, cannot honestly be replayed an
 * hour later, so the allowlist is the safety rule and these are the tests that
 * stop something being added to it by accident.
 */
describe('offline route allowlist', () => {
  describe('deferrable', () => {
    it.each([
      ['minutes', 'POST', '/api/v1/events/e1/minutes', 'minutes.upsert'],
      ['minutes via PATCH', 'PATCH', '/api/v1/events/e1/minutes', 'minutes.upsert'],
      ['a new meeting', 'POST', '/api/v1/events', 'event.create'],
      ['meeting details', 'PATCH', '/api/v1/events/e1', 'event.update'],
      ['repeat dates', 'POST', '/api/v1/events/e1/series', 'event.series'],
      [
        'a new action item',
        'POST',
        '/api/v1/events/e1/minutes/action-items',
        'actionItem.create',
      ],
      [
        'an action item change',
        'PATCH',
        '/api/v1/events/e1/action-items/a1',
        'actionItem.update',
      ],
      [
        'an offline register',
        'POST',
        '/api/v1/checkin/e1/offline-register',
        'attendance.register',
      ],
    ])('queues %s', (_label, method, path, kind) => {
      expect(matchOfflineRoute(path, method)?.route.kind).toBe(kind);
    });
  });

  describe('never deferred, and each for its own reason', () => {
    it.each([
      // Emails external recipients and mints guest tokens: queuing makes
      // "published" a lie for the length of an outage.
      ['publishing minutes', 'POST', '/api/v1/events/e1/minutes/publish'],
      // Each announces something. A cancellation arriving after the meeting has
      // been sat through is worse than one that failed loudly at the time.
      ['publishing a meeting', 'POST', '/api/v1/events/e1/publish'],
      ['cancelling a meeting', 'POST', '/api/v1/events/e1/cancel'],
      // The token lives five minutes; a queued request to mint one is
      // meaningless by the time it is sent.
      ['minting a check-in code', 'POST', '/api/v1/checkin-code/e1'],
      // An expiring signature and a multi-megabyte file.
      ['an upload signature', 'POST', '/api/v1/uploads/signature'],
      // Nothing about a session should be applied from an hour-old snapshot.
      ['signing in', 'POST', '/api/v1/auth/sign-in/email'],
      ['a session probe', 'POST', '/api/v1/auth/session'],
      ['administration', 'POST', '/api/v1/admin/users'],
      // A live check-in needs a token that has almost certainly expired.
      ['a live check-in', 'POST', '/api/v1/checkin/sometoken'],
      ['a manual check-in', 'POST', '/api/v1/checkin/e1/manual'],
    ])('refuses to queue %s', (_label, method, path) => {
      expect(matchOfflineRoute(path, method)).toBeNull();
    });

    it.each([
      ['DELETE', '/api/v1/events/e1'],
      ['GET', '/api/v1/events/e1/minutes'],
      ['PUT', '/api/v1/events/e1'],
    ])('never queues a %s', (method, path) => {
      // A queued DELETE replayed after somebody recreated the thing deletes the
      // new one. Reads have nothing to queue.
      expect(matchOfflineRoute(path, method)).toBeNull();
    });
  });

  it('does not let the meeting-update rule swallow its own sub-routes', () => {
    // /events/:id/minutes reads as /events/:id to a lazier pattern. It does not
    // here, because the segment stops at a slash — worth pinning, because the
    // failure would be a minutes save filed as a meeting edit.
    expect(matchOfflineRoute('/api/v1/events/e1/minutes', 'PATCH')?.route.kind).toBe(
      'minutes.upsert',
    );
    expect(matchOfflineRoute('/api/v1/events/e1', 'PATCH')?.route.kind).toBe(
      'event.update',
    );
  });

  it('reads the record id from the body for a create, and the path otherwise', () => {
    const create = matchOfflineRoute('/api/v1/events', 'POST');
    expect(create?.route.entityIdFromBody?.({ id: 'mintedbytheclient00000a' })).toBe(
      'mintedbytheclient00000a',
    );

    const update = matchOfflineRoute('/api/v1/events/e1', 'PATCH');
    expect(update?.route.entityId(update.match)).toBe('e1');
  });
});
