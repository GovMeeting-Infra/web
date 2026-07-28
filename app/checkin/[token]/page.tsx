import Link from 'next/link';
import { getCheckInContext } from '@/lib/checkin';
import { getCurrentUser } from '@/lib/session';
import { StaffCheckInForm } from './StaffCheckInForm';
import { GuestCheckInForm } from './GuestCheckInForm';

export const metadata = {
  title: 'Check in',
  robots: { index: false, follow: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6faff] p-4">
      <div className="w-full max-w-sm rounded-[1.5rem] border border-border bg-card p-6 shadow-lg">
        {children}
      </div>
    </main>
  );
}

function Notice({
  tone,
  title,
  body,
}: {
  tone: 'red' | 'amber' | 'slate';
  title: string;
  body: string;
}) {
  const tones = {
    red: 'border-destructive/20 bg-destructive/5 text-destructive',
    amber: 'border-[#fde8a6] bg-[#fff8e5] text-[#8d6400]',
    slate: 'border-border bg-muted/40 text-foreground',
  };

  return (
    <Shell>
      <div className={`rounded-[1.25rem] border p-5 text-center ${tones[tone]}`}>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm opacity-90">{body}</p>
      </div>
    </Shell>
  );
}

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ as?: string }>;
}) {
  const { token } = await params;
  const { as } = await searchParams;

  // Reading the session cookie makes this render dynamically, so no route
  // segment config is needed.
  const [context, user] = await Promise.all([
    getCheckInContext(token),
    getCurrentUser(),
  ]);

  // UNAVAILABLE (draft/cancelled) renders identically to INVALID on purpose: a
  // stranger holding a code should not learn an unpublished event exists.
  if (context.status === 'INVALID' || context.status === 'UNAVAILABLE') {
    return (
      <Notice
        tone="red"
        title="Invalid code"
        body="This check-in code was not recognized."
      />
    );
  }

  if (context.status === 'EXPIRED') {
    return (
      <Notice
        tone="amber"
        title="Code expired"
        body="Ask the meeting organizer for a fresh QR code."
      />
    );
  }

  if (context.status === 'ENDED') {
    return (
      <Notice
        tone="slate"
        title="Meeting ended"
        body="This meeting has ended. Check-in is closed."
      />
    );
  }

  const event = context.event!;
  const signInHref = `/login?callbackUrl=${encodeURIComponent(`/checkin/${token}`)}`;

  if (user) {
    return (
      <Shell>
        <StaffCheckInForm
          token={token}
          eventTitle={event.title}
          venueName={event.venueName}
          defaultName={user.name}
          geofenceRequired={context.geofenceRequired}
        />
      </Shell>
    );
  }

  if (as === 'guest' && event.allowGuestCheckIn) {
    return (
      <Shell>
        <GuestCheckInForm
          token={token}
          eventTitle={event.title}
          venueName={event.venueName}
          geofenceRequired={context.geofenceRequired}
          signInHref={signInHref}
        />
      </Shell>
    );
  }

  // Signed out: offer both routes rather than guessing who scanned the code.
  return (
    <Shell>
      <header className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Check in
        </p>
        <h1 className="mt-1 text-xl font-bold text-primary">{event.title}</h1>
        {event.venueName && (
          <p className="mt-1 text-sm text-muted-foreground">{event.venueName}</p>
        )}
      </header>

      <div className="mt-6 space-y-3">
        <Link
          href={signInHref}
          className="block w-full rounded-[1.25rem] bg-primary px-5 py-3 text-center text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Sign in to check in
        </Link>

        {event.allowGuestCheckIn ? (
          <Link
            href={`/checkin/${encodeURIComponent(token)}?as=guest`}
            className="block w-full rounded-[1.25rem] border border-border bg-background px-5 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
          >
            I&apos;m a guest
          </Link>
        ) : (
          <p className="rounded-xl bg-muted/40 p-3 text-center text-xs text-muted-foreground">
            This meeting is open to staff accounts only.
          </p>
        )}
      </div>

      {context.geofenceRequired && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          This meeting requires you to be physically at the venue.
        </p>
      )}
    </Shell>
  );
}
