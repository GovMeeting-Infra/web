import type { InAppBrowser, Platform } from '@/lib/platform';

export interface InstallHelp {
  headline: string;
  steps: string[];
  /** Draw iOS's Share glyph beside the first step. */
  shareGlyph?: boolean;
  notes: string[];
}

const SEPARATE_SIGN_IN =
  'The installed app keeps its own sign-in, so you may be asked for your password once more inside it. That is expected.';

/**
 * How to install by hand, per browser — for when there is no prompt to show.
 *
 * Chrome on Android withholds beforeinstallprompt until it judges the site
 * "engaging" enough, and for months after someone dismisses it once; iOS never
 * fires it. The browser's own menu still installs in every one of those cases,
 * so the menu row stays and points there instead of disappearing.
 *
 * Data rather than JSX for the same reason as locationHelp.ts: these menus get
 * relabelled, and the wording should be correctable in one place.
 */
const STEPS: Record<Platform, InstallHelp> = {
  'ios-safari': {
    headline: 'Add it to your Home Screen',
    shareGlyph: true,
    steps: [
      'Tap the Share button',
      'Scroll down and tap "Add to Home Screen"',
      'Tap "Add"',
    ],
    notes: [
      'On an iPhone the Share button is at the bottom of the screen. On an iPad it is at the top right.',
      SEPARATE_SIGN_IN,
    ],
  },
  'ios-other': {
    headline: 'Open this page in Safari first',
    steps: [
      'Copy this page’s address, or tap the share or menu button and choose Open in Safari.',
      'In Safari, tap the Share button.',
      'Tap "Add to Home Screen", then "Add".',
    ],
    notes: [
      'On an iPhone or iPad only Safari can add apps to the Home Screen — Chrome, Edge and Firefox there have no way to do it.',
      SEPARATE_SIGN_IN,
    ],
  },
  'android-chrome': {
    headline: 'Install from Chrome’s menu',
    steps: [
      'Tap the three dots at the top right.',
      'Tap "Install app" (on some phones it says "Add to Home screen").',
      'Tap "Install".',
    ],
    notes: [
      'The app then appears in your app drawer and on your home screen.',
    ],
  },
  'samsung-internet': {
    headline: 'Install from Samsung Internet',
    steps: [
      'Tap the download icon in the address bar if you see one, then Install.',
      'Otherwise tap the menu (three lines) at the bottom right.',
      'Tap "Add page to", then "Home screen".',
    ],
    notes: [],
  },
  'android-other': {
    headline: 'Install from your browser’s menu',
    steps: [
      'Open your browser’s menu (usually three dots).',
      'Tap "Install" or "Add to Home screen".',
      'If neither is there, open this page in Chrome and install from there.',
    ],
    notes: [],
  },
  'desktop-chromium': {
    headline: 'Install from the address bar',
    steps: [
      'Click the install icon at the right end of the address bar (a screen with a down arrow).',
      'Or open the browser menu and choose "Cast, save and share", then "Install page as app" (in Edge: Apps, then "Install this site as an app").',
      'Click "Install".',
    ],
    notes: [],
  },
  'desktop-safari': {
    headline: 'Add it to your Dock',
    steps: [
      'In the menu bar, choose File, then "Add to Dock".',
      'Click "Add".',
    ],
    notes: [
      'This needs macOS Sonoma or later. On older versions, open the site in Chrome or Edge to install it.',
    ],
  },
  unknown: {
    headline: 'Install from your browser',
    steps: [
      'Look in your browser’s menu for "Install" or "Add to Home screen".',
      'If your browser has neither, open this site in Chrome, Edge or (on iPhone) Safari.',
    ],
    notes: ['Firefox on a computer cannot install web apps.'],
  },
};

export function installHelp(platform: Platform, inApp: InAppBrowser): InstallHelp {
  // A webview inside Facebook, Instagram and the like cannot install anything,
  // whatever the phone. Leaving it is the only step that works.
  if (inApp && inApp !== 'whatsapp') {
    const isIos = platform === 'ios-safari' || platform === 'ios-other';
    return {
      headline: 'This page opened inside another app',
      steps: isIos
        ? [
            'Tap the compass or the three dots at the bottom right.',
            'Choose Open in Safari.',
            'Then open the menu under your name and choose Install app again.',
          ]
        : [
            'Tap the three dots at the top right.',
            'Choose Open in Chrome, or Open in browser.',
            'Then open the menu under your name and choose Install app again.',
          ],
      notes: ['Browsers built into other apps cannot install anything.'],
    };
  }
  return STEPS[platform];
}
