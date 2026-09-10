/**
 * What to call this build when the environment did not say.
 *
 * next.config always sets NEXT_PUBLIC_BUILD_ID, so this is only reached in a
 * context that did not go through it — a test runner, or a stray import. A
 * constant rather than something derived: a value that changed per call would
 * make the persisted cache look stale on every render and be thrown away each
 * time, which is a slow and confusing way to have no cache at all.
 */
export const NEXT_PUBLIC_BUILD_ID_FALLBACK = 'dev';
