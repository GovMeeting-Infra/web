'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import SignatureCanvas from 'react-signature-canvas';

/**
 * The canvas is sized in CSS pixels at a 1:1 backing ratio, never scaled by
 * devicePixelRatio: the exported PNG data URL travels in a JSON body, and a
 * high-DPI canvas easily exceeds the server's body limit.
 *
 * It used to be a hard 400px wide inside `max-w-full overflow-hidden`, which
 * on a phone did not scale the pad — it clipped it. Roughly a quarter sat
 * outside the card, and because the drawing surface kept its own coordinate
 * space, the visible area no longer lined up with where the pen landed.
 */
const MAX_WIDTH = 400;
const HEIGHT = 150;

export interface SignaturePadHandle {
  /** Trimmed PNG data URL, or null when nothing has been drawn. */
  getSignature: () => string | null;
  clear: () => void;
}

export const SignaturePad = forwardRef<
  SignaturePadHandle,
  {
    /** Fires with true once the pad holds a stroke, false when cleared. */
    onChange?: (hasSignature: boolean) => void;
    disabled?: boolean;
  }
>(function SignaturePad({ onChange, disabled = false }, ref) {
  const pad = useRef<SignatureCanvas | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [width, setWidth] = useState(MAX_WIDTH);

  // Match the pad to whatever the card actually gives it. Resizing a canvas
  // clears it, so a stroke already drawn is re-applied from its point data
  // rather than being silently lost when the phone rotates.
  useEffect(() => {
    const el = box.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const next = Math.min(MAX_WIDTH, Math.round(entry.contentRect.width));
      if (next > 0) setWidth(next);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const instance = pad.current;
    if (!instance) return;
    const strokes = instance.toData();
    if (strokes.length > 0) instance.fromData(strokes);
  }, [width]);

  const update = (value: boolean) => {
    setHasSignature(value);
    onChange?.(value);
  };

  const clear = () => {
    pad.current?.clear();
    update(false);
  };

  useImperativeHandle(ref, () => ({
    // isEmpty() must be checked first: getTrimmedCanvas() on an untouched
    // canvas still returns a perfectly truthy data URL, so a caller that only
    // tests the string would accept blank signatures.
    getSignature: () =>
      !pad.current || pad.current.isEmpty()
        ? null
        : pad.current.getTrimmedCanvas().toDataURL('image/png'),
    clear,
  }));

  return (
    <div>
      {/* The measured element is the full-width box; the canvas is sized from
          it, so the pad fits the card instead of hanging out past its edge. */}
      <div
        ref={box}
        className="w-full max-w-[400px] overflow-hidden rounded-xl border border-border bg-white"
      >
        <SignatureCanvas
          ref={(instance) => {
            pad.current = instance;
          }}
          penColor="black"
          backgroundColor="white"
          onEnd={() => update(true)}
          canvasProps={{
            width,
            height: HEIGHT,
            // touch-action: none, or the page scrolls instead of drawing.
            className: 'block touch-none',
            'aria-label': 'Signature pad',
          }}
        />
      </div>

      <div className="mt-1 flex items-center gap-1">
        {/* Padded out to a real tap target rather than left as bare text. This
            is the only way back from a bad stroke, and it is reached with the
            same finger that just drew one. The negative margin keeps the label
            optically aligned with the pad's left edge. */}
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasSignature}
          className="-ml-3 px-3 py-2.5 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
        >
          Clear signature
        </button>
        {hasSignature && (
          <span className="text-xs font-medium text-[#007236]">
            ✓ Signature captured
          </span>
        )}
      </div>
    </div>
  );
});
