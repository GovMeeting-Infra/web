import type { InAppBrowser, Platform } from '@/lib/platform';

/**
 * What went wrong, in terms a person can act on. Narrower than the raw
 * geolocation reasons, because several of them want the same advice.
 */
export type HelpReason =
  | 'DENIED'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'UNSUPPORTED'
  | 'INSECURE'
  | 'ACCURACY'
  | 'OUTSIDE';

export interface HelpBlock {
  headline: string;
  steps: string[];
  /** The phone's own location switch, one layer below the browser's. */
  osSteps?: string[];
  osTitle?: string;
  note?: string;
}

/**
 * The site permission, per browser.
 *
 * Kept as data rather than JSX so the wording can be read and corrected in one
 * place — these menus get relabelled most years, and the paths will drift.
 * Hedged wording ("the tune or lock icon") is deliberate for the same reason.
 */
const DENIED_STEPS: Record<Platform, HelpBlock> = {
  'ios-safari': {
    headline: 'Allow location for Safari',
    steps: [
      'Tap aA at the left of the address bar.',
      'Tap Website Settings, then Location, then Allow.',
      'Come back here and tap Try again.',
    ],
    osTitle: 'Still not working?',
    osSteps: [
      'Open Settings, then Privacy & Security, then Location Services.',
      'Turn Location Services on.',
      'Tap Safari Websites and choose While Using the App, with Precise Location on.',
    ],
    note: 'iPhone may reload this page when you come back. If the form is empty, fill it in again.',
  },
  'ios-other': {
    headline: 'This browser has its own location permission',
    steps: [
      'Open Settings, then Privacy & Security, then Location Services.',
      'Find this browser in the list and choose While Using the App, with Precise Location on.',
      'Come back, reload this page, and tap Allow when asked.',
    ],
    osTitle: 'Where is it?',
    osSteps: [
      'Allowing Safari does not cover Chrome, Edge or Firefox on an iPhone — each is listed separately.',
      'In Chrome you can also try the three dots, then Settings, then Content Settings, then Location.',
    ],
  },
  'android-chrome': {
    headline: 'Allow location for this site',
    steps: [
      'Tap the tune or lock icon at the left of the address bar.',
      'Tap Permissions, then Location, then Allow.',
      'Come back here and tap Try again.',
    ],
    osTitle: 'Still not working?',
    osSteps: [
      'Open Settings, then Location, and turn it on.',
      'Open Settings, then Apps, then Chrome, then Permissions, then Location.',
      'Choose "Allow only while using the app" and turn on precise location.',
    ],
  },
  'samsung-internet': {
    headline: 'Allow location for this site',
    steps: [
      'Tap the lock icon in the address bar, then Permissions, then Location, then Allow.',
      'Or open the menu, then Settings, then Sites and downloads, then Site permissions, then Location, and move this site out of Blocked.',
      'Reload this page and tap Try again.',
    ],
    osTitle: 'Still not working?',
    osSteps: [
      'Open Settings, then Location, and turn it on.',
      'Open Settings, then Apps, then Samsung Internet, then Permissions, then Location.',
    ],
  },
  'android-other': {
    headline: 'Allow location for this site',
    steps: [
      'Tap the lock or info icon in the address bar and look for Permissions or Location.',
      'Set Location to Allow.',
      'Reload this page and tap Try again.',
    ],
    osTitle: 'Still not working?',
    osSteps: [
      'Open Settings, then Location, and turn it on.',
      'Open Settings, then Apps, find your browser, then Permissions, then Location.',
    ],
  },
  'desktop-chromium': {
    headline: 'Allow location for this site',
    steps: [
      'Click the location or tune icon in the address bar.',
      'Set Location to Allow, then reload the page.',
    ],
    osTitle: 'On a Mac',
    osSteps: [
      'Open System Settings, then Privacy & Security, then Location Services.',
      'Turn it on for your browser.',
    ],
  },
  'desktop-safari': {
    headline: 'Allow location for this site',
    steps: [
      'Open Safari, then Settings, then Websites, then Location.',
      'Set this site to Allow, then reload the page.',
    ],
    osTitle: 'Still not working?',
    osSteps: [
      'Open System Settings, then Privacy & Security, then Location Services.',
      'Turn it on for Safari.',
    ],
  },
  unknown: {
    headline: 'Allow location for this site',
    steps: [
      'Open your browser’s site settings — usually the lock or info icon in the address bar.',
      'Set Location to Allow.',
      'Reload this page and tap Try again.',
    ],
    osTitle: 'Still not working?',
    osSteps: [
      'Check that location is switched on in your phone’s own settings too, and that your browser is allowed to use it.',
    ],
  },
};

/** The last line of every block: there is always a person to fall back on. */
export const DESK_FALLBACK =
  'Still stuck? Ask the organiser to check you in at the desk.';

export function recoverySteps(
  platform: Platform,
  reason: HelpReason,
): HelpBlock {
  switch (reason) {
    case 'DENIED':
    case 'UNSUPPORTED':
      return DENIED_STEPS[platform] ?? DENIED_STEPS.unknown;

    // Nothing in settings fixes standing in the wrong place, and offering
    // permission steps here would send someone hunting for a problem they do
    // not have.
    case 'OUTSIDE':
      return {
        headline: 'You appear to be outside the check-in area',
        steps: [
          'Move closer to the meeting room and tap Try again.',
          'If you are already inside the building, turn on precise location and try once more.',
        ],
      };

    case 'ACCURACY':
      return {
        headline: 'Your phone could not pin down where you are',
        steps: [
          'Turn on precise location for this browser.',
          'Move near a window, or step outside for a moment.',
          'Turn off any VPN, then tap Try again.',
        ],
      };

    case 'TIMEOUT':
    case 'UNAVAILABLE':
      return {
        headline: 'Your phone could not find your location',
        steps: [
          'Check that location is switched on in your phone’s settings.',
          'Move near a window, or step outside for a moment.',
          'Tap Try again — it can take a few seconds.',
        ],
      };

    case 'INSECURE':
      return {
        headline: 'This page is not on a secure connection',
        steps: [
          'Browsers only share location over https.',
          'Open the link again from the QR code rather than from a copied address.',
        ],
        note: 'If you reached this page through a plain http address, tell the organiser — the link is wrong, not your phone.',
      };
  }
}

/**
 * Advice for a page running inside another app.
 *
 * Deliberately not offered for WhatsApp on Android: it opens links in a Chrome
 * Custom Tab, which inherits Chrome's permissions and works fine. Telling those
 * users they are "in an app" would send them chasing a problem they do not
 * have. Facebook and Instagram are the real offenders, on both platforms.
 */
export function inAppAdvice(
  inApp: InAppBrowser,
  platform: Platform,
): HelpBlock | null {
  if (!inApp) return null;
  const isIos = platform === 'ios-safari' || platform === 'ios-other';
  if (inApp === 'whatsapp' && !isIos) return null;

  return {
    headline: 'This link opened inside an app',
    steps: isIos
      ? [
          'Tap the compass or the three dots at the bottom right.',
          'Choose Open in Safari.',
          'Or copy the link below and paste it into Safari or Chrome.',
        ]
      : [
          'Tap the three dots at the top right.',
          'Choose Open in Chrome, or Open in browser.',
          'Or copy the link below and paste it into Chrome.',
        ],
    note: 'Apps like Facebook and Instagram open links in their own browser, which often cannot share your location however your phone is set.',
  };
}
