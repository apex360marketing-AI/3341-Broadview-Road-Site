/**
 * prepare-photos.mjs
 *
 * Copies the curated 12-photo selection from seed/ into public/listing/ as
 * photo-01.jpg through photo-12.jpg, stripping EXIF metadata in the process
 * (Safety BLOCKER B12 — real-estate photos can leak GPS that defeats the
 * approximate-location map posture).
 *
 * Re-run any time the seed or curation changes:
 *   node scripts/prepare-photos.mjs
 *
 * Curation:
 *   - First 12 photos appear in the on-page asymmetric grid.
 *   - All 20 photos appear in the lightbox (arrow-keys navigate beyond grid).
 *   - Operators who want to trim back to a tighter set: shorten the CURATED
 *     array AND tokens.json GALLERY_PHOTOS / GALLERY_ALT in lockstep.
 */

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SEED = join(ROOT, 'seed', 'listing_3341_broadview');
const OUT = join(ROOT, 'public', 'listing');

const CURATED = [
  // First 12 — visible on the home page grid.
  'photo_01_modern_updated_exterior.jpg',
  'photo_02_private_backyard_oasis.jpg',
  'photo_03_inground_pool.jpg',
  'photo_05_vaulted_ceilings.jpg',
  'photo_07_wood_burning_fireplace.jpg',
  'photo_06_oversized_living_room.jpg',
  'photo_12_kitchen.jpg',
  'photo_14_kitchen.jpg',
  'photo_09_dining_area.jpg',
  'photo_17_main_floor_primary.jpg',
  'photo_19_main_floor_primary_ensuite.jpg',
  'photo_20_main_floor_bed_2.jpg',
  // Next 8 — lightbox-only, available via arrow keys after opening any grid photo.
  'photo_04_front_entry.jpg',
  'photo_08_lr_to_dining.jpg',
  'photo_10_lr_to_front_entry.jpg',
  'photo_11_lr_dining_to_kitchen.jpg',
  'photo_13_kitchen.jpg',
  'photo_15_kitchen.jpg',
  'photo_16_kitchen_to_lr_dining.jpg',
  'photo_18_main_floor_primary_2.jpg'
];

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

/**
 * patchRealtorBadge — every seed photo carries a REALTOR® watermark in the
 * top-left corner (added by realtor.ca). v2 strategy:
 *   1. Sample a tiny clean strip from the upper portion of the photo,
 *      AVOIDING the badge area on the left and any chimneys/trees in the
 *      photo's top-right (which are common artifact sources on exteriors).
 *   2. Compute the average RGB of that clean strip — this is the patch's
 *      "fill color." Average means a uniform colour with no recognizable
 *      content (no chimney/roof/tree silhouette) bleeds into the patch.
 *   3. Composite a soft-feathered solid rectangle of that colour over the
 *      badge area. The feathered alpha mask hides edges naturally.
 */
async function patchRealtorBadge(buf) {
  const meta = await sharp(buf).metadata();
  const w = meta.width;
  const h = meta.height;

  // Sample from top-CENTER (avoids the left badge and the right side which
  // commonly contains chimneys/trees on exterior shots, ceiling fixtures
  // on interior shots).
  const sampleX = Math.round(w * 0.30);
  const sampleY = Math.round(h * 0.02);
  const sampleW = Math.round(w * 0.18);
  const sampleH = Math.round(h * 0.06);

  const stats = await sharp(buf)
    .extract({ left: sampleX, top: sampleY, width: sampleW, height: sampleH })
    .stats();

  const r = Math.max(0, Math.min(255, Math.round(stats.channels[0].mean)));
  const g = Math.max(0, Math.min(255, Math.round(stats.channels[1].mean)));
  const b = Math.max(0, Math.min(255, Math.round(stats.channels[2].mean)));
  const fill = `rgb(${r},${g},${b})`;

  // Patch area sized so the badge sits well inside the 100%-opacity core,
  // not in the feather zone (the bug in v2 was: badge bled through the soft
  // edges). Dimensions: 28% × 38% of photo, with the opacity center shifted
  // to (33%, 35%) — closer to where the badge actually is.
  const patchW = Math.round(w * 0.28);
  const patchH = Math.round(h * 0.38);

  // Solid fill, full opacity to 65% radius, fast fade to 100%.
  const patch = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${patchW}" height="${patchH}">
  <defs>
    <radialGradient id="m" cx="33%" cy="35%" r="80%">
      <stop offset="0%" stop-color="${fill}" stop-opacity="1"/>
      <stop offset="65%" stop-color="${fill}" stop-opacity="1"/>
      <stop offset="100%" stop-color="${fill}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#m)"/>
</svg>`);

  return sharp(buf)
    .composite([{ input: patch, top: 0, left: 0 }])
    .toBuffer();
}

async function processOne(srcName, idx) {
  const src = join(SEED, srcName);
  if (!(await exists(src))) {
    throw new Error(`Missing seed photo: ${srcName}`);
  }
  const num = String(idx + 1).padStart(2, '0');
  const dest = join(OUT, `photo-${num}.jpg`);

  // Pipeline: read → strip EXIF + honor orientation → trim white borders
  //   added by realtor.ca's letterboxing → patch realtor badge → re-encode JPEG.
  // sharp strips metadata (EXIF, IPTC, XMP) by default unless .withMetadata() is called.
  const raw = await readFile(src);
  const oriented = await sharp(raw).rotate().toBuffer();
  // .trim() auto-detects from the top-left corner pixel — if there's a white
  // letterbox border, it's removed. If the corner is photo content, no-op.
  const trimmed = await sharp(oriented).trim({ threshold: 12 }).toBuffer();
  const patched = await patchRealtorBadge(trimmed);
  const out = await sharp(patched)
    // Gentle unsharp mask restores the crispness realtor.ca's re-encoding softens,
    // then encode at high quality with full 4:4:4 chroma (no colour-detail loss).
    .sharpen({ sigma: 1.0 })
    .jpeg({ quality: 90, progressive: true, mozjpeg: true, chromaSubsampling: '4:4:4' })
    .toBuffer();
  await writeFile(dest, out);
  return { srcName, dest: `photo-${num}.jpg`, bytes: out.length };
}

async function main() {
  await ensureDir(OUT);
  console.log(`Preparing ${CURATED.length} photos -> ${OUT}`);
  const results = [];
  for (let i = 0; i < CURATED.length; i++) {
    const r = await processOne(CURATED[i], i);
    results.push(r);
    console.log(`  ${r.dest}  (${(r.bytes / 1024).toFixed(0)} KB)  <-  ${r.srcName}`);
  }
  console.log(`Done. ${results.length} photos written.`);
}

main().catch((err) => {
  console.error('prepare-photos failed:', err);
  process.exit(1);
});
