import { createHash } from 'crypto';
import { Client } from 'pg';
import { FIXTURE } from '../fixtures/accounts';

/**
 * Gives the suite an account to sign in with, without shipping one.
 *
 * Seeding was removed from this project deliberately (see "Remove the
 * seed-account system"): real accounts are created through the application by
 * an administrator, and the scripts that pre-made three logins were a
 * development convenience that could reach a real database. What that decision
 * ruled out was seed accounts in the product. It did not rule out a test
 * fixture — but it did leave the suite signing in with a password nobody had
 * set, which is why every spec failed and nobody noticed for months.
 *
 * So this reconstructs the guard rather than the seed: it refuses to touch
 * anything but a database on this machine, and it sets the password through the
 * application's own forgot/reset endpoints rather than writing a hash itself.
 * That means no copy of BetterAuth's hashing lives here to drift out of date,
 * and the fixture exercises the same code a real password reset does.
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

function assertLocal(databaseUrl: string): void {
  let host: string;
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error(
      'Cypress fixture: DATABASE_URL could not be parsed, so it cannot be shown to be local. Refusing to run.',
    );
  }

  if (!LOCAL_HOSTS.has(host)) {
    /*
     * The whole point of this file.
     *
     * server/.env points at a hosted database, and prisma.config.ts prefers
     * DIRECT_URL over DATABASE_URL — so "I overrode the connection string" is
     * not by itself evidence that anything local is being used. A fixture that
     * creates users and resets passwords must never be one environment variable
     * away from doing that somewhere real.
     */
    throw new Error(
      `Cypress fixture: refusing to provision against "${host}". ` +
        'This creates accounts and resets passwords, so it runs only against a database on this machine.',
    );
  }
}

export interface ProvisionOptions {
  databaseUrl: string;
  apiUrl: string;
}

export interface FixtureAccounts {
  admin: { email: string; password: string };
  outsider: { email: string; password: string };
}

/**
 * Done once per run, not once per sign-in.
 *
 * Every spec calls cy.login(), so without this a run reissues the password for
 * both accounts dozens of times — and forgot-password is rate limited to five
 * attempts per quarter of an hour, quite rightly. The suite would then fail on
 * a protection working exactly as intended, which is a confusing way to spend
 * an afternoon.
 *
 * Node keeps this for the life of the Cypress process, so a new run still
 * provisions afresh and a fixture nobody has created yet is still created.
 */
let provisioned: Promise<FixtureAccounts> | null = null;

/** Returns the credentials the suite should sign in with. */
export function provisionFixture(
  options: ProvisionOptions,
): Promise<FixtureAccounts> {
  if (!provisioned) {
    provisioned = provisionOnce(options).catch((error) => {
      // Do not cache a failure: the usual cause is the API not being up yet,
      // and the next spec deserves a fresh attempt rather than a replayed
      // error that no longer describes anything.
      provisioned = null;
      throw error;
    });
  }
  return provisioned;
}

