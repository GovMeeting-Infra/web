'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, ScrollText, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { TableSkeleton } from '@/components/ui/skeletons';
import { PageContainer } from '@/components/ui/page-container';
import {
  AUDIT_STATUS_STYLES,
  auditTimestamp,
  humanise,
  type AuditListResponse,
} from '@/lib/types/audit';

const PAGE_SIZE = 50;

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'SUCCESS', label: 'Success' },
  { value: 'FAILURE', label: 'Failure' },
];

export function ActivityLogView({ isPlatformWide }: { isPlatformWide: boolean }) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Super-admins only. A minister's scope comes from their own record, and the
  // API discards this if they send it anyway.
  const [ministryId, setMinistryId] = useState('');
  const [page, setPage] = useState(0);

  const { data: categories = [] } = useQuery({
    queryKey: ['audit-categories', ministryId],
    queryFn: () => {
      const p = new URLSearchParams();
      if (ministryId) p.set('ministryId', ministryId);
      return apiFetch<string[]>(`/api/v1/audit/categories?${p.toString()}`);
    },
  });

  const { data: ministries = [] } = useQuery({
    queryKey: ['ministry-options'],
    queryFn: () =>
      apiFetch<{ id: string; name: string }[]>(
        '/api/v1/events/ministry-options',
      ),
    enabled: isPlatformWide,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', q, category, status, from, to, ministryId, page],
    queryFn: () => {
      const p = new URLSearchParams();
      if (q.trim()) p.set('q', q.trim());
      if (category) p.set('category', category);
      if (status) p.set('status', status);
      // The date inputs give a day; widen to the whole day so "to" includes it.
      if (from) p.set('from', new Date(`${from}T00:00:00`).toISOString());
      if (to) p.set('to', new Date(`${to}T23:59:59.999`).toISOString());
      if (ministryId) p.set('ministryId', ministryId);
      p.set('skip', String(page * PAGE_SIZE));
      p.set('take', String(PAGE_SIZE));
      return apiFetch<AuditListResponse>(`/api/v1/audit?${p.toString()}`);
    },
  });

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;
  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);

  const reset = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const hasFilters = !!(q.trim() || category || status || from || to || ministryId);

  return (
    <PageContainer>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-ring">
          Oversight
        </p>
        <h1 className="text-3xl font-bold text-primary">Activity Log</h1>
        <p className="mt-2 text-muted-foreground">
          {isPlatformWide
            ? 'Every recorded action across all ministries'
            : 'Every recorded action in your ministry'}
        </p>
      </div>

      <div className="space-y-3 rounded-[1.5rem] border border-border bg-card p-5">
        <div className="flex flex-wrap gap-3">
          <div className="relative min-w-0 flex-1">
            <label htmlFor="audit-search" className="sr-only">
              Search the activity log
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="audit-search"
              type="search"
              value={q}
              onChange={(e) => reset(() => setQ(e.target.value))}
              placeholder="Search action, description or record…"
              className="w-full rounded-xl border border-border bg-muted/40 py-2.5 pl-9 pr-9 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none"
            />
            {q && (
              <button
                onClick={() => reset(() => setQ(''))}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <select
            value={category}
            onChange={(e) => reset(() => setCategory(e.target.value))}
            aria-label="Filter by category"
            className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {humanise(c)}
              </option>
            ))}
          </select>

          {isPlatformWide && (
            <select
              value={ministryId}
              onChange={(e) => reset(() => setMinistryId(e.target.value))}
              aria-label="Filter by ministry"
              className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:border-ring focus:outline-none"
            >
              <option value="">All ministries</option>
              {ministries.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
              {/* Sign-in failures for an unknown address belong to no
                  ministry, and are otherwise only findable by scrolling. */}
              <option value="none">Platform-level</option>
            </select>
          )}

          <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => reset(() => setStatus(s.value))}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  status === s.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            From
            <input
              type="date"
              value={from}
              onChange={(e) => reset(() => setFrom(e.target.value))}
              className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-foreground focus:border-ring focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-2 text-muted-foreground">
            To
            <input
              type="date"
              value={to}
              onChange={(e) => reset(() => setTo(e.target.value))}
              className="rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-foreground focus:border-ring focus:outline-none"
            />
          </label>
          {hasFilters && (
            <button
              onClick={() =>
                reset(() => {
                  setQ('');
                  setCategory('');
                  setStatus('');
                  setFrom('');
                  setTo('');
                  setMinistryId('');
                })
              }
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear all filters
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {total} {total === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error instanceof Error ? error.message : 'Could not load the activity log.'}
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={8} columns={isPlatformWide ? 6 : 5} label="Loading activity" />
      ) : entries.length === 0 ? (
        <div className="rounded-[1.5rem] border border-border bg-card p-12 text-center">
          <ScrollText className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            {hasFilters ? 'Nothing matches those filters' : 'No activity recorded yet'}
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="border-b border-border bg-muted/40 text-left">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">When</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Who</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Action</th>
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Record</th>
                    {isPlatformWide && (
                      <th className="px-4 py-3 font-semibold text-muted-foreground">Ministry</th>
                    )}
                    <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((e) => (
                    <tr key={e.id} className="align-top hover:bg-muted/30">
                      {/* Seconds matter in an audit trail — two actions a moment
                          apart must be distinguishable and orderable. */}
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-foreground">
                        {auditTimestamp(e.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {e.actor ? (
                          <>
                            <span className="block text-foreground">{e.actor.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {e.actor.email}
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">System</span>
                        )}
                        {e.ipAddress && (
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {e.ipAddress}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium text-foreground">
                          {humanise(e.action)}
                        </span>
                        {e.description && (
                          <span className="block text-xs text-muted-foreground">
                            {e.description}
                          </span>
                        )}
                        <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {humanise(e.actionCategory)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-foreground">
                          {e.entityName ?? e.entityType}
                        </span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {e.entityType}
                        </span>
                      </td>
                      {isPlatformWide && (
                        <td className="px-4 py-3 text-muted-foreground">
                          {/* Platform-level events (a failed sign-in for an
                              unknown address) belong to no ministry. */}
                          {e.ministry?.name ?? (
                            <span className="italic">Platform</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${AUDIT_STATUS_STYLES[e.status]}`}
                        >
                          {humanise(e.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {lastPage > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Page {page + 1} of {lastPage + 1}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-medium text-foreground disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 font-medium text-foreground disabled:opacity-40"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
