/**
 * A profile photograph sized for where it is being drawn.
 *
 * Avatars are whatever came off someone's phone. The two on the platform when
 * this was written are 5347x6684 and 2013x1536 — one of them 4.3MB — and the
 * top bar draws them at forty pixels across, on every page, for a service used
 * over Sierra Leonean mobile data. Asking Cloudinary to do the cropping turns
 * that 4.3MB into about 5KB.
 *
 * `c_fill` with `g_face` crops to a square around the face rather than letting
 * a landscape photograph squash into a circle, `q_auto` picks a quality for the
 * format, and `f_auto` serves WebP where the browser takes it.
 *
 * Only Cloudinary delivery URLs can be rewritten. The profile form also accepts
 * a pasted link to anywhere, and those come back untouched — the caller still
 * has to handle an image that never loads.
 */

/** `https://res.cloudinary.com/<cloud>/image/upload/v123456/folder/file.jpg` */
const CLOUDINARY_UPLOAD =
  /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(v\d+\/.+)$/;

/**
 * @param url   the stored photograph, or null
 * @param size  the square to crop to, in pixels — pass roughly twice the CSS
 *              size so it stays sharp on a high-density screen
 */
export function avatarUrl(
  url: string | null | undefined,
  size: number,
): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  // Matching the version segment is what makes this safe to run twice: a URL
  // that already carries a transformation has something else in that position,
  // so it falls through unchanged rather than gaining a second crop.
  const parts = CLOUDINARY_UPLOAD.exec(trimmed);
  if (!parts) return trimmed;

  const [, prefix, rest] = parts;
  return `${prefix}c_fill,g_face,w_${size},h_${size},q_auto,f_auto/${rest}`;
}
