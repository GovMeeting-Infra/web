export type TranscriptStatus = 'RECORDING' | 'COMPLETE' | 'FAILED';
export type AiDraftStatus = 'PENDING' | 'READY' | 'FAILED';

export interface TranscriptSegment {
  id?: string;
  /** The recogniser's guess at who spoke, numbered from 0. Not a person. */
  speaker: number | null;
  startMs: number;
  endMs: number;
  text: string;
}

export interface MinutesSuggestion {
  decisions: string[];
  nextSteps: string[];
  actionItems: {
    title: string;
    ownerName: string | null;
    /** YYYY-MM-DD, when a deadline was actually stated. */
    dueDate: string | null;
  }[];
  lowConfidenceNotes: string[];
}

export interface Transcript {
  id: string;
  status: TranscriptStatus;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  aiDraftStatus: AiDraftStatus | null;
  aiDraft: MinutesSuggestion | null;
  aiDraftError: string | null;
  segments: TranscriptSegment[];
}

/** Messages the transcription socket sends the browser. */
export type RecorderMessage =
  | { type: 'ready'; transcriptId: string }
  | {
      type: 'interim';
      segment: { text: string; speaker: number | null; start: number; end: number };
    }
  | { type: 'final'; segment: TranscriptSegment }
  | { type: 'error'; message: string; fatal?: boolean }
  | { type: 'stopped'; failed: boolean };
