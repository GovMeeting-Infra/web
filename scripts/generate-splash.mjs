/**
 * Writes the iOS launch images into public/splash/.
 *
 *   node scripts/generate-splash.mjs
 *
 * iOS shows one of these from the moment the Home Screen icon is tapped until
 * the page first paints, and ignores the manifest while it does — without them
 * it shows plain white. Each is the crest badge alone, drawn exactly where
 * src/components/pwa/LaunchScreen.tsx draws it on that screen, so when the page
 * takes over the badge stays still and the text and progress bar appear under
 * it. Re-run after changing either; the geometry below mirrors that component.
 *
 * Also writes public/splash/crest.webp: the crest at 3x the size those screens
 * draw it. The source JPEG is 1600px and 464 KB, for something shown 96px wide
 * on the one screen that has to paint before anything else.
 *
 * Sizes come from src/lib/pwa/splash-devices.json, which app/layout.tsx also
 * reads for the matching media queries. iOS picks an image only on an exact
 * match of width, height and pixel ratio, so a missing device gets white.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const devices = JSON.parse(
  fs.readFileSync(path.join(root, 'src/lib/pwa/splash-devices.json'), 'utf8'),
);
const crest = path.join(root, 'public/coat_of_arms.jpeg');
const outDir = path.join(root, 'public/splash');

// Mirrors LaunchScreen, in CSS pixels.
const BACKGROUND = '#fbfdff'; // --color-background
const BADGE = 144; // h-36
const BADGE_FILL = '#f7f7f7'; // the crest JPEG's own ground
const RING = '#e3ebf5';
const CREST_W = 96;
const CREST_H = 93;
// The whole column LaunchScreen centres: badge, mt-7, 15px eyebrow line, mt-1.5,
// 28px title line, mt-8, 4px bar.
const GROUP = BADGE + 28 + 15 + 6 + 28 + 32 + 4;

fs.mkdirSync(outDir, { recursive: true });

// Flattened onto the badge grey rather than given transparency: it only ever
// sits on that badge, and the JPEG has no alpha to begin with.
await sharp(crest)
  .resize(CREST_W * 3, CREST_H * 3, { fit: 'contain', background: BADGE_FILL })
  .webp({ quality: 82 })
  .toFile(path.join(outDir, 'crest.webp'));
console.log('public/splash/crest.webp');

for (const d of devices) {
  const s = d.dpr;
  const W = d.w * s;
  const H = d.h * s;
  const cx = W / 2;
  const top = ((d.h - GROUP) / 2) * s;
  const cy = top + (BADGE / 2) * s;
  const r = (BADGE / 2) * s;

  // shadow-[0_18px_50px_rgba(0,53,128,0.10)] — CSS blur radius is twice the
  // Gaussian standard deviation.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><filter id="s" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="${25 * s}"/>
    </filter></defs>
    <rect width="100%" height="100%" fill="${BACKGROUND}"/>
    <circle cx="${cx}" cy="${cy + 18 * s}" r="${r}" fill="#003580" fill-opacity="0.10" filter="url(#s)"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${BADGE_FILL}" stroke="${RING}" stroke-width="${s}"/>
  </svg>`;

  const crestPng = await sharp(crest)
    .resize(Math.round(CREST_W * s), Math.round(CREST_H * s), { fit: 'contain', background: BADGE_FILL })
    .png()
    .toBuffer();

  const file = path.join(outDir, `${W}x${H}.png`);
  await sharp(Buffer.from(svg))
    .composite([
      {
        input: crestPng,
        left: Math.round(cx - (CREST_W * s) / 2),
        top: Math.round(cy - (CREST_H * s) / 2),
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(path.relative(root, file), `— ${d.for}`);
}
