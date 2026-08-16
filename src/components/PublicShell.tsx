import Image from 'next/image';
import Link from 'next/link';
import { SierraLeoneFlag } from './SierraLeoneFlag';

/**
 * Chrome for the unauthenticated public calendar. Separate from the
 * administrative layout: no sidebar, no session, and it must render for
 * visitors who never sign in.
 */
export function PublicShell({
  children,
  hero,
  title = 'Public Events Calendar',
  linkHome = true,
  footerNote = 'Public activities are listed once published by the organising ministry.',
}: {
  children: React.ReactNode;
  /**
   * Rendered edge to edge between the header and the content column. A slot
   * rather than something the page fakes with negative margins, since the only
   * way out of `main`'s max-width is not to be inside it.
   */
  hero?: React.ReactNode;
  /**
   * What this surface is. The masthead was hardcoded to "Public Events
   * Calendar", so a guest opening a private, token-gated meeting record was
   * told in the largest text on the page that they were on a public calendar —
   * which also implied their minutes were published to anyone.
   */
  title?: string;
  /**
   * Whether the masthead links to the calendar. False on token-gated surfaces,
   * where the one obvious click was leaving the record the visitor was sent to
   * read, with no way back.
   */
  linkHome?: boolean;
  footerNote?: string;
}) {
  const masthead = (
    <>
      <span className="flex h-12 w-12 items-center justify-center">
        <Image
          src="/coat_of_arms.jpeg"
          alt="Sierra Leone coat of arms"
          width={44}
          height={44}
          className="h-11 w-11 object-contain"
        />
      </span>
      <span>
        <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-success">
          Government of Sierra Leone
        </span>
        <span className="mt-1 block text-xl font-bold tracking-tight text-primary sm:text-2xl">
          {title}
        </span>
      </span>
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background text-slate-900">
      <header className="border-b border-border bg-surface/95 shadow-[0_8px_30px_rgba(0,53,128,0.07)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          {linkHome ? (
            <Link href="/" className="flex items-center gap-4">
              {masthead}
            </Link>
          ) : (
            <div className="flex items-center gap-4">{masthead}</div>
          )}

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-border bg-stat-blue-bg px-3 py-2 shadow-sm sm:flex">
              <SierraLeoneFlag className="h-8 w-14" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Sierra Leone
              </span>
            </div>
            {/* No staff sign-in link. This page is for the public, and the
                link advertised the administrative entrance to everyone who
                visited it. Staff reach it by its own address. */}
          </div>
        </div>
      </header>

      {hero}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-border bg-surface py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          Government of Sierra Leone · {footerNote}
        </div>
      </footer>
    </div>
  );
}
