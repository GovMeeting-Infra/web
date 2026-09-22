'use client';

import { use, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Mic, Pause, Play, Square, ShieldCheck, FileText } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/client';
import type { EventDetail } from '@/lib/types/events';
import type { Transcript, TranscriptSegment } from '@/lib/types/transcripts';
import { PageContainer } from '@/components/ui/page-container';
import { CardSkeleton } from '@/components/ui/skeletons';
import { isRecordingSupported, useMeetingRecorder } from '@/lib/hooks/useMeetingRecorder';
import { cn } from '@/lib/utils/cn';

const noSubscribe = () => () => {};

function clock(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Speaker numbers are the recogniser's guess, so they read as "Speaker 1", not a name. */
function speakerLabel(speaker: number | null): string {
  return speaker === null ? 'Speaker' : `Speaker ${speaker + 1}`;
}

/**
 * Consecutive lines from the same voice read as one paragraph. Without this a
 * long answer is a column of fragments, each repeating the same label.
 */
function groupBySpeaker(segments: TranscriptSegment[]) {
  const groups: { speaker: number | null; text: string; key: string }[] = [];
  segments.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (last && last.speaker === s.speaker) last.text += ` ${s.text}`;
    else groups.push({ speaker: s.speaker, text: s.text, key: s.id ?? `live-${i}` });
  });
  return groups;
}

