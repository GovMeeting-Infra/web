'use client';

/**
 * What the server sends back when a write landed on top of someone else's.
 *
 * Mirrors server/src/common/utils/write-conflict.util.ts. The important field
 * is the last one: a minutes save replaces the whole list rather than patching
 * it, so telling someone their lines were overwritten without returning them
 * would be an apology rather than a remedy.
 */
export interface WriteConflict<T = { decisions: string[]; nextSteps: string[] }> {
  overwritten: true;
  previousUpdatedAt: string;
  previousActor: { id: string | null; name: string | null } | null;
  previousContent: T | null;
}
