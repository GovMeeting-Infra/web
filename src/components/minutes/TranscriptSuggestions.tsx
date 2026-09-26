'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { apiFetch, ApiError, messageFor } from '@/lib/api/client';
import type { MinutesSuggestion, Transcript } from '@/lib/types/transcripts';
import { cn } from '@/lib/utils/cn';

interface Props {
  eventId: string;
  decisions: string[];
  nextSteps: string[];
  onAddDecision: (text: string) => void;
  onAddNextStep: (text: string) => void;
  /** Puts a suggested action item into the form, for an owner to be chosen. */
  onUseActionItem: (item: MinutesSuggestion['actionItems'][number]) => void;
  /** Only organizers can ask for a redraft; leadership can read and delete. */
  canDraft: boolean;
  disabled?: boolean;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What the AI made of the meeting's transcript, offered line by line.
 *
 * Nothing here writes to the minutes. Adding a suggestion puts it into the
 * editor's own lists, where it is saved, edited or dropped like anything the
 * organizer typed — the record is still theirs.
 */
export function TranscriptSuggestions({
  eventId,
  decisions,
  nextSteps,
  onAddDecision,
  onAddNextStep,
  onUseActionItem,
  canDraft,
  disabled,
}: Props) {
  const queryClient = useQueryClient();
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: transcript } = useQuery({
    queryKey: ['transcript', eventId],
    queryFn: async () => {
      try {
        return await apiFetch<Transcript>(`/api/v1/events/${eventId}/transcript`);
      } catch (err) {
        // No recording, or not one this person may read: show nothing.
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    // Poll while the draft is being written, then stop.
    refetchInterval: (query) =>
      query.state.data?.aiDraftStatus === 'PENDING' ? 5_000 : false,
  });

  if (!transcript) return null;

  const redraft = async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<Transcript>(
        `/api/v1/events/${eventId}/transcript/draft`,
        { method: 'POST' },
      );
      queryClient.setQueryData(['transcript', eventId], updated);
    } catch (err) {
      setError(messageFor(err, 'The draft could not be requested. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm('Delete this transcript? The minutes are not affected.')) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/events/${eventId}/transcript`, { method: 'DELETE' });
      queryClient.setQueryData(['transcript', eventId], null);
    } catch (err) {
      setError(messageFor(err, 'The transcript was not deleted. Try again.'));
      setBusy(false);
    }
  };

  const draft = transcript.aiDraftStatus === 'READY' ? transcript.aiDraft : null;
  const newDecisions = draft?.decisions.filter((d) => !decisions.some((x) => same(x, d))) ?? [];
  const newNextSteps = draft?.nextSteps.filter((d) => !nextSteps.some((x) => same(x, d))) ?? [];
  const minutes = Math.round(transcript.durationSec / 60);

  return (
    <section
      aria-label="Suggestions from the recording"
      className="space-y-5 rounded-[1.75rem] border border-border bg-card p-8 max-sm:p-4"
    >
      <div className="flex flex-wrap items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="font-semibold text-foreground">Suggested from the recording</h2>
          <p className="text-sm text-muted-foreground">
            Drafted by AI from {minutes > 0 ? `${minutes} min of` : 'the'} transcript. Add what is
            right, reword what is close, and leave the rest.
          </p>
        </div>
        {canDraft && transcript.status !== 'RECORDING' && transcript.aiDraftStatus !== 'PENDING' && (
          <button
            onClick={redraft}
            disabled={busy || disabled}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            {transcript.aiDraftStatus ? 'Draft again' : 'Draft minutes'}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {transcript.status === 'RECORDING' && (
        <p className="text-sm text-muted-foreground">
          This meeting is still being recorded. Suggestions appear once it stops.
        </p>
      )}
      {transcript.aiDraftStatus === 'PENDING' && (
        <p className="text-sm text-muted-foreground" role="status">
          Reading the transcript and drafting suggestions…
        </p>
      )}
      {transcript.aiDraftStatus === 'FAILED' && (
        <p className="text-sm text-destructive">{transcript.aiDraftError}</p>
      )}

      {draft && (
        <div className="space-y-5">
          <SuggestionList
            label="Decisions"
            items={newDecisions}
            onAdd={onAddDecision}
            disabled={disabled}
          />
          <SuggestionList
            label="Next steps"
            items={newNextSteps}
            onAdd={onAddNextStep}
            disabled={disabled}
          />
          {draft.actionItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Action items
              </h3>
              <ul className="space-y-2">
                {draft.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex-1 text-foreground">
                      {item.title}
                      {(item.ownerName || item.dueDate) && (
                        <span className="block text-xs text-muted-foreground">
                          {[item.ownerName, item.dueDate && `by ${item.dueDate}`]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onUseActionItem(item)}
                      disabled={disabled}
                      className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-secondary disabled:opacity-50"
                    >
                      Use
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {newDecisions.length === 0 &&
            newNextSteps.length === 0 &&
            draft.actionItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing more to suggest.</p>
            )}
          {draft.lowConfidenceNotes.length > 0 && (
            <div className="space-y-1 rounded-2xl border border-stat-gold-border bg-stat-gold-bg p-4 text-sm">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <AlertTriangle className="h-4 w-4 text-stat-gold-fg" aria-hidden="true" />
                Check against the transcript
              </p>
              <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
                {draft.lowConfidenceNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <button
          onClick={() => setShowTranscript((v) => !v)}
          aria-expanded={showTranscript}
          className="flex items-center gap-1.5 text-sm font-medium text-primary"
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform', showTranscript && 'rotate-180')}
            aria-hidden="true"
          />
          {showTranscript ? 'Hide transcript' : 'Show transcript'}
        </button>
        <button
          onClick={remove}
          disabled={busy || transcript.status === 'RECORDING'}
          className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete transcript
        </button>
      </div>

      {showTranscript && (
        <div className="max-h-96 space-y-3 overflow-y-auto rounded-2xl bg-muted/30 p-4">
          {transcript.segments.map((s, i) => (
            <p key={s.id ?? i} className="text-sm leading-relaxed text-foreground">
              {/* Nothing where the provider gave no speaker labels. */}
              {s.speaker !== null && (
                <span className="mr-2 font-semibold text-primary">
                  Speaker {s.speaker + 1}
                </span>
              )}
              {s.text}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function SuggestionList({
  label,
  items,
  onAdd,
  disabled,
}: {
  label: string;
  items: string[];
  onAdd: (text: string) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h3>
      <ul className="space-y-2">
        {items.map((text) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="flex-1 text-foreground">{text}</span>
            <button
              onClick={() => onAdd(text)}
              disabled={disabled}
              aria-label={`Add “${text}”`}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-secondary disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
