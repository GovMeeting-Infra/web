'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt';
import { promptInstall } from '@/lib/pwa/install';
import { IosInstallSheet } from './IosInstallSheet';

/**
 * "Install app", for the profile menu.
 *
 * Renders nothing unless this browser can actually do something — a button that
 * does nothing when tapped is worse than no button, and beforeinstallprompt is
 * absent on iOS, inside in-app webviews, on Firefox for Android, and on Chrome
 * for a while after someone dismisses the prompt once.
 *
 * It also has to disappear once installed: the menu is height-capped (see the
 * comment on the panel in user-menu.tsx) and a permanent extra row would push
 * Sign out under the fold on a landscape phone.
 */
export function InstallMenuItem({ onDone }: { onDone: () => void }) {
  const { canInstall, isInstalled, isIosSafari } = useInstallPrompt();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isInstalled) return null;
  if (!canInstall && !isIosSafari) return null;

  const activate = async () => {
    if (canInstall) {
      onDone();
      await promptInstall();
      return;
    }
    // iOS: instructions are the only route there is.
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

      <IosInstallSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          onDone();
        }}
      />
    </li>
  );
}
