import type { MetadataRoute } from 'next';

/**
 * The web app manifest, served at /manifest.webmanifest.
 *
 * Next injects <link rel="manifest"> into every page because this file exists,
 * so nothing in app/layout.tsx needs to reference it.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // ========================================================================
    // IDENTITY — DO NOT CHANGE `id`, EVER.
    // ========================================================================
    // `id` is what a browser uses to decide whether this manifest describes an
    // app it has already installed. Leave it out and the browser falls back to
    // using start_url as the identity — which means the day anyone edits
    // start_url, every installation on every ministry phone is orphaned: the
    // home-screen icon goes on launching the old URL, stops receiving manifest
    // updates, and installing again produces a second icon for what is visibly
    // the same app. There is no migration path; each person has to delete and
    // reinstall.
    //
    // Setting it explicitly decouples identity from routing, so start_url stays
    // freely changeable forever. Changing `id` later does exactly the same
    // damage as changing start_url without one, so treat this string as
    // immutable.
    id: '/?app=smart-meeting',

    name: 'Smart Meeting & Attendance Logger',
    // Android truncates home-screen labels at roughly 12 characters and this is
    // 13, so it may render as "Smart Meetin…". Kept because it matches the
    // sidebar wordmark; worth checking on a real device before changing.
    short_name: 'Smart Meeting',
    description:
      'Official government meeting management, attendance tracking, and documentation system for the Government of Sierra Leone.',

    // ========================================================================
    // LAUNCH AND BOUNDARY
    // ========================================================================
    // The install audience is ministry staff, so a launch belongs in the
    // workspace, not on the public calendar. This is auth-gated, and a cold
    // launch with no session redirecting to sign-in is correct behaviour rather
    // than a bug. The query param costs nothing and makes "how many launches
    // come from an installed copy" answerable later.
    start_url: '/administrative/dashboard?source=pwa',

    // Deliberately the whole origin, even though the installed app is a staff
    // tool. Manifest scope decides which links stay *inside the app window*;
    // narrowing it to /administrative/ would throw someone out to the system
    // browser the moment they opened a check-in QR link or the public-calendar
    // link in app/not-found.tsx — and on iOS that browser has a different
    // cookie jar, so they would land signed out.
    //
    // What keeps this a staff tool is the *service worker's* scope, which is a
    // separate lever: it registers against /administrative/ only, so the public,
    // check-in and RSVP pages are beyond its reach by construction rather than
    // by an exclusion list somebody has to maintain.
    scope: '/',

    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],

    // ========================================================================
    // APPEARANCE
    // ========================================================================
    theme_color: '#003580',
    // Painted as the splash background before first paint, so it has to match
    // what the app actually paints: --color-background in app/globals.css.
    // Anything else flashes one colour then another on every cold launch.
    background_color: '#fbfdff',

    lang: 'en',
    dir: 'ltr',
    categories: ['productivity', 'business'],

    // orientation is deliberately unset. This runs on a clerk's laptop, an
    // officer's phone and a tablet propped at a door, and the action-items board
    // and reports charts are better in landscape. Pinning one would be a
    // regression on at least two of those.

    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Separate files, not `purpose: 'any maskable'` on the ones above.
      // Android crops an adaptive icon to a shape whose safe zone is only the
      // inner 80%, and OEM masks differ, so an icon drawn to fill the canvas
      // gets its edges shaved on some handsets and not others. These two inset
      // the crest to 60% so it survives every mask.
      { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],

    shortcuts: [
      { name: 'Calendar', url: '/administrative/calendar' },
      { name: 'Minutes', url: '/administrative/minutes' },
      { name: 'Action items', url: '/administrative/action-items' },
    ],
  };
}
