import type { MetadataRoute } from 'next';

/**
 * The public calendar is meant to be found; nothing else is.
 *
 * The disallowed paths are already either signed-in or token-gated, so this is
 * not what protects them — it keeps them out of search results and stops
 * crawlers burning through one-time invitation and check-in links.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/administrative/',
        '/checkin/',
        '/rsvp/',
        '/set-password',
        '/reset-password',
        '/forgot-password',
        '/login',
      ],
    },
  };
}
