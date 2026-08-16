'use client';

import { useState, useSyncExternalStore } from 'react';
import { MapPinOff, RefreshCw, Copy, Check } from 'lucide-react';
import {
  detectPlatform,
  detectInAppBrowser,
  type Platform,
  type InAppBrowser,
} from '@/lib/platform';
import {
  recoverySteps,
  inAppAdvice,
  DESK_FALLBACK,
  type HelpReason,
} from '@/lib/checkin/locationHelp';

/** Nothing to subscribe to: the user agent does not change while we watch it. */
const NEVER_CHANGES = () => () => {};

/**
 * The user agent, read on the client only.
 *
 * useSyncExternalStore rather than an effect because that is exactly what it is
 * for — a value the server cannot know and the client can. The server snapshot
 * renders the neutral copy, and React swaps in the real one on hydration with
 * no cascading render.
 */
function useClientPlatform(): { platform: Platform; inApp: InAppBrowser } {
  const platform = useSyncExternalStore(
    NEVER_CHANGES,
    () => detectPlatform(navigator.userAgent, navigator),
    () => 'unknown' as Platform,
  );
  const inApp = useSyncExternalStore(
    NEVER_CHANGES,
    () => detectInAppBrowser(navigator.userAgent),
    () => null as InAppBrowser,
  );

  return { platform, inApp };
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
      {steps.map((step) => (
        <li key={step}>{step}</li>
      ))}
    </ol>
  );
}

/** Escaping a webview: on Android this genuinely opens Chrome. */
function CopyLink() {
  const [copied, setCopied] = useState(false);
  const href = useSyncExternalStore(
    NEVER_CHANGES,
    () => window.location.href,
    () => '',
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access is itself a permission, and webviews are exactly where
      // it gets refused. Showing the address is the fallback that always works.
      setCopied(false);
    }
  };

  return (
    <div className="mt-3 space-y-2">
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-2 rounded-lg border border-current/30 px-3 py-1.5 text-xs font-medium"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      <input
        readOnly
        value={href}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Check-in link"
        className="w-full rounded-lg border border-current/20 bg-white/60 px-2 py-1 text-[11px] text-slate-700"
      />
    </div>
  );
}

/**
 * What to do when the browser will not share a location.
 *
 * Inline rather than a modal, and for a specific reason: on an iPhone, changing
 * the location setting often reloads this tab, so anything held in a dialog is
 * gone at exactly the moment it is needed. A permanent block on the page
 * survives that, and does not cover the copy-link control on a small screen.
 */
export function LocationHelp({
  reason,
  message,
  onRetry,
  busy,
}: {
  reason: HelpReason;
  /** The server's own words, where the failure came from the API. */
  message?: string | null;
  onRetry?: () => void;
  busy?: boolean;
}) {
  const { platform, inApp } = useClientPlatform();
  const help = recoverySteps(platform, reason);
  const webview = inAppAdvice(inApp, platform);

  return (
    <div className="mt-4 rounded-xl border border-[#fde8a6] bg-[#fff8e5] p-4 text-left text-[#8d6400]">
      <div className="flex items-start gap-3">
        <MapPinOff aria-hidden className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{help.headline}</p>
          {message && <p className="mt-1 text-xs leading-relaxed">{message}</p>}

          {/* A webview is the problem before the settings are, so it goes
              first — changing a permission will not help if the app never
              offers one. */}
          {webview ? (
            <>
              <p className="mt-3 text-xs font-semibold">{webview.headline}</p>
              <Steps steps={webview.steps} />
              <CopyLink />
              {webview.note && (
                <p className="mt-2 text-[11px] opacity-80">{webview.note}</p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium">
                  Already in Chrome or Safari?
                </summary>
                <Steps steps={help.steps} />
              </details>
            </>
          ) : (
            <>
              <Steps steps={help.steps} />
              {help.osSteps && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    {help.osTitle ?? 'Still not working?'}
                  </summary>
                  <Steps steps={help.osSteps} />
                </details>
              )}
              {help.note && (
                <p className="mt-2 text-[11px] opacity-80">{help.note}</p>
              )}
            </>
          )}

          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              disabled={busy}
              className="mt-3 flex items-center gap-2 rounded-lg bg-[#8d6400] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
              {busy ? 'Trying…' : 'Try again'}
            </button>
          )}

          <p className="mt-3 text-[11px] opacity-80">{DESK_FALLBACK}</p>
        </div>
      </div>
    </div>
  );
}
