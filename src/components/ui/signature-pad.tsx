'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

/**
 * Fixed pixel size rather than responsive: the exported PNG data URL travels in
 * a JSON body, and a high-DPI canvas easily exceeds the server's body limit.
 */
const WIDTH = 400;
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
  const [hasSignature, setHasSignature] = useState(false);

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
      <div className="inline-block max-w-full overflow-hidden rounded-xl border border-border bg-white">
        <SignatureCanvas
          ref={(instance) => {
            pad.current = instance;
          }}
          penColor="black"
          backgroundColor="white"
          onEnd={() => update(true)}
          canvasProps={{
            width: WIDTH,
            height: HEIGHT,
            className: 'touch-none',
            'aria-label': 'Signature pad',
          }}
        />
      </div>

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={clear}
          disabled={disabled || !hasSignature}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50"
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
