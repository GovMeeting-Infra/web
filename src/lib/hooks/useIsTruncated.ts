'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Whether an element's text is actually being cut off.
 *
 * There are more than forty `truncate` and `line-clamp` sites in the app, and
 * at most widths most of them are not clipping anything. Attaching a tooltip to
 * all of them would mean a popup repeating text already fully on screen, which
 * is precisely the noise that teaches people to ignore tooltips.
 *
 * Measured rather than guessed, and re-measured on resize, because whether a
 * name is clipped depends on the window.
 *
 * Usage:
 *
 *   const { ref, isTruncated } = useIsTruncated<HTMLParagraphElement>();
 *   <Tooltip content={name} disabled={!isTruncated}>
 *     <p ref={ref} className="truncate">{name}</p>
 *   </Tooltip>
 */
export function useIsTruncated<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // scrollWidth covers `truncate` (one line, ellipsis); scrollHeight covers
    // line-clamp, where the overflow is vertical.
    setIsTruncated(
      el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1,
    );
  }, []);

  useEffect(() => {
    measure();

    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    // The element's own box changes with the window, and so does its content
    // when a name is replaced by a longer one.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  return { ref, isTruncated, remeasure: measure };
}
