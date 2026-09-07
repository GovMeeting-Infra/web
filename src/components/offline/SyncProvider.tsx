'use client';

import { useEffect, useState } from 'react';
import { startSyncEngine, onSyncReport, type SyncReport } from '@/lib/offline/sync';
import { loadClockOffset } from '@/lib/offline/clock';
import { SyncReportDialog } from './SyncReportDialog';

/**
 * Runs the queue, and surfaces the two outcomes a person has to know about.
 *
 * Mounted inside the administrative shell rather than at the root: the queue
 * only ever holds a signed-in user's work, and starting a sync loop on the
 * public calendar or a guest check-in page would be a timer with nothing to do.
 */
export function SyncProvider() {
  const [report, setReport] = useState<SyncReport | null>(null);

  useEffect(() => {
    void loadClockOffset();
    const stop = startSyncEngine();
    const unsubscribe = onSyncReport(setReport);
    return () => {
      stop();
      unsubscribe();
    };
  }, []);

  if (!report) return null;

  return <SyncReportDialog report={report} onClose={() => setReport(null)} />;
}
