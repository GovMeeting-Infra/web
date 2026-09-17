import { apiFetch } from '@/lib/api/client';
import { SW_SCOPE } from './config';

export interface PushStatus {
  /** Whether this deployment has VAPID keys at all. */
  configured: boolean;
  /** The VAPID public key, or null when push is not configured. */
  publicKey: string | null;
  /** How many devices this account currently has registered. */
  devices: number;
}

/** What the browser will let us do, before anything is asked of the user. */
export type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

export function pushPermission(): PushPermission {
  if (typeof window === 'undefined') return 'unsupported';
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported';
  return Notification.permission;
}

export function getPushStatus(): Promise<PushStatus> {
  return apiFetch<PushStatus>('/api/v1/notifications/push');
}

/**
 * Whether this browser already has a subscription for this app.
 *
 * Asked of the registration rather than remembered locally: the browser is the
 * authority, and a flag in localStorage goes stale the moment someone revokes
 * the permission from the address bar.
 */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;
  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Asks for permission, subscribes, and records the subscription server-side.
 *
 * Must be called from a real user gesture. Chrome penalises sites that ask on
 * load, and a refusal is close to permanent — once somebody presses Block, the
 * app cannot ask again and they have to find the setting in the browser
 * themselves. So this is only ever reached from a button, after the page has
 * explained what it is for.
 */
export async function enablePush(publicKey: string): Promise<PushSubscription> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('This browser cannot receive notifications.');
  }

  const registration = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (!registration) {
    // Push is delivered to a service worker, so without one there is nothing
    // to deliver to. Worth saying plainly rather than failing obscurely.
    throw new Error('Notifications need the app to be running its background helper.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked for this site in your browser settings.'
        : 'Notifications were not allowed.',
    );
  }

  const subscription = await registration.pushManager.subscribe({
    // Required to be true, and honest: every push this app sends results in a
    // visible notification. A browser will drop a subscription that receives
    // silent pushes.
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(publicKey),
  });

  await apiFetch('/api/v1/notifications/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      ...subscription.toJSON(),
      userAgent: navigator.userAgent.slice(0, 400),
    }),
  });

  return subscription;
}

/**
 * Stops this device receiving pushes.
 *
 * The server row goes first. If the order were reversed and the request failed,
 * the browser would have no subscription while the server still held the
 * endpoint — and the server would go on encrypting messages to an endpoint that
 * nothing will ever collect, with no way for this device to ask again.
 */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;

  await apiFetch('/api/v1/notifications/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  });

  await subscription.unsubscribe();
}

/**
 * The VAPID public key arrives base64url-encoded and must be handed to
 * pushManager.subscribe as bytes.
 *
 * base64url is not base64: it swaps two characters and drops the padding, so
 * atob rejects it until both are put back.
 */
function decodeVapidKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  // Backed by an explicit ArrayBuffer: `new Uint8Array(length)` is typed as
  // Uint8Array<ArrayBufferLike>, which could be a SharedArrayBuffer, and
  // applicationServerKey will not accept one.
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
