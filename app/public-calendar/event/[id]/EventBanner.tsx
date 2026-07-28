'use client';

/**
 * The banner, isolated as a client component purely so a broken image URL can
 * hide itself. Everything else on the page stays server-rendered, which is what
 * lets the page carry real per-event metadata.
 */
export function EventBanner({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-56 w-full rounded-2xl border border-[#d3deef] object-cover"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  );
}
