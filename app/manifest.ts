import type { MetadataRoute } from 'next';

/**
 * Makes the workspace installable, which is the point rather than a flourish.
 *
 * An installed app keeps its own storage under a stronger eviction policy than
 * a tab, launches without the address bar in the way on a tablet used as a
 * check-in desk, and — the reason that matters here — is what lets the service
 * worker serve a shell when the uplink is down.
 *
 * A Metadata route rather than a static public/manifest.json so the values are
 * type-checked and stay next to the layout that references them.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GovMeeting — Government of Sierra Leone',
    short_name: 'GovMeeting',
    description:
      'Schedule government meetings, record minutes and action items, and take attendance.',
    // Where an installed launch lands. Someone opening this from a home screen
    // is a member of staff going to work, not a citizen reading the calendar.
    // Signed out, this redirects to sign-in on its own.
    start_url: '/administrative/dashboard',
    scope: '/',
    display: 'standalone',
    // The crest sits on this, so it is the background rather than the brand
    // blue: anything else shows as a border around the icon on the splash.
    background_color: '#F7F7F7',
    theme_color: '#003580',
    // Deliberately unset. This is used on a clerk's laptop, an officer's phone
    // and a tablet propped at a door, and locking any of those to one
    // orientation would be wrong for the other two.
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Drawn smaller inside the same canvas so Android can crop it to
        // whatever shape the launcher uses without cutting into the crest.
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
