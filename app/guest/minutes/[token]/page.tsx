import type { Metadata } from 'next';
import { CalendarDays, MapPin, Building2 } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { getGuestMinutes } from '@/lib/guest-minutes';
import { GuestActionItemCard } from './GuestActionItemCard';

/**
 * A personal link, so nothing here should reach an index. The token is in the
 * URL and a crawler following it would put a government record in a cache.
 */
export const metadata: Metadata = {
  title: 'Meeting minutes',
  robots: { index: false, follow: false },
};

function longDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function GuestMinutesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getGuestMinutes(token);

  // An unknown token, an unpublished record and an archived one all arrive here
  // identically — the server answers them the same way, so holding a link tells
  // you nothing about what exists.
  if (!data) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg p-6 text-center sm:p-10">
          <h1 className="text-xl font-bold text-[#003580]">
            These minutes aren&apos;t available
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The link may have expired, or the record may have been archived.
            Contact the organising ministry if you still need a copy.
          </p>
        </div>
      </PublicShell>
    );
  }

  const { event, minutes, actionItems, viewerEmail } = data;
  const mine = actionItems.filter((i) => i.isMine);

  return (
    <PublicShell>
      <article className="w-full space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#007236]">
            Meeting minutes
          </p>
          <h1 className="text-2xl font-bold text-[#003580] sm:text-3xl">
            {event.title}
          </h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <CalendarDays aria-hidden className="h-4 w-4" />
              {longDateTime(event.startAt)}
            </span>
            {event.venueName && (
              <span className="flex items-center gap-2">
                <MapPin aria-hidden className="h-4 w-4" />
                {event.venueName}
              </span>
            )}
            {event.ministryName && (
              <span className="flex items-center gap-2">
                <Building2 aria-hidden className="h-4 w-4" />
                {event.ministryName}
              </span>
            )}
          </div>
        </header>

        {mine.length > 0 && (
          <div className="rounded-2xl border border-[#fde8a6] bg-[#fff8e5] px-4 py-4 text-sm text-[#8d6400] sm:px-6">
            {mine.length === 1
              ? '1 action item below is assigned to you. You can update it here.'
              : `${mine.length} action items below are assigned to you. You can update them here.`}
          </div>
        )}

        {minutes.summary && (
          <section className="rounded-2xl border border-[#d3deef] bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {minutes.summary}
            </p>
          </section>
        )}

        <section className="rounded-2xl border border-[#d3deef] bg-white p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-slate-900">Minutes</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">
            {minutes.body}
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-900">
            Action items{actionItems.length > 0 && ` (${actionItems.length})`}
          </h2>

          {actionItems.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[#d3deef] p-6 text-center text-sm text-slate-500 sm:p-8">
              No action items were raised at this meeting.
            </p>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => (
                <GuestActionItemCard
                  key={item.id}
                  item={item}
                  token={token}
                />
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-slate-500">
          This link was sent to <span className="break-all">{viewerEmail}</span> and is personal to you. It stops
          working once the record is archived.
        </p>
      </article>
    </PublicShell>
  );
}
