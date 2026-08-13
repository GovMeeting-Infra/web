'use client';

import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarDays, FileText, DoorOpen, Users, SearchX } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { initialsOf, type SearchResults } from '@/lib/types/account';
import { PageContainer } from '@/components/ui/page-container';

function Section({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {title} ({count})
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

const card =
  'block rounded-[1.25rem] border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-[0_8px_24px_rgba(0,53,128,0.08)]';

export function SearchResultsView() {
  const params = useSearchParams();
  const q = params.get('q') ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['search', q],
    queryFn: () =>
      apiFetch<SearchResults>(`/api/v1/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });

  const total = data
    ? data.events.length + data.minutes.length + data.rooms.length + data.people.length
    : 0;

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Global search
        </p>
        <h1 className="text-3xl font-bold text-primary">
          {q ? `Results for “${q}”` : 'Search'}
        </h1>
        {data && !data.tooShort && (
          <p className="mt-2 text-muted-foreground">
            {total} {total === 1 ? 'result' : 'results'}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Search failed'}
        </div>
      )}

      {q.trim().length < 2 && (
        <p className="rounded-[1.5rem] border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
          Enter at least 2 characters to search.
        </p>
      )}

      {isLoading && q.trim().length >= 2 && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center text-muted-foreground">
          Searching…
        </div>
      )}

      {data && !data.tooShort && total === 0 && !isLoading && (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <SearchX className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">No results found</p>
        </div>
      )}

      {data && total > 0 && (
        <div className="space-y-6">
          <Section
            icon={<CalendarDays className="h-4 w-4" />}
            title="Events"
            count={data.events.length}
          >
            {data.events.map((e) => (
              <Link key={e.id} href={`/administrative/events/${e.id}`} className={card}>
                <p className="font-medium text-primary">{e.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(e.startAt).toLocaleDateString(undefined, {
                    dateStyle: 'medium',
                  })}
                  {e.organizer ? ` · ${e.organizer.name}` : ''}
                </p>
              </Link>
            ))}
          </Section>

          <Section
            icon={<FileText className="h-4 w-4" />}
            title="Meeting minutes"
            count={data.minutes.length}
          >
            {data.minutes.map((m) => (
              <Link
                key={m.id}
                href={`/administrative/events/${m.event.id}/minutes`}
                className={card}
              >
                <p className="font-medium text-primary">{m.event.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {m.snippet}
                </p>
              </Link>
            ))}
          </Section>

          <Section
            icon={<DoorOpen className="h-4 w-4" />}
            title="Rooms"
            count={data.rooms.length}
          >
            {data.rooms.map((r) => (
              <Link key={r.id} href={`/administrative/rooms/${r.id}`} className={card}>
                <p className="font-medium text-primary">{r.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.location} · {r.capacity} people
                </p>
              </Link>
            ))}
          </Section>

          {/* Only populated for admin roles; the API returns an empty list otherwise. */}
          <Section
            icon={<Users className="h-4 w-4" />}
            title="People"
            count={data.people.length}
          >
            {data.people.map((p) => (
              <div key={p.id} className={card.replace('hover:border-primary/30', '')}>
                <p className="flex items-center gap-2 font-medium text-foreground">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                    {initialsOf(p.name)}
                  </span>
                  {p.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.email}
                  {p.jobTitle ? ` · ${p.jobTitle}` : ''}
                </p>
              </div>
            ))}
          </Section>
        </div>
      )}
    </PageContainer>
  );
}
