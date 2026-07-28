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
}: {
  children: React.ReactNode;
  /**
   * Rendered edge to edge between the header and the content column. A slot
   * rather than something the page fakes with negative margins, since the only
   * way out of `main`'s max-width is not to be inside it.
   */
  hero?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-slate-900">
      <header className="border-b border-[#d3deef] bg-[#f8fbff]/95 shadow-[0_8px_30px_rgba(0,53,128,0.07)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-4">
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
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-[#007236]">
                Government of Sierra Leone
              </span>
              <span className="mt-1 block text-xl font-bold tracking-tight text-[#003580] sm:text-2xl">
                Public Events Calendar
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-3 rounded-full border border-[#d3deef] bg-[#edf4fd] px-3 py-2 shadow-sm sm:flex">
              <SierraLeoneFlag className="h-8 w-14" />
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Sierra Leone
              </span>
            </div>
            <Link
              href="/login"
              className="rounded-xl border border-[#d3deef] bg-white px-4 py-2 text-sm font-medium text-[#003580] transition-colors hover:bg-[#edf4fd]"
            >
              Staff sign in
            </Link>
          </div>
        </div>
      </header>

      {hero}

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="border-t border-[#d3deef] bg-[#f8fbff] py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
          Government of Sierra Leone · Public activities are listed once published
          by the organising ministry.
        </div>
      </footer>
    </div>
  );
}
