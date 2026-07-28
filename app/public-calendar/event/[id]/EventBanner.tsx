'use client';

/**
 * The banner, isolated as a client component purely so a broken image URL can
 * hide itself. Everything else on the page stays server-rendered, which is what
 * lets the page carry real per-event metadata.
 */
export function EventBanner({ src }: { src: string }) {
  return (
    // Was h-56 w-full object-cover: a fixed 224px height across the full width
    // is a 5.7:1 slot, so any ordinary photo had most of its top and bottom
    // cropped away. Only max-* is set now, leaving both dimensions auto so the
    // browser keeps the real aspect ratio — the whole image shows, and a very
    // tall one still cannot run away with the page.
    <div className="flex justify-center overflow-hidden rounded-2xl border border-[#d3deef] bg-[#f8fbff]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className="max-h-[30rem] max-w-full"
        onError={(e) => {
          const img = e.currentTarget as HTMLImageElement;
          // Hide the frame too, not just the image, or a broken URL leaves an
          // empty bordered box behind.
          (img.parentElement as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
}
