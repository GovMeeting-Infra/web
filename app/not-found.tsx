import Link from 'next/link';
import { PublicShell } from '@/components/PublicShell';

export const metadata = {
  title: 'Page not found',
};

/**
 * There was no not-found boundary at all, so a mistyped address on a .gov.sl
 * domain served Next's stock black-on-white "404 | This page could not be
 * found" — no crest, no government, no route back. On a state domain that
 * reads as a dead or hijacked site.
 */
export default function NotFound() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-xl py-12 text-center">
        <h1 className="text-2xl font-bold text-primary">
          We can&rsquo;t find that page
        </h1>
        <p className="mt-3 text-slate-600">
          The address may be mistyped, or the page may have been moved since the
          link was created.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/"
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 "
          >
            Go to the public calendar
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
