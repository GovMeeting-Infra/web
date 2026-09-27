'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { messageFor } from '@/lib/api/client';
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt';
import {
  currentSubscription,
  disablePush,
  enablePush,
  getPushStatus,
  pushPermission,
  type PushStatus,
} from '@/lib/pwa/push';

type State =
  | { kind: 'loading' }
  /** Nothing here can be offered, and why. */
  | { kind: 'unavailable'; reason: string | null }
  /** Permission was refused; the app cannot ask again. */
  | { kind: 'blocked' }
  | { kind: 'off'; publicKey: string }
  | { kind: 'on'; otherDevices: number };

/**
 * Works out which of the five states applies, and returns it.
 *
 * Separate from the component so that every answer arrives the same way — after
 * an await — rather than some being set synchronously and some not.
 */
async function determineState(isIos: boolean, isInstalled: boolean): Promise<State> {
  const permission = pushPermission();
  if (permission === 'unsupported') {
    return { kind: 'unavailable', reason: 'This browser cannot show notifications.' };
  }

  // iOS delivers push only to a copy added to the Home Screen — in a Safari tab
  // there is nothing to deliver to. Saying so is the difference between a
  // missing feature and a broken one.
  if (isIos && !isInstalled) {
    return {
      kind: 'unavailable',
      reason:
        'On iPhone and iPad, notifications work only once the app has been added to your Home Screen.',
    };
  }

  let status: PushStatus;
  try {
    status = await getPushStatus();
  } catch {
    return { kind: 'unavailable', reason: null };
  }

  // No VAPID keys on this deployment: not a fault, and not this person's
  // problem, so it is simply not offered.
  if (!status.configured || !status.publicKey) {
    return { kind: 'unavailable', reason: null };
  }

  const subscription = await currentSubscription();
  if (subscription) {
    return { kind: 'on', otherDevices: Math.max(0, status.devices - 1) };
  }

  if (permission === 'denied') return { kind: 'blocked' };

  return { kind: 'off', publicKey: status.publicKey };
}

/**
 * Turning on push for THIS device.
 *
 * Per device, and said so plainly: a subscription belongs to one browser on one
 * machine, so somebody who turns it on at their desk and then wonders why their
 * phone is silent has not hit a bug.
 *
 * Nothing here asks for permission until a button is pressed. Chrome penalises
 * sites that prompt on load, and the cost of a refusal is not symmetrical — a
 * granted permission can be withdrawn, but a denied one cannot be asked for
 * again, so a badly-timed prompt costs that person push for good.
 */
export function PushNotificationSetting() {
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isIos, isInstalled } = useInstallPrompt();

  const refresh = useCallback(async () => {
    setState(await determineState(isIos, isInstalled));
  }, [isIos, isInstalled]);

  useEffect(() => {
    // Guarded because determineState awaits the network: without it, a slow
    // first answer could land after a later one and overwrite it.
    let cancelled = false;
    void (async () => {
      const next = await determineState(isIos, isInstalled);
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [isIos, isInstalled]);

  const turnOn = async () => {
    if (state.kind !== 'off') return;
    setBusy(true);
    setError(null);
    try {
      await enablePush(state.publicKey);
    } catch (e) {
      setError(messageFor(e, 'Notifications could not be turned on.'));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const turnOff = async () => {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
    } catch (e) {
      setError(messageFor(e, 'Notifications could not be turned off.'));
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  if (state.kind === 'loading') {
    return <p className="text-sm text-muted-foreground">Checking…</p>;
  }

  if (state.kind === 'unavailable') {
    // A null reason means there is nothing useful to tell them — push is not
    // configured on this deployment, or the check itself failed. Better to show
    // nothing than a control that cannot work.
    if (!state.reason) return null;
    return <p className="text-sm text-muted-foreground">{state.reason}</p>;
  }

  if (state.kind === 'blocked') {
    return (
      <div className="text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Blocked by your browser</p>
        <p className="mt-1">
          Notifications were refused for this site, and the app cannot ask again.
          To change it, open your browser&rsquo;s site settings for this page —
          on a computer, the icon at the left of the address bar — and set
          Notifications to Allow.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {state.kind === 'on' ? 'On for this device' : 'Off for this device'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {state.kind === 'on'
              ? state.otherDevices > 0
                ? `Also on for ${state.otherDevices} other ${state.otherDevices === 1 ? 'device' : 'devices'}.`
                : 'This is the only device set up to receive them.'
              : 'Meeting reminders, minutes and anything assigned to you, on this device even when the app is closed.'}
          </p>
        </div>
        <Button
          size="sm"
          variant={state.kind === 'on' ? 'secondary' : 'default'}
          onClick={state.kind === 'on' ? turnOff : turnOn}
          disabled={busy}
        >
          {busy ? 'Working…' : state.kind === 'on' ? 'Turn off' : 'Turn on'}
        </Button>
      </div>

      {error && (
        <p role="status" aria-live="polite" className="mt-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
