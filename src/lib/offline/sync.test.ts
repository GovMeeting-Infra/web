import { describe, it, expect } from 'vitest';
import { classify } from './sync';
import { ApiError } from '@/lib/api/client';

/**
 * What a failure means for the write that caused it.
 *
 * The distinction that matters is between "not yet" and "never". Retrying a
 * never only hides the failure behind a spinner; treating a not-yet as a never
 * throws away somebody's work.
 */
describe('sync failure classification', () => {
  it('stops the run when the connection drops again', () => {
    // Not this write's fault, and working through the rest of the queue would
    // only fail them all in turn.
    expect(classify(new TypeError('Failed to fetch')).verdict).toBe('stop');
  });

  it('stops without discarding anything when the session has ended', () => {
    // A queue draining in the background must not throw someone out of a
    // half-written page, and their work must survive being asked to sign in.
    const result = classify(new ApiError('No user in request', 401));
    expect(result.verdict).toBe('stop');
    expect(result.reason).toMatch(/sign in/i);
  });

  it('retries a server that answered badly', () => {
    expect(classify(new ApiError('Something went wrong', 500)).verdict).toBe(
      'retry',
    );
    expect(classify(new ApiError('Bad gateway', 502)).verdict).toBe('retry');
  });

  it.each([
    ['the edit window closed', 403, 'Edit window expired (2 days after event)'],
    ['the meeting was deleted', 404, 'Not found'],
    ['the record is gone', 410, 'Gone'],
    ['the payload is invalid', 400, 'title should not be empty'],
  ])('gives up and keeps the text when %s', (_label, status, message) => {
    // Retrying cannot change any of these, and the person who typed it needs it
    // back rather than a spinner that never resolves.
    expect(classify(new ApiError(message, status)).verdict).toBe('dead');
  });

  it('passes the server’s own words through for a refusal', () => {
    // "Edit window expired" tells someone what to do about it; a generic
    // failure message does not.
    const result = classify(
      new ApiError('Edit window expired (2 days after event)', 403),
    );
    expect(result.reason).toContain('Edit window expired');
  });
});
