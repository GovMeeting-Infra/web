'use client';

/**
 * The hero's photograph, isolated as a client component purely so a broken
 * image URL can hide itself. Everything else on the page stays server-rendered,
 * which is what lets the page carry real per-event metadata.
 *
 * It sits behind the hero's text rather than above it, so cropping is the point
 * here — object-cover is correct for a background. Hiding on error uncovers the
 * solid brand colour underneath, so an activity with a dead image URL still
 * gets a deliberate-looking hero instead of an empty box.
 */
export function EventBanner({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
