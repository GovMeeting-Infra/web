'use client';

import { Modal } from '@/components/ui/modal';
import type { SyncReport } from '@/lib/offline/sync';

/**
 * What happened while the queue was draining, when it was not simply "sent".
 *
 * Only ever shown for the two outcomes a person has to act on: their save
 * replaced somebody else's words, or it could not be saved at all. A run that
 * merely worked says nothing — the banner going away is the message.
 *
 * Overwritten lines are shown in full rather than summarised. The point of
 * returning them from the server was that a warning without the words is an
 * apology; putting them behind a "view details" would undo that.
 */
export function SyncReportDialog({
  report,
  onClose,
}: {
  report: SyncReport;
  onClose: () => void;
}) {
  const hasConflicts = report.conflicts.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={
        hasConflicts
          ? 'Your changes replaced someone else’s'
          : 'Some changes could not be saved'
      }
      description={
        hasConflicts
          ? 'Your version was saved. These are the lines it replaced, so you can put back anything that should not have gone.'
          : undefined
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Done
        </button>
      }
    >
      <div className="space-y-5 text-sm">
        {report.conflicts.map(({ label, conflict }, index) => (
          <section key={`conflict-${index}`} className="space-y-2">
            <h3 className="font-semibold text-foreground">{label}</h3>
            <p className="text-muted-foreground">
              Changed by someone else at{' '}
              {new Date(conflict.previousUpdatedAt).toLocaleString('en-GB')}.
            </p>
            <ReplacedLines
              heading="Decisions that were there before"
              lines={conflict.previousContent?.decisions ?? []}
            />
            <ReplacedLines
              heading="Next steps that were there before"
              lines={conflict.previousContent?.nextSteps ?? []}
            />
            <p className="text-xs text-muted-foreground">
              A copy is also kept in the activity log, so these are not lost
              when this message is closed.
            </p>
          </section>
        ))}

        {report.died.map((failure, index) => (
          <section
            key={`died-${index}`}
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-4"
          >
            <h3 className="font-semibold text-destructive">{failure.label}</h3>
            <p className="mt-1 text-muted-foreground">{failure.reason}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              What you wrote is still on this device. Open the meeting to copy
              it out.
            </p>
          </section>
        ))}
      </div>
    </Modal>
  );
}

function ReplacedLines({
  heading,
  lines,
}: {
  heading: string;
  lines: string[];
}) {
  if (!lines.length) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {heading}
      </p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
