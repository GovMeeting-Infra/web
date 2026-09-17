import { BUILD_ID } from '@/lib/pwa/config';

/**
 * The kill switch, and the only lever that does not need a deploy.
 *
 * NEXT_PUBLIC_ENABLE_SW is baked into the bundle at build time, so turning the
 * worker off that way means a full CI run and a redeploy — ten minutes and a
 * green pipeline, at the moment when something is wrong in production and a
 * worker is answering before the network on every staff device.
 *
 * This is read at request time instead. Setting PWA_DISABLE=1 in the instance's
 * .env and reloading pm2 takes every worker down within a minute, with no
 * commit and no build. deploy.yml deliberately never ships .env, so the value
 * survives subsequent deploys rather than being quietly reverted by one.
 *
 * Both the page and the worker read this: the page on load, the worker when it
 * activates.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { disabled: process.env.PWA_DISABLE === '1', buildId: BUILD_ID },
    {
      // no-store rather than no-cache: a kill switch that can be answered from
      // any cache, at any layer, is not a kill switch.
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    },
  );
}
