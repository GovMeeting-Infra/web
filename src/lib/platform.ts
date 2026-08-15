/**
 * Which phone and browser someone is holding.
 *
 * Only ever used to choose which settings instructions to show. User agent
 * strings are unreliable and change every year, so nothing here decides whether
 * a person may do something — getting it wrong shows the wrong tap-path, not
 * the wrong outcome.
 */

export type Platform =
  | 'ios-safari'
  | 'ios-other'
  | 'android-chrome'
  | 'samsung-internet'
  | 'android-other'
  | 'desktop-chromium'
  | 'desktop-safari'
  | 'unknown';

export type InAppBrowser = 'whatsapp' | 'facebook' | 'instagram' | 'other' | null;

export function detectPlatform(
  userAgent: string,
  nav?: { platform?: string; maxTouchPoints?: number },
): Platform {
  const ua = userAgent || '';

  // An iPad in desktop mode reports itself as a Mac, and the touch points are
  // the only thing that gives it away.
  const isIpadInDesktopMode =
    nav?.platform === 'MacIntel' && (nav?.maxTouchPoints ?? 0) > 1;

  if (/iPad|iPhone|iPod/.test(ua) || isIpadInDesktopMode) {
    // Every browser on iOS is WebKit underneath, but each carries its own
    // location permission — which is the single most confusing thing about
    // this on an iPhone.
    return /CriOS|EdgiOS|FxiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari';
  }

  if (/Android/.test(ua)) {
    if (/SamsungBrowser/.test(ua)) return 'samsung-internet';
    if (/Chrome\//.test(ua) && !/EdgA|OPR/.test(ua)) return 'android-chrome';
    return 'android-other';
  }

  if (/Chrome\/|Chromium|Edg\//.test(ua)) return 'desktop-chromium';
  if (/Safari\//.test(ua)) return 'desktop-safari';
  return 'unknown';
}

/**
 * Whether the page is running inside another app's browser.
 *
 * These matter because a webview can refuse location regardless of what the
 * phone's own settings say, and no amount of tapping through Settings fixes
 * it — the answer is to leave.
 */
export function detectInAppBrowser(userAgent: string): InAppBrowser {
  const ua = userAgent || '';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'facebook';
  if (/Instagram/.test(ua)) return 'instagram';
  if (/WhatsApp/.test(ua)) return 'whatsapp';
  // Android's generic webview marker. Chrome Custom Tabs do not carry it,
  // which is the distinction that matters: those behave like Chrome.
  if (/;\s*wv\)/.test(ua)) return 'other';
  return null;
}
