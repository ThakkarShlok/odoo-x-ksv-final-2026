/**
 * ONE-TIME, MANUAL seed-image fetcher. NOT part of `npm run db:seed` and NEVER called at runtime.
 *
 * WHY THIS EXISTS AND WHY IT IS SEPARATE:
 *   The demo must render a credible catalogue with NO internet at the venue. So image bytes cannot
 *   be fetched at seed time or request time — a wifi drop would blank the whole catalogue mid-review.
 *   This script downloads one relevant real photograph per product ONCE, into the TRACKED directory
 *   server/seed-assets/products/<slug>.<ext>. Those files are committed. `npm run db:seed` then
 *   COPIES them from seed-assets into uploads/ — a pure local file copy, fully offline and
 *   reproducible on a fresh clone. If a product has no asset, the seed falls back to its generated
 *   SVG placeholder (so a failed/missing download never breaks the catalogue).
 *
 * SOURCE: Wikimedia Commons (keyless). Its File namespace indexes real product photography — much of
 *   it product-on-white, the "credible store" look — under permissive Creative-Commons/public-domain
 *   licences that are fine to commit for a demo. We search per product, then take the first candidate
 *   that downloads as a valid, large-enough raster image; anything else falls through to the SVG.
 *   (loremflickr was tried first and rejected: it returns contextual SCENE photos — a tourist holding
 *   a camera, concrete-mixer trucks — not product shots.) To hand-pick an exact photo for a product,
 *   set PIN[slug] to a Commons "File:Name.jpg" title below, or just drop your own <slug>.jpg in place.
 *
 * RUN (from the server/ directory):   node scripts/fetch-seed-images.js
 *   Optional: node scripts/fetch-seed-images.js --force   (re-download files that already exist)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(here, '../seed-assets/products');
const SEARCH_WIDTHS = [640, 720, 800];
const MIN_BYTES = 15 * 1024; // reject Wikimedia error HTML (~2KB) and thumbnails too small to look real
const MIN_WIDTH = 400;
const TARGET_MIN_BYTES = 90 * 1024;
const TARGET_MAX_BYTES = 220 * 1024;
const TARGET_BYTES = 150 * 1024;
const FORCE = process.argv.includes('--force');
// Wikimedia asks for a descriptive UA with contact; requests without one may be throttled/blocked.
const UA = 'ZenithRentalsSeed/1.0 (hackathon demo; contact: thakkarshlok2007@gmail.com)';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// slug (== product key in prisma/seed.js) -> Commons search query, tuned for product-photo relevance.
const QUERIES = {
  // Electronics
  dslr: 'DSLR camera body', projector: 'video projector', laptop: 'laptop computer',
  tablet: 'graphics drawing tablet', monitor: 'computer monitor display',
  // Construction
  drill: 'cordless power drill', mixer: 'cement mixer machine', generator: 'portable generator',
  jackhammer: 'demolition hammer jackhammer', scaffold: 'scaffolding tower', washer: 'pressure washer',
  // Event & Party
  table: 'round banquet table', speaker: 'studio monitor loudspeaker', tent: 'event marquee tent',
  chairs: 'folding chair', uplights: 'LED stage par light', popcorn: 'popcorn maker machine',
  // Photography
  gimbal: 'handheld camera gimbal DJI Ronin', lens: 'camera zoom lens', lightkit: 'photography studio softbox light',
  tripod: 'camera tripod', drone: 'quadcopter drone',
  // Audio & Sound
  audiomixer: 'audio mixing console', microphone: 'wireless microphone', headphones: 'headphones', subwoofer: 'subwoofer loudspeaker',
  // Outdoor & Camping
  kayak: 'kayak boat', campstove: 'camping gas stove', cooler: 'cooler ice box', ebike: 'electric bicycle',
  // Power Tools
  mitersaw: 'miter saw', sander: 'orbital sander tool', welder: 'welding machine welder equipment', ladder: 'aluminium extension ladder',
  // Furniture
  sofa: 'sofa couch furniture', barstool: 'bar stool', podium: 'lectern podium',
};

// Optional exact overrides — a Commons file title ("File:...") to force for a given slug.
const PIN = {
  dslr: 'File:Canon EOS 7D DSLR body front.jpg',
  headphones: 'File:Bose QuietComfort 25 Acoustic Noise Cancelling Headphones with Carry Case.jpg',
  drill: 'File:CORDLESS DRILL.jpg', // clean Bosch drill + batteries on black — verified
  mixer: 'File:Cement mixer2.jpg', // the exact portable red drum mixer — verified
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url) => {
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Api-User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`API HTTP ${res.status}`);
  return res.json();
};

// Return [{ thumburl, mime, width }] candidates for a query, in Commons relevance order.
async function candidatesForQuery(query, width) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=8` +
    `&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${width}&format=json&formatversion=2`;
  const j = await getJson(u);
  return (j.query?.pages ?? [])
    .map((p) => p.imageinfo?.[0])
    .filter((i) => i && EXT[i.mime] && i.thumburl && (i.thumbwidth ?? i.width ?? 0) >= MIN_WIDTH);
}

async function candidatesForPin(title, width) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${width}&format=json&formatversion=2`;
  const j = await getJson(u);
  return (j.query?.pages ?? []).map((p) => p.imageinfo?.[0]).filter((i) => i && EXT[i.mime] && i.thumburl);
}

// Download one candidate; return the buffer if it's a valid, large-enough raster, else null.
async function tryDownload(cand) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(cand.thumburl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      if (res.status === 429 || res.status === 422) { await sleep(700); continue; } // thumb rate-limit
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
      const isPng = buf[0] === 0x89 && buf[1] === 0x50;
      const isWebp = buf.slice(0, 4).toString() === 'RIFF';
      if (buf.length >= MIN_BYTES && (isJpeg || isPng || isWebp)) return buf;
      return null;
    } catch {
      await sleep(500);
    }
  }
  return null;
}

function scoreBufferSize(bytes) {
  if (bytes >= TARGET_MIN_BYTES && bytes <= TARGET_MAX_BYTES) return 0;
  return Math.abs(bytes - TARGET_BYTES);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const slugs = Object.keys(QUERIES);
  let ok = 0, skipped = 0, failed = 0;
  console.log(`[fetch-seed-images] Wikimedia Commons -> ${OUT_DIR} (${slugs.length} products)`);

  for (const slug of slugs) {
    const existing = ['jpg', 'png', 'webp'].map((e) => path.join(OUT_DIR, `${slug}.${e}`)).find((f) => fs.existsSync(f));
    if (!FORCE && existing) { console.log(`  = ${path.basename(existing)} (exists, skip)`); skipped++; continue; }

    try {
      let best = null;
      let saved = false;

      for (const width of SEARCH_WIDTHS) {
        const cands = PIN[slug]
          ? await candidatesForPin(PIN[slug], width)
          : await candidatesForQuery(QUERIES[slug], width);

        for (const cand of cands) {
          const buf = await tryDownload(cand);
          if (!buf) continue;

          const candidate = { cand, buf, score: scoreBufferSize(buf.length) };
          if (!best || candidate.score < best.score) best = candidate;

          if (candidate.score === 0) {
            best = candidate;
            break;
          }
        }

        if (best?.score === 0) break;
      }

      if (best) {
        // remove any stale variant with a different extension
        for (const e of ['jpg', 'png', 'webp']) {
          const f = path.join(OUT_DIR, `${slug}.${e}`);
          if (fs.existsSync(f)) fs.rmSync(f);
        }
        const dest = path.join(OUT_DIR, `${slug}.${EXT[best.cand.mime]}`);
        fs.writeFileSync(dest, best.buf);
        console.log(
          `  + ${path.basename(dest)}  (${(best.buf.length / 1024).toFixed(0)}KB, ${best.cand.thumbwidth || best.cand.width}px)`
        );
        if (best.score !== 0) {
          console.log(`    note: closest size found; target is ~${Math.round(TARGET_MIN_BYTES / 1024)}-${Math.round(TARGET_MAX_BYTES / 1024)}KB.`);
        }
        ok++;
        saved = true;
      }
      if (!saved) { console.warn(`  ! ${slug}: no usable image — seed will fall back to SVG`); failed++; }
    } catch (err) {
      console.warn(`  ! ${slug}: ${err.message} — seed will fall back to SVG`); failed++;
    }
    await sleep(300); // be polite
  }

  console.log(`[fetch-seed-images] done: ${ok} downloaded, ${skipped} skipped, ${failed} failed.`);
  console.log('Next: commit server/seed-assets/products, then run `npm run db:seed`.');
}

main().catch((err) => { console.error('[fetch-seed-images] fatal:', err.message); process.exit(1); });
