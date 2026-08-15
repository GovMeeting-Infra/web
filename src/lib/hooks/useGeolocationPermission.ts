'use client';

import { useEffect, useState } from 'react';

export type GeoPermission =
  | 'unsupported'
  | 'unknown'
  | 'granted'
  | 'prompt'
  | 'denied';

/**
 * What the browser will do if we ask for location, before we ask.
 *
 * Worth knowing because the alternative is finding out after someone has typed
 * their name and drawn a signature, and because a permission that changes while
 * the page is open is the one signal that someone has just fixed their settings
 * and can be let straight through.
 *
 * **'unknown' is the common answer, and it means exactly that.** WebKit ships
 * navigator.permissions but does not accept 'geolocation' as a queryable name,
 * so every browser on an iPhone — Safari, and Chrome, Edge and Firefox, which
 * are all WebKit underneath — lands here. Treat it as "cannot know", never as
 * "probably fine": the pre-flight simply does not exist on iOS, and the page
 * has to keep working without it.
 */
export function useGeolocationPermission(): GeoPermission {
  const [state, setState] = useState<GeoPermission>('unknown');

  // Set in an effect, never during render: these forms are server-rendered, and
  // a first paint that depends on a browser-only answer is a hydration mismatch.
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const onChange = () => {
      if (status && !cancelled) setState(status.state as GeoPermission);
    };

    // All of it inside an async step, so nothing sets state synchronously
    // during the effect and triggers a second render before paint.
    const detect = async () => {
      if (typeof navigator === 'undefined') return;
      if (!navigator.geolocation) {
        if (!cancelled) setState('unsupported');
        return;
      }
      if (!navigator.permissions?.query) return;

      // Both a try/catch and an await in a try: some WebKit builds throw
      // synchronously on an unsupported permission name, others reject.
      try {
        const result = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        if (cancelled) return;
        status = result;
        setState(result.state as GeoPermission);
        if (result.addEventListener) {
          result.addEventListener('change', onChange);
        } else {
          // Older Chromium has only the property.
          result.onchange = onChange;
        }
      } catch {
        // Leave it at 'unknown'.
      }
    };

    void detect();

    return () => {
      cancelled = true;
      if (!status) return;
      if (status.removeEventListener) {
        status.removeEventListener('change', onChange);
      } else {
        status.onchange = null;
      }
    };
  }, []);

  return state;
}
