'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { apiFetch, ApiError } from '@/lib/api/client';
import { eventColor, eventCategoryLabel } from '@/lib/event-colors';
import type { PublicEventDetail } from '@/lib/types/events';

export default function PublicEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['public-event', id],
    queryFn: () => apiFetch<PublicEventDetail>(`/api/v1/public/events/${id}`),
    retry: false,
  });

  // A draft or internal event returns 404 here by design, so treat any failure
  // as "not publicly listed" rather than surfacing backend detail.
  const notFound = error instanceof ApiError && error.status === 404;

  if (isLoading) {
    return (
      <PublicShell>
        <p className="p-10 text-center text-sm text-slate-500">Loading activity…</p>
      </PublicShell>
    );
  }

  if (notFound || !event) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg p-10 text-center">
          <h1 className="text-xl font-bold text-[#003580]">Activity not available</h1>
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
      <article className="mx-auto max-w-3xl space-y-6">
        <Link
          href={`/?y=${start.getFullYear()}&m=${start.getMonth()}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-[#003580]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Calendar
        </Link>

        {event.bannerImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.bannerImage}
            alt=""
            className="h-56 w-full rounded-2xl border border-[#d3deef] object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        )}

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

        <dl className="grid grid-cols-1 gap-4 rounded-2xl border border-[#d3deef] bg-white p-6 sm:grid-cols-2">
          <div>
            <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-4 w-4" /> Date
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {start.toLocaleDateString(undefined, {
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
              {start.toLocaleTimeString(undefined, timeOpts)} –{' '}
              {end.toLocaleTimeString(undefined, timeOpts)}
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

        {event.description && (
          <section className="rounded-2xl border border-[#d3deef] bg-white p-6">
            <h2 className="text-sm font-semibold text-slate-900">About this activity</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
              {event.description}
            </p>
          </section>
        )}

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
      </article>
    </PublicShell>
  );
}
