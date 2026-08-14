'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, UserCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api/client';
import { Skeleton } from './skeleton';

export interface DirectoryPerson {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
}

/**
 * Picks a colleague from the ministry directory.
 *
 * Backed by /api/v1/users/directory, which is readable by any signed-in user —
 * the administrative user list is not, so assigning work could not previously
 * be done by the staff who actually raise action items.
 */
export function PersonPicker({
  value,
  valueName,
  onChange,
  placeholder = 'Search for a colleague…',
  allowUnassign = true,
  disabled = false,
  endpoint = '/api/v1/users/directory',
  excludeIds,
}: {
  value: string | null;
  /** Display name for an already-selected person, so no lookup is needed. */
  valueName?: string | null;
  onChange: (person: DirectoryPerson | null) => void;
  placeholder?: string;
  allowUnassign?: boolean;
  disabled?: boolean;
  /**
   * Source of candidates. Defaults to the ministry directory; co-organizer
   * pickers point at the events endpoint, which already excludes the caller.
   * Must return the same {id, name, email, jobTitle} shape.
   */
  endpoint?: string;
  /** People already chosen, so they are not offered again. */
  excludeIds?: string[];
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: candidates = [], isLoading } = useQuery({
    queryKey: ['person-picker', endpoint, query],
    queryFn: () => {
      // Only the directory endpoint filters server-side; the others return a
      // full list, which is filtered below.
      const url = endpoint.includes('?')
        ? `${endpoint}&q=${encodeURIComponent(query.trim())}`
        : `${endpoint}?q=${encodeURIComponent(query.trim())}`;
      return apiFetch<DirectoryPerson[]>(url);
    },
    enabled: open,
  });

  const term = query.trim().toLowerCase();
  const people = candidates
    .filter((p) => !excludeIds?.includes(p.id))
    .filter(
      (p) =>
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.email.toLowerCase().includes(term),
    );

  // Close on an outside click so the list does not sit over the form.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (value && valueName) {
    return (
      <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
        <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {valueName}
        </span>
        {allowUnassign && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label="Remove assignee"
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative mt-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={query}
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-muted/50 py-2 pl-9 pr-3 text-sm text-foreground placeholder-muted-foreground focus:border-ring focus:outline-none disabled:opacity-60"
      />

      {open && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-card shadow-lg">
          {isLoading ? (
            // Rows the shape of the results that replace them, so the dropdown
            // does not resize under the pointer as matches arrive.
            <li role="status" aria-live="polite" className="px-3 py-2">
              <span className="sr-only">Searching</span>
              <div className="space-y-3" aria-hidden>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-2/5" />
                      <Skeleton className="h-3 w-3/5" />
                    </div>
                  </div>
                ))}
              </div>
            </li>
          ) : people.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No colleagues match “{query.trim()}”
            </li>
          ) : (
            people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p);
                    setQuery('');
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <UserCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-foreground">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.jobTitle ? `${p.jobTitle} · ` : ''}
                      {p.email}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
