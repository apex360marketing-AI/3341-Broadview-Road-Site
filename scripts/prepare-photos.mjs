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
const SEED = join(ROOT, 'seed', 'valora_v2');
const OUT = join(ROOT, 'public', 'listing');

const CURATED = [
  // 01–12: visible on the main page grid.
  'photo_01_pool_deck_hero.jpg',
  'photo_02_front_exterior.jpg',
  'photo_03_drone_wide_okanagan.jpg',
  'photo_04_great_room_vaulted.jpg',
  'photo_05_great_room_brick_fireplace.jpg',
  'photo_06_kitchen_island.jpg',
  'photo_07_primary_br_pool_access.jpg',
  'photo_08_primary_bath_teal.jpg',
  'photo_09_covered_deck_bbq.jpg',
  'photo_10_pool_ground_level.jpg',
  'photo_11_upstairs_bath_teal.jpg',
  'photo_12_upstairs_primary_br.jpg',
  // 13–20: main-page lightbox, available via arrow keys.
  'photo_13_pool_loungers.jpg',
  'photo_14_living_loft_wide.jpg',
  'photo_15_dining_vaulted.jpg',
  'photo_16_kitchen_wide_deck_doors.jpg',
  'photo_17_covered_deck_bench.jpg',
  'photo_18_aerial_top_down.jpg',
  'photo_19_guest_br_gray.jpg',
  'photo_20_kids_bunk_room.jpg',
  // 21–40: gallery page only (grouped by room/area).
  'photo_21_pool_sectional.jpg',
  'photo_22_pool_hot_tub.jpg',
  'photo_23_pool_diving_shed.jpg',
  'photo_24_sunpad_garden_bench.jpg',
  'photo_25_trampoline_swing.jpg',
  'photo_26_aerial_top_down_pool.jpg',
  'photo_27_aerial_vineyard_lake.jpg',
  'photo_28_aerial_back_of_house.jpg',
  'photo_29_living_sectional.jpg',
  'photo_30_living_brick_close.jpg',
  'photo_31_loft_topdown_view.jpg',
  'photo_32_kitchen_sink.jpg',
  'photo_33_kitchen_into_living.jpg',
  'photo_34_deck_bbq_dining.jpg',
  'photo_35_deck_dining_angle.jpg',
  'photo_36_bedroom_barn_door.jpg',
  'photo_37_kids_pink_room.jpg',
  'photo_38_main_floor_ensuite.jpg',
  'photo_39_walkin_shower.jpg',
  'photo_40_front_door_close.jpg'
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
  // patchRealtorBadge skipped for valora_v2 — fresh professional shots
  // without a realtor.ca watermark; patching would damage the top-left.
  const patched = trimmed;
  const out = await sharp(patched)
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
