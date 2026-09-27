/**
 * What a full page load of the workspace shows while the session is looked up.
 *
 * The administrative layout cannot render anything until the API has said who
 * is signed in, and that is two round trips across the Atlantic. Without a
 * fallback not a byte of HTML left the server in that time, so the installed
 * app opened onto a white screen. This streams first, instead.
 *
 * Drawn to match public/splash/ (scripts/generate-splash.mjs), which iOS shows
 * before the page exists at all — so the hand-over from one to the other is a
 * progress bar appearing, not a change of screen.
 *
 * A server component with no script of its own: it has to paint before any
 * JavaScript has arrived, and it is gone by the time any would have run.
 */
export function LaunchScreen() {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="flex h-dvh flex-col items-center justify-center bg-background px-6"
    >
      {/* The crest's JPEG has a flat #f7f7f7 ground rather than transparency;
          the badge is that same grey, so the image has no visible edge. 96px
          wide keeps the corners of the motto ribbon inside the circle. */}
      <div className="flex h-36 w-36 items-center justify-center rounded-full bg-[#f7f7f7] shadow-[0_18px_50px_rgba(0,53,128,0.10)] ring-1 ring-[#e3ebf5]">
        {/* eslint-disable-next-line @next/next/no-img-element -- next/image
            would add a client component and a srcset round trip to the one
            thing that has to paint before anything else. */}
        <img
          src="/coat_of_arms.jpeg"
          alt=""
          width={96}
          height={93}
          fetchPriority="high"
          className="h-[93px] w-[96px] object-contain"
        />
      </div>

      <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.18em] text-success">
        Government of Sierra Leone
      </p>
      <p className="mt-1.5 text-lg font-bold text-primary">Smart Meeting</p>

      <div className="mt-8 h-1 w-28 overflow-hidden rounded-full bg-[#e3ebf5]">
        <div className="h-full w-1/3 animate-launch-progress rounded-full bg-primary" />
      </div>
    </div>
  );
}
