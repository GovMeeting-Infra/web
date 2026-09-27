'use client';

import { Modal } from '@/components/ui/modal';
import { detectInAppBrowser, detectPlatform } from '@/lib/platform';
import { installHelp } from '@/lib/pwa/installHelp';

/**
 * iOS Safari's Share glyph, drawn rather than named.
 *
 * The instruction is "tap the button that looks like this", so the shape has to
 * be on the page — there is no icon in lucide that matches what iOS actually
 * draws, and describing it in words is how people end up tapping the wrong
 * control.
 */
function ShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none">
      <path
        d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * How to install when the browser offers no prompt of its own.
 *
 * iOS never fires beforeinstallprompt, and Chrome on Android often holds it
 * back, but every one of those browsers can still install from its own menu —
 * so the steps are the mechanism here, not a fallback.
 */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Read only once the sheet is open, which is always in the browser.
  const help = open
    ? installHelp(
        detectPlatform(navigator.userAgent, navigator),
        detectInAppBrowser(navigator.userAgent),
      )
    : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install on this device"
      description="Installed, the app opens in its own window without the address bar."
    >
      {help && (
        <>
          <p className="mb-3 text-sm font-semibold text-foreground">{help.headline}</p>
          <ol className="space-y-3">
            {help.steps.map((text, i) => (
              <li key={text} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary"
                >
                  {i + 1}
                </span>
                <span className="flex items-center gap-2 text-sm text-foreground">
                  {text}
                  {help.shareGlyph && i === 0 && (
                    <ShareGlyph className="h-5 w-5 shrink-0 text-primary" />
                  )}
                </span>
              </li>
            ))}
          </ol>

          {/* Things people hit within the first minute and conclude the app is
              broken, so they are said here rather than left to be discovered. */}
          {help.notes.length > 0 && (
            <div className="mt-5 space-y-2 rounded-[1rem] bg-muted p-3 text-xs text-muted-foreground">
              {help.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
