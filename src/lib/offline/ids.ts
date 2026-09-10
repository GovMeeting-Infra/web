'use client';

import { createId } from '@paralleldrive/cuid2';

/**
 * A primary key minted here rather than by the database.
 *
 * This is what makes an offline write ordinary instead of special. The record
 * has its real identity from the moment it is typed, so the page can navigate
 * to /administrative/events/<id> immediately and that address stays correct
 * once it syncs; an action item can reference minutes that have not reached the
 * server yet; and a retry is an exact duplicate of a value the database has a
 * unique index on, which is the whole of the idempotency story.
 *
 * cuid2 rather than the cuid v1 Prisma uses for @default(cuid()). The server
 * validator checks shape and bounds rather than one flavour precisely so the
 * two can differ — and cuid2 is the maintained one, with collision resistance
 * that matters more here than matching a format: these are generated on devices
 * that cannot ask anyone whether an id is already taken.
 */
export function newId(): string {
  return createId();
}