export default function RecordMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [announced, setAnnounced] = useState(false);
  // Read from the browser after hydration; the server render assumes yes.
  const supported = useSyncExternalStore(
    noSubscribe,
    isRecordingSupported,
    () => true,
  );
  // What had already been said when this session started. Frozen so a refetch
  // mid-meeting cannot show the lines this session added twice.
  const [before, setBefore] = useState<TranscriptSegment[] | null>(null);
  const recorder = useMeetingRecorder(id);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => apiFetch<EventDetail>(`/api/v1/events/${id}`),
  });

  // What was already said, when a recording is being resumed.
  const { data: earlier } = useQuery({
    queryKey: ['transcript', id],
    queryFn: async () => {
      try {
        return await apiFetch<Transcript>(`/api/v1/events/${id}/transcript`);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    refetchOnWindowFocus: false,
  });

  const { state, segments, interim, error, elapsedMs } = recorder;
  const live = state === 'recording' || state === 'paused' || state === 'reconnecting';
  const busy = live || state === 'starting' || state === 'stopping';

  // Warn before a tab close takes the microphone away mid-meeting.
  useEffect(() => {
    if (!live) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [live]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [segments.length, interim?.text]);

  useEffect(() => {
    if (state === 'stopped') {
      queryClient.invalidateQueries({ queryKey: ['transcript', id] });
    }
  }, [state, id, queryClient]);

  if (isLoading) {
    return (
      <PageContainer>
        <CardSkeleton lines={4} label="Loading meeting" />
      </PageContainer>
    );
  }

  const shown = [...(before ?? earlier?.segments ?? []), ...segments];

  const handleStart = () => {
    // Only the first time: the hook keeps this page's own lines across a
    // stop and restart, and a refetched transcript already contains them.
    setBefore((prev) => prev ?? earlier?.segments ?? []);
    void recorder.start();
  };
  const groups = groupBySpeaker(shown);

  return (
    <PageContainer className="space-y-8">
      <Link
        href={`/administrative/events/${id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Event
      </Link>

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-success">Transcription</p>
        <h1 className="text-3xl font-bold text-primary">Record meeting</h1>
        {event && <p className="mt-2 text-muted-foreground">{event.title}</p>}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      {!supported ? (
        <div className="rounded-[1.75rem] border border-border bg-card p-6 text-sm text-muted-foreground sm:p-8">
          This browser cannot record audio. Use a current version of Chrome, Edge, Firefox or Safari.
        </div>
      ) : (
        <div className="space-y-5 rounded-[1.75rem] border border-border bg-card p-6 sm:p-8">
          {/* The privacy promise, said plainly where the organizer decides. */}
          <div className="flex gap-3 rounded-2xl bg-secondary/60 p-4 text-sm text-foreground">
            <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
            <p>
              The sound of the meeting is never saved — not on this platform and not by the
              transcription service. It is turned into text as people speak, and only the text is
              kept. Krio is transcribed as it sounds in English, so check the text before relying on
              it.
            </p>
          </div>

          {!busy && state !== 'stopped' && (
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={announced}
                onChange={(e) => setAnnounced(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border"
              />
              I have told everyone in the meeting that it is being transcribed.
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            {!busy && state !== 'stopped' && (
              <button
                onClick={handleStart}
                disabled={!announced}
                className="flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-medium text-primary-foreground disabled:opacity-50"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                {earlier?.segments.length ? 'Resume recording' : 'Start recording'}
              </button>
            )}

            {state === 'starting' && (
              <span className="text-sm text-muted-foreground">Opening the microphone…</span>
            )}

            {live && (
              <>
                <span
                  className="flex items-center gap-2 font-mono text-lg tabular-nums text-foreground"
                  aria-live="off"
                >
                  <span
                    className={cn(
                      'h-3 w-3 rounded-full',
                      state === 'recording' ? 'animate-pulse bg-destructive' : 'bg-muted-foreground',
                    )}
                    aria-hidden="true"
                  />
                  {clock(elapsedMs)}
                </span>
                <span className="text-sm text-muted-foreground" role="status">
                  {state === 'recording' && 'Recording'}
                  {state === 'paused' && 'Paused — nothing is being heard'}
                  {state === 'reconnecting' && 'Connection lost, reconnecting…'}
                </span>
                <div className="ml-auto flex gap-2">
                  {state === 'recording' && (
                    <button
                      onClick={recorder.pause}
                      className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 font-medium text-foreground hover:bg-muted/50"
                    >
                      <Pause className="h-4 w-4" aria-hidden="true" /> Pause
                    </button>
                  )}
                  {state === 'paused' && (
                    <button
                      onClick={recorder.resume}
                      className="flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 font-medium text-foreground hover:bg-muted/50"
                    >
                      <Play className="h-4 w-4" aria-hidden="true" /> Resume
                    </button>
                  )}
                  <button
                    onClick={recorder.stop}
                    className="flex items-center gap-2 rounded-2xl bg-destructive px-4 py-3 font-medium text-white"
                  >
                    <Square className="h-4 w-4" aria-hidden="true" /> Stop
                  </button>
                </div>
              </>
            )}

            {state === 'stopping' && (
              <span className="text-sm text-muted-foreground" role="status">
                Finishing the last few words…
              </span>
            )}
          </div>

          {state === 'stopped' && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stat-green-border bg-stat-green-bg p-4 text-sm text-success">
              <p className="flex-1">
                Recording stopped and the transcript is saved. Suggested minutes are being drafted —
                they will appear in the minutes editor in a minute or two.
              </p>
              <Link
                href={`/administrative/events/${id}/minutes`}
                className="flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 font-medium text-primary-foreground"
              >
                <FileText className="h-4 w-4" aria-hidden="true" /> Open minutes
              </Link>
            </div>
          )}
        </div>
      )}

      {(groups.length > 0 || interim) && (
        <section aria-label="Live transcript" className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Transcript</h2>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto rounded-[1.75rem] border border-border bg-card p-6 sm:p-8">
            {groups.map((g) => (
              <p key={g.key} className="text-sm leading-relaxed text-foreground">
                <span className="mr-2 font-semibold text-primary">{speakerLabel(g.speaker)}</span>
                {g.text}
              </p>
            ))}
            {interim && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="mr-2 font-semibold">{speakerLabel(interim.speaker)}</span>
                {interim.text}
              </p>
            )}
            <div ref={bottomRef} />
          </div>
        </section>
      )}
    </PageContainer>
  );
}
