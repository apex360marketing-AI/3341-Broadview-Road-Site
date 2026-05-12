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
 * Skipped photos (documented for future operators who want to re-include):
 *   - photo_04_front_entry             — redundant with photo-01 (exterior)
 *   - photo_08_lr_to_dining            — transitional shot, weaker than 06+09
 *   - photo_10_lr_to_front_entry       — transitional
 *   - photo_11_lr_dining_to_kitchen    — transitional
 *   - photo_13_kitchen                 — extra angle (kept 12 + 14)
 *   - photo_15_kitchen                 — extra angle
 *   - photo_16_kitchen_to_lr_dining    — transitional
 *   - photo_18_main_floor_primary_2    — extra angle (kept 17)
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
  'photo_20_main_floor_bed_2.jpg'
];

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function processOne(srcName, idx) {
  const src = join(SEED, srcName);
  if (!(await exists(src))) {
    throw new Error(`Missing seed photo: ${srcName}`);
  }
  const num = String(idx + 1).padStart(2, '0');
  const dest = join(OUT, `photo-${num}.jpg`);
  const buf = await readFile(src);
  // sharp strips metadata (EXIF, IPTC, XMP) by default unless .withMetadata() is called.
  const out = await sharp(buf)
    .rotate() // honor + then strip EXIF orientation
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
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
