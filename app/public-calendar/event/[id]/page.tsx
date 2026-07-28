import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Mail,
  Phone,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { PublicShell } from '@/components/PublicShell';
import { getPublicEvent } from '@/lib/public-events';
import { eventColor, eventCategoryLabel } from '@/lib/event-colors';
import { EventBanner } from './EventBanner';
import type { PublicEventDetail } from '@/lib/types/events';

const NOT_AVAILABLE = 'Activity not available';

/**
 * One key fact about the activity.
 *
 * The badge spans both rows of a two-row grid, so the label and value sit in a
 * clean column beside it however long the value runs — the previous flat
 * icon-above-text pairs gave every fact the same weight and read as a form.
 */
function Detail({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof CalendarDays;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] items-start gap-x-4">
      <span
        aria-hidden
        className="row-span-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf4fd] text-[#003580]"
      >
        <Icon className="h-4 w-4" />
      </span>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 min-w-0 text-sm font-semibold text-slate-900">
        {children}
      </dd>
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

          <div className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-[#d3deef] bg-white">
              <h2 className="border-b border-[#eaf1fa] bg-[#f8fbff] px-6 py-3.5 text-sm font-semibold text-[#003580]">
                Activity details
              </h2>

              {/* One column while this sits in the side rail; when there is no
                  description it has the full width to itself and spreads out
                  rather than running as one tall list. */}
              <dl
                className={`grid gap-x-8 gap-y-6 p-6 ${
                  event.description
                    ? 'grid-cols-1'
                    : 'sm:grid-cols-2 lg:grid-cols-4'
                }`}
              >
                <Detail icon={CalendarDays} label="Date">
                  {start.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Detail>

                <Detail icon={Clock} label="Time">
                  {start.toLocaleTimeString('en-GB', timeOpts)} –{' '}
                  {end.toLocaleTimeString('en-GB', timeOpts)}
                </Detail>

                {event.venueName && (
                  <Detail icon={MapPin} label="Location">
                    {event.venueName}
                  </Detail>
                )}

                {/* Email and phone are separate facts, so they get a row each
                    rather than being stacked under one "Contact" heading. */}
                {event.contactEmail && (
                  <Detail icon={Mail} label="Email">
                    <a
                      href={`mailto:${event.contactEmail}`}
                      className="break-all text-[#003580] underline-offset-2 hover:underline"
                    >
                      {event.contactEmail}
                    </a>
                  </Detail>
                )}

                {event.contactPhone && (
                  <Detail icon={Phone} label="Phone">
                    <a
                      href={`tel:${event.contactPhone}`}
                      className="text-[#003580] underline-offset-2 hover:underline"
                    >
                      {event.contactPhone}
                    </a>
                  </Detail>
                )}
              </dl>
            </div>

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
