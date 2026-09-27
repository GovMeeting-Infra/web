'use client';

import { useSyncExternalStore } from 'react';
import {
  getInstallState,
  getServerInstallState,
  subscribeToInstallState,
  type InstallState,
} from '@/lib/pwa/install';

/**
 * Whether this browser can install the app, and by which route.
 *
 * Capture is started by ServiceWorkerManager at the root, so this hook is only
 * a reader — it works the same whether it mounted before or after the browser
 * offered the prompt.
 */
export function useInstallPrompt(): InstallState {
  return useSyncExternalStore(
    subscribeToInstallState,
    getInstallState,
    getServerInstallState,
  );
}
