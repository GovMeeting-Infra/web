import type { Metadata } from 'next';
import { OfflineNotice } from './OfflineNotice';

/**
 * The document the service worker falls back to when a navigation cannot be
 * served from the network or from cache.
 *
 * force-static because it is precached at install: it must render identically
 * for everyone, hold nothing user-specific, and above all never need the API to
 * produce itself, since the one condition it exists for is the API being
 * unreachable.
 */
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Offline',
  // Nothing here should ever appear in search results.
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f6faff',
        color: '#11243d',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <OfflineNotice />
    </div>
  );
}
