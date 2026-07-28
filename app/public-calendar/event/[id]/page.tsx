import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Building2 } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { getPublicEvent } from '@/lib/public-events';
import { eventColor, eventCategoryLabel } from '@/lib/event-colors';
import { EventBanner } from './EventBanner';
import type { PublicEventDetail } from '@/lib/types/events';

const NOT_AVAILABLE = 'Activity not available';

/**
 * The date, as a calendar tile.
 *
 * Marked aria-hidden and paired with a full written date for screen readers:
 * split across three lines it reads as "Sep 4 2026", which is not a date.
 */
function DateTile({ date }: { date: Date }) {
  return (
    <div
      aria-hidden
      className="flex h-[4.75rem] w-16 flex-none flex-col items-center justify-center rounded-xl border border-[#d3deef] bg-[#f8fbff]"
    >
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#003580]">
        {date.toLocaleDateString('en-GB', { month: 'short' })}
      </span>
      <span className="text-2xl font-bold leading-tight text-[#003580]">
        {date.getDate()}
      </span>
      <span className="text-[11px] text-slate-500">{date.getFullYear()}</span>
    </div>
  );
}

function longDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * What a share card shows. Falls back to a generated line when the activity has
 * no description of its own, so a link is never posted with only a title.
 */
function summarise(event: PublicEventDetail): string {
  const own = event.description?.trim();
  if (own) {
    return own.length > 200 ? `${own.slice(0, 197)}…` : own;
  }

  const parts = [longDate(event.startAt)];
  if (event.venueName) parts.push(event.venueName);
  if (event.ministry) parts.push(`Hosted by ${event.ministry.name}`);
  return parts.join(' · ');
}

/**
 * Per-event metadata is the whole reason this page is a server component. As a
 * client component it could not export this, so every public activity shared
 * anywhere showed the generic site title and no image.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const event = await getPublicEvent(id);

  if (!event) {
    return {
      title: NOT_AVAILABLE,
      // Nothing to index, and nothing about an unpublished event should leak
      // into a crawler's cache.
      robots: { index: false, follow: false },
    };
  }

  const description = summarise(event);
  const images = event.bannerImage ? [{ url: event.bannerImage }] : undefined;

  return {
    title: event.title,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'article',
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: event.title,
      description,
      images: event.bannerImage ? [event.bannerImage] : undefined,
    },
  };
}

export default async function PublicEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await getPublicEvent(id);

  // A draft, an internal meeting and an unknown id all arrive here identically
  // by design. Someone following a stale link gets an explanation rather than a
  // bare 404.
  if (!event) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg p-10 text-center">
          <h1 className="text-xl font-bold text-[#003580]">{NOT_AVAILABLE}</h1>
          <p className="mt-2 text-sm text-slate-600">
            This activity isn&apos;t published on the public calendar. It may have been
            removed, or it may not be a public event.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-xl bg-[#003580] px-5 py-2.5 text-sm font-medium text-white"
          >
            Back to Calendar
          </Link>
        </div>
      </PublicShell>
    );
  }

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  const timeOpts = { hour: '2-digit', minute: '2-digit' } as const;

  return (
    <PublicShell>
      {/* Fills the shell's content column rather than sitting at max-w-3xl
          inside it — at 768px the page was half the width of its own header
          and footer, which is what made it look cramped. */}
      <article className="w-full space-y-6">
        <Link
          href={`/?y=${start.getFullYear()}&m=${start.getMonth()}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#003580]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Calendar
        </Link>

        {event.bannerImage && <EventBanner src={event.bannerImage} />}

        <header className="space-y-3">
          <span
            className={`inline-block rounded border px-2.5 py-1 text-xs font-medium ${eventColor(
              event.colorCategory,
              event.type,
            )}`}
          >
            {eventCategoryLabel(event.colorCategory, event.type)}
          </span>
          <h1 className="text-3xl font-bold text-[#003580]">{event.title}</h1>
          {event.ministry && (
            <p className="flex items-center gap-2 text-sm text-slate-600">
              <Building2 className="h-4 w-4" />
              Hosted by {event.ministry.name}
            </p>
          )}
        </header>

        {/* Two columns once there is room: what the activity is on the left,
            the practical detail a visitor came for on the right. With no
            description there is no left column, so the details take the full
            width instead of leaving two thirds of the row empty. */}
        <div
          className={
            event.description ? 'grid gap-6 lg:grid-cols-3' : 'space-y-6'
          }
        >
          {event.description && (
            <section className="rounded-2xl border border-[#d3deef] bg-white p-6 lg:col-span-2">
              <h2 className="text-sm font-semibold text-slate-900">
                About this activity
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                {event.description}
              </p>
            </section>
          )}

          {/* The date anchors the panel; everything under it is plain lines,
              separated by hairlines rather than labelled or boxed. */}
          <div className="space-y-5 rounded-2xl border border-[#d3deef] bg-white p-6">
            <div className="flex items-center gap-4">
              <DateTile date={start} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {start.toLocaleDateString('en-GB', { weekday: 'long' })}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {start.toLocaleTimeString('en-GB', timeOpts)} –{' '}
                  {end.toLocaleTimeString('en-GB', timeOpts)}
                </p>
                {/* What the tile cannot say out loud. */}
                <span className="sr-only">
                  {start.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {event.venueName && (
              <p className="border-t border-[#eef3fa] pt-5 text-sm text-slate-900">
                <span className="sr-only">Location: </span>
                {event.venueName}
              </p>
            )}

            {(event.contactEmail || event.contactPhone) && (
              <div className="space-y-1.5 border-t border-[#eef3fa] pt-5 text-sm">
                {event.contactEmail && (
                  <a
                    href={`mailto:${event.contactEmail}`}
                    className="block break-all text-[#003580] hover:underline"
                  >
                    <span className="sr-only">Email: </span>
                    {event.contactEmail}
                  </a>
                )}
                {event.contactPhone && (
                  <a
                    href={`tel:${event.contactPhone}`}
                    className="block text-[#003580] hover:underline"
                  >
                    <span className="sr-only">Phone: </span>
                    {event.contactPhone}
                  </a>
                )}
              </div>
            )}

            {event.externalUrl && (
              <a
                href={event.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003580] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#00296b]"
              >
                <ExternalLink className="h-4 w-4" /> More information
              </a>
            )}
          </div>
        </div>
      </article>
    </PublicShell>
  );
}
