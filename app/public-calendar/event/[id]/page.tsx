import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Clock, ExternalLink } from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { getPublicEvent } from '@/lib/public-events';
import { eventCategoryLabel } from '@/lib/event-colors';
import { EventBanner } from './EventBanner';
import type { PublicEventDetail } from '@/lib/types/events';

const NOT_AVAILABLE = 'Activity not available';

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
    <PublicShell
      hero={
        // Full-bleed, with the title over the photograph rather than stacked
        // above it. The solid brand colour is the base, so an activity with no
        // banner — or a dead image URL — still gets a deliberate hero.
        <section className="relative isolate overflow-hidden bg-[#003580]">
          {event.bannerImage && <EventBanner src={event.bannerImage} />}

          {/* Darkened top and bottom so white text holds up over any
              photograph, whatever its exposure. */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#001a3d]/75 via-[#001a3d]/55 to-[#001a3d]/85" />

          <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-24 lg:px-8">
            <span className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white backdrop-blur">
              {eventCategoryLabel(event.colorCategory, event.type)}
            </span>

            <p className="mt-6 text-sm font-medium text-white/80">
              {longDate(event.startAt)}
            </p>

            <h1 className="mt-3 text-balance text-4xl font-bold leading-tight text-white sm:text-5xl">
              {event.title}
            </h1>

            {event.ministry && (
              <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                by{' '}
                <span className="text-white underline underline-offset-4">
                  {event.ministry.name}
                </span>
              </p>
            )}
          </div>
        </section>
      }
    >
      <article className="w-full">
        {/* The practical facts, lifted out of the body and onto a strip
            directly under the hero: date and time on the left, the one action
            this page offers on the right. */}
        <div className="flex flex-col gap-6 rounded-2xl border border-[#d3deef] bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="flex items-center gap-3">
              <CalendarDays
                aria-hidden
                className="h-5 w-5 flex-none text-[#003580]"
              />
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {start.toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock aria-hidden className="h-5 w-5 flex-none text-[#003580]" />
              <div>
                <dt className="sr-only">Time</dt>
                <dd className="text-sm font-medium text-slate-900">
                  {start.toLocaleTimeString('en-GB', timeOpts)} –{' '}
                  {end.toLocaleTimeString('en-GB', timeOpts)}
                </dd>
              </div>
            </div>
          </dl>

          {event.externalUrl && (
            <a
              href={event.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#003580] px-8 py-3 text-sm font-semibold uppercase tracking-wide text-white transition-colors hover:bg-[#00296b] sm:flex-none"
            >
              <ExternalLink aria-hidden className="h-4 w-4" /> More information
            </a>
          )}
        </div>

        <div className="mt-12 grid gap-12 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-slate-900">
              Event Overview
            </h2>
            <div className="mt-5 h-px w-full bg-[#e6eef8]" />
            <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {event.description?.trim() ||
                `Further details for this activity have not been published yet. Check back closer to ${longDate(event.startAt)}.`}
            </p>
          </div>

          <aside className="space-y-8">
            {event.venueName && (
              <section>
                <h2 className="text-sm font-bold text-slate-900">Location</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {event.venueName}
                </p>
              </section>
            )}

            {(event.contactEmail || event.contactPhone) && (
              <section>
                <h2 className="text-sm font-bold text-slate-900">Contact</h2>
                <div className="mt-2 space-y-1 text-sm">
                  {event.contactEmail && (
                    <a
                      href={`mailto:${event.contactEmail}`}
                      className="block break-all text-[#003580] hover:underline"
                    >
                      {event.contactEmail}
                    </a>
                  )}
                  {event.contactPhone && (
                    <a
                      href={`tel:${event.contactPhone}`}
                      className="block text-[#003580] hover:underline"
                    >
                      {event.contactPhone}
                    </a>
                  )}
                </div>
              </section>
            )}

            <section>
              <h2 className="text-sm font-bold text-slate-900">
                More activities
              </h2>
              <Link
                href={`/?y=${start.getFullYear()}&m=${start.getMonth()}`}
                className="mt-2 inline-flex items-center gap-2 text-sm text-[#003580] hover:underline"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" /> Back to Calendar
              </Link>
            </section>
          </aside>
        </div>
      </article>
    </PublicShell>
  );
}
