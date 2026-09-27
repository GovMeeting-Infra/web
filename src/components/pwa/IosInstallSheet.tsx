'use client';

import { Modal } from '@/components/ui/modal';

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

const STEPS = [
  { n: 1, text: 'Tap the Share button', glyph: true },
  { n: 2, text: 'Scroll down and tap "Add to Home Screen"' },
  { n: 3, text: 'Tap "Add"' },
];

/**
 * How to install on iPhone and iPad.
 *
 * iOS Safari does not fire beforeinstallprompt and never will, so there is no
 * button that can do this on someone's behalf — written instructions are the
 * whole of the mechanism, not a fallback.
 */
export function IosInstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Install on this device"
      description="Adding the app to your Home Screen opens it in its own window, without the address bar."
    >
      <ol className="space-y-3">
        {STEPS.map((step) => (
          <li key={step.n} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary"
            >
              {step.n}
            </span>
            <span className="flex items-center gap-2 text-sm text-foreground">
              {step.text}
              {step.glyph && <ShareGlyph className="h-5 w-5 text-primary" />}
            </span>
          </li>
        ))}
      </ol>

      {/* Both are things people hit within the first minute and conclude the
          app is broken, so they are said here rather than left to be
          discovered. */}
      <div className="mt-5 space-y-2 rounded-[1rem] bg-muted p-3 text-xs text-muted-foreground">
        <p>
          On an iPhone the Share button is at the bottom of the screen. On an
          iPad it is at the top right.
        </p>
        <p>
          The installed app keeps its own sign-in, so you will be asked for your
          password once more inside it. That is expected.
        </p>
      </div>
    </Modal>
  );
}
