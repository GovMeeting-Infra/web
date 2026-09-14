'use client';

import {
  forwardRef,
  useEffect,
  useId,
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
    /**
     * Typing only, with no drawing surface and no way back to one.
     *
     * For the desk, where the person holding the device is an organizer
     * recording somebody else. A drawn mark there is the organizer's
     * handwriting standing in for the attendee's, which is worth less than a
     * typed name and looks like more — and a canvas is a slow thing to put in
     * front of a queue. Self-service check-in keeps both, because there the
     * person signing is the person attending.
     */
    typedOnly?: boolean;
    /** Overrides "Type your full name…", which is wrong when signing for someone else. */
    typedLabel?: string;
  }
>(function SignaturePad(
  { onChange, disabled = false, typedOnly = false, typedLabel },
  ref,
) {
  const pad = useRef<SignatureCanvas | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [width, setWidth] = useState(MAX_WIDTH);
  const [mode, setMode] = useState<'draw' | 'type'>(
    typedOnly ? 'type' : 'draw',
  );
  // Unique per instance: the id was hardcoded, so two pads on one page — the
  // desk form and the correction dialog sit on the same screen — gave two
  // inputs the same id and pointed both labels at whichever rendered first.
  const typedId = useId();
  const [typed, setTyped] = useState('');

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
    setTyped('');
    update(false);
  };

  /**
   * Renders a typed name as the signature image.
   *
   * Drawing was the only way to sign, and a canvas cannot be driven from a
   * keyboard — so anyone who cannot use a pointer could not check in at all,
   * on the one action this product exists to perform. A typed signature is the
   * standard accessible equivalent and still produces the image the record
   * expects.
   *
   * Deliberately set in italic serif so it never passes for a drawn mark: an
   * auditor looking at the attendance sheet can see which is which.
   */
  const renderTyped = (value: string): string | null => {
    const text = value.trim();
    if (!text) return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black';
    ctx.font = `italic 34px Georgia, 'Times New Roman', serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 24);
    return canvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    // isEmpty() must be checked first: getTrimmedCanvas() on an untouched
    // canvas still returns a perfectly truthy data URL, so a caller that only
    // tests the string would accept blank signatures.
    getSignature: () => {
      if (mode === 'type') return renderTyped(typed);
      return !pad.current || pad.current.isEmpty()
        ? null
        : pad.current.getTrimmedCanvas().toDataURL('image/png');
    },
    clear,
  }));

  return (
    <div ref={box}>
      {mode === 'draw' ? (
        // The measured element is the full-width box; the canvas is sized from
        // it, so the pad fits the card instead of hanging out past its edge.
        <div className="w-full max-w-[400px] overflow-hidden rounded-xl border border-border bg-white">
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
              'aria-label': 'Signature pad. Draw your signature with a finger or mouse.',
              role: 'img',
            }}
          />
        </div>
      ) : (
        <div className="w-full max-w-[400px]">
          <label
            htmlFor={typedId}
            className="block text-xs font-medium text-muted-foreground"
          >
            {typedLabel ?? 'Type your full name as your signature'}
          </label>
          <input
            id={typedId}
            type="text"
            value={typed}
            disabled={disabled}
            autoComplete="name"
            onChange={(e) => {
              setTyped(e.target.value);
              update(e.target.value.trim().length > 1);
            }}
            className="mt-1.5 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-lg italic text-foreground"
            placeholder="Aminata Kamara"
          />
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-1">
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
        {/* The keyboard route through the one mandatory control in the check-in
            flow. Without it a canvas was the only way to sign, and nobody who
            cannot use a pointer could check in at all.
            
            Absent when there is no drawing surface to go back to — offering
            "Draw it instead" where drawing is deliberately not on offer would
            be a control that contradicts itself. */}
        {!typedOnly && (
          <button
            type="button"
            onClick={() => {
              clear();
              setMode(mode === 'draw' ? 'type' : 'draw');
            }}
            disabled={disabled}
            className="px-3 py-2.5 text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
          >
            {mode === 'draw' ? 'Type it instead' : 'Draw it instead'}
          </button>
        )}
        {hasSignature && (
          <span
            role="status"
            className="text-xs font-medium text-stat-green-muted"
          >
            Signature captured
          </span>
        )}
      </div>
    </div>
  );
});
