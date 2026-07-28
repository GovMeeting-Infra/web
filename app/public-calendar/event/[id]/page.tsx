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
            <dl
              className={`grid grid-cols-1 gap-4 rounded-2xl border border-[#d3deef] bg-white p-6 sm:grid-cols-2 ${
                event.description ? 'lg:grid-cols-1' : 'lg:grid-cols-4'
              }`}
            >
              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarDays className="h-4 w-4" /> Date
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {start.toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </dd>
              </div>

              <div>
                <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <Clock className="h-4 w-4" /> Time
                </dt>
                <dd className="mt-1 text-sm font-medium text-slate-900">
                  {start.toLocaleTimeString('en-GB', timeOpts)} –{' '}
                  {end.toLocaleTimeString('en-GB', timeOpts)}
                </dd>
              </div>

              {event.venueName && (
                <div>
                  <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <MapPin className="h-4 w-4" /> Location
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-slate-900">
                    {event.venueName}
                  </dd>
                </div>
              )}

              {(event.contactEmail || event.contactPhone) && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contact
                  </dt>
                  <dd className="mt-1 space-y-1 text-sm font-medium text-slate-900">
                    {event.contactEmail && (
                      <a
                        href={`mailto:${event.contactEmail}`}
                        className="flex items-center gap-2 hover:text-[#003580]"
                      >
                        <Mail className="h-4 w-4" /> {event.contactEmail}
                      </a>
                    )}
                    {event.contactPhone && (
                      <a
                        href={`tel:${event.contactPhone}`}
                        className="flex items-center gap-2 hover:text-[#003580]"
                      >
                        <Phone className="h-4 w-4" /> {event.contactPhone}
                      </a>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {event.externalUrl && (
              <a
                href={event.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-[#003580] px-5 py-2.5 text-sm font-medium text-white"
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
