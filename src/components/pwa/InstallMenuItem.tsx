'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt';
import { promptInstall } from '@/lib/pwa/install';
import { InstallSheet } from './InstallSheet';

/**
 * "Install app", for the profile menu.
 *
 * Shown until the app is installed, whether or not the browser has offered a
 * prompt. It used to hide without one, which on phones meant it was almost never
 * there: iOS never fires beforeinstallprompt, and Chrome on Android withholds it
 * until it judges the site engaging enough and for months after one dismissal.
 * With a prompt in hand it shows the browser's dialog; without one it opens
 * steps for this browser's own menu, which installs in all of those cases.
 *
 * It also has to disappear once installed: the menu is height-capped (see the
 * comment on the panel in user-menu.tsx) and a permanent extra row would push
 * Sign out under the fold on a landscape phone.
 */
export function InstallMenuItem({ onDone }: { onDone: () => void }) {
  const { canInstall, isInstalled } = useInstallPrompt();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isInstalled) return null;

  const activate = async () => {
    if (canInstall) {
      onDone();
      await promptInstall();
      return;
    }
    // No prompt to show: point at the browser's own menu instead.
    setSheetOpen(true);
  };

  return (
    // The sheet lives inside the <li> rather than beside it: this renders into
    // the menu's <ul>, which may contain nothing but list items. The modal is
    // fixed-position, so where it sits in the tree costs nothing visually.
    <li>
      <button
        type="button"
        onClick={activate}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
      >
        <Download className="h-4 w-4" />
        Install app
      </button>

      <InstallSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          onDone();
        }}
      />
    </li>
  );
}