async function provisionOnce({
  databaseUrl,
  apiUrl,
}: ProvisionOptions): Promise<FixtureAccounts> {
  assertLocal(databaseUrl);

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();

  try {
    await db.query(
      `INSERT INTO "Ministry" (id, name, code, "emailDomain", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, now(), now())
       ON CONFLICT (id) DO UPDATE SET active = true`,
      [
        FIXTURE.ministry.id,
        FIXTURE.ministry.name,
        FIXTURE.ministry.code,
        FIXTURE.ministry.emailDomain,
      ],
    );

    await db.query(
      `INSERT INTO "User" (id, email, name, "systemRole", "ministryId", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"SystemRole", $5, true, now(), now())
       ON CONFLICT (id) DO UPDATE SET active = true, "deletedAt" = NULL`,
      [
        FIXTURE.admin.id,
        FIXTURE.admin.email,
        FIXTURE.admin.name,
        FIXTURE.admin.systemRole,
        FIXTURE.ministry.id,
      ],
    );

    await db.query(
      `INSERT INTO "User" (id, email, name, "systemRole", "ministryId", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"SystemRole", $5, true, now(), now())
       ON CONFLICT (id) DO UPDATE SET active = true, "deletedAt" = NULL`,
      [
        FIXTURE.deputy.id,
        FIXTURE.deputy.email,
        FIXTURE.deputy.name,
        FIXTURE.deputy.systemRole,
        FIXTURE.ministry.id,
      ],
    );

    await db.query(
      `INSERT INTO "Ministry" (id, name, code, "emailDomain", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, now(), now())
       ON CONFLICT (id) DO UPDATE SET active = true`,
      [
        FIXTURE.otherMinistry.id,
        FIXTURE.otherMinistry.name,
        FIXTURE.otherMinistry.code,
        FIXTURE.otherMinistry.emailDomain,
      ],
    );

    await db.query(
      `INSERT INTO "User" (id, email, name, "systemRole", "ministryId", active, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4::"SystemRole", $5, true, now(), now())
       ON CONFLICT (id) DO UPDATE SET active = true, "deletedAt" = NULL`,
      [
        FIXTURE.outsider.id,
        FIXTURE.outsider.email,
        FIXTURE.outsider.name,
        FIXTURE.outsider.systemRole,
        FIXTURE.otherMinistry.id,
      ],
    );

    /*
     * The password goes on through the application, not through SQL.
     *
     * A reset token is minted by the API, stored as a sha256 of a value only
     * the email would have carried — so the token itself cannot be read back
     * out. Rather than reimplement BetterAuth's hashing to write the password
     * directly, this substitutes a token it knows the hash of and then calls
     * the real reset endpoint. The credential is written by the same code that
     * writes a real one.
     */
    /**
     * Whether the account already has the password we are about to set.
     *
     * Worth asking, because resetting is not free: forgot-password allows five
     * attempts per quarter of an hour, quite rightly, and a suite run twice in
     * that window would otherwise fail on a protection working exactly as
     * intended. Most runs find the password already in place and skip the
     * whole exchange.
     *
     * One failed sign-in on a fresh database is safe: the lockout is five, and
     * the successful sign-in that follows the reset clears the counter.
     */
    const passwordAlreadyWorks = async (email: string, password: string) => {
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        return response.ok;
      } catch {
        // The API is unreachable. Say nothing here; the reset below will fail
        // with a message that explains it.
        return false;
      }
    };

    const setPassword = async (
      userId: string,
      email: string,
      password: string,
    ) => {
      if (await passwordAlreadyWorks(email, password)) return;

      await fetch(`${apiUrl}/api/v1/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const token = `cypress-fixture-${userId}-${Date.now()}`;
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const updated = await db.query(
        `UPDATE "Verification"
            SET value = $1, "expiresAt" = now() + interval '1 hour'
          WHERE identifier = $2`,
        [tokenHash, `reset:${userId}`],
      );

      if (updated.rowCount === 0) {
        throw new Error(
          `Cypress fixture: the API did not create a reset token for ${email}. ` +
            'Either it is not running and pointed at this same database, or ' +
            'password resets have been rate limited — five per quarter hour, ' +
            'per address.',
        );
      }

      const reset = await fetch(
        `${apiUrl}/api/v1/auth/reset-password/${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        },
      );

      if (!reset.ok) {
        throw new Error(
          `Cypress fixture: could not set the password for ${email} (${reset.status}).`,
        );
      }
    };

    await setPassword(
      FIXTURE.admin.id,
      FIXTURE.admin.email,
      FIXTURE.admin.password,
    );
    await setPassword(
      FIXTURE.outsider.id,
      FIXTURE.outsider.email,
      FIXTURE.outsider.password,
    );

    return {
      admin: {
        email: FIXTURE.admin.email,
        password: FIXTURE.admin.password,
      },
      outsider: {
        email: FIXTURE.outsider.email,
        password: FIXTURE.outsider.password,
      },
    };
  } finally {
    await db.end();
  }
}

/**
 * Remove what a run created, leaving a developer's own data alone.
 *
 * Scoped by the fixture ids rather than by "everything", because this runs
 * against the same local database people work in.
 */
export async function cleanupFixture(databaseUrl: string): Promise<null> {
  assertLocal(databaseUrl);

  const db = new Client({ connectionString: databaseUrl });
  await db.connect();
  try {
    // Events cascade to their minutes, attendance and attendees.
    await db.query(`DELETE FROM "Event" WHERE "ministryId" = ANY($1)`, [
      [FIXTURE.ministry.id, FIXTURE.otherMinistry.id],
    ]);
    await db.query(`DELETE FROM "Session" WHERE "userId" = ANY($1)`, [
      [FIXTURE.admin.id, FIXTURE.outsider.id, FIXTURE.deputy.id],
    ]);
    return null;
  } finally {
    await db.end();
  }
}
