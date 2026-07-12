#!/usr/bin/env node
/**
 * generate-white-variants.js
 *
 * For every icon folder inside `extra/`, reads the best available SVG source
 * (prefers: color.svg → default.svg → mono.svg → first *.svg found)
 * and writes a `white.svg` where every colour is replaced with #ffffff.
 *
 * Strategy:
 *  - Replace inline fill/stroke attributes that carry a colour with #ffffff
 *  - Replace hardcoded hex colours, rgb(), hsl() values in inline styles
 *  - Replace fill="currentColor" → fill="#ffffff"
 *  - Keep structural attributes (fill="none", stroke="none") intact
 *  - Strip <style> blocks and inject a single global override
 */

const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const EXTRA_DIR = path.join(__dirname, '..', 'icons');
const OUTPUT_FILE = 'white.svg';
const WHITE = '#ffffff';

// Prefer these source variants in order
const SOURCE_PRIORITY = ['default.svg'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBlack(svgContent) {
  let s = svgContent;

  // 1. Strip <style>…</style> blocks entirely
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // 2. Replace fill / stroke / stop-color / flood-color attribute values
  //    Keep: fill="none" | fill="inherit" | fill="transparent" unchanged
  s = s.replace(
    /\b(fill|stroke|stop-color|flood-color|color)\s*=\s*(["'])([^"']*)\2/gi,
    (match, attr, quote, value) => {
      const v = value.trim().toLowerCase();
      if (v === 'none' || v === 'inherit' || v === 'transparent' || v === '') {
        return match;
      }
      return `${attr}=${quote}${WHITE}${quote}`;
    }
  );

  // 3. Replace currentColor keyword
  s = s.replace(/\bcurrentColor\b/g, WHITE);

  // 4. Replace inline style property values: fill:#xxx, stroke:rgb(...), etc.
  s = s.replace(
    /\b(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"'}\s]+)/gi,
    (match, prop, value) => {
      const v = value.trim().toLowerCase();
      if (v === 'none' || v === 'inherit' || v === 'transparent') return match;
      return `${prop}:${WHITE}`;
    }
  );

  // 5. Inject a minimal style that forces everything white
  s = s.replace(
    /(<svg[^>]*>)/i,
    `$1\n  <style>svg{fill:${WHITE}}</style>`
  );

  return s;
}

function pickSource(files) {
  for (const candidate of SOURCE_PRIORITY) {
    if (files.includes(candidate)) return candidate;
  }
  return files.find(f => f.endsWith('.svg')) || null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

let processed = 0;
let skipped = 0;
let errors = 0;

const iconFolders = fs.readdirSync(EXTRA_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

console.log(`Found ${iconFolders.length} icon folders in "${EXTRA_DIR}"\n`);

for (const folder of iconFolders) {
  if (folder.startsWith('.')) continue;

  const folderPath = path.join(EXTRA_DIR, folder);

  let files;
  try {
    files = fs.readdirSync(folderPath);
  } catch (err) {
    console.error(`  [ERROR] Cannot read "${folder}": ${err.message}`);
    errors++;
    continue;
  }

  const sourceFile = pickSource(files);
  if (!sourceFile) {
    console.warn(`  [SKIP] No SVG source found in "${folder}"`);
    skipped++;
    continue;
  }

  const sourcePath = path.join(folderPath, sourceFile);
  const outputPath = path.join(folderPath, OUTPUT_FILE);

  try {
    const original = fs.readFileSync(sourcePath, 'utf8');
    const blackSvg = toBlack(original);
    fs.writeFileSync(outputPath, blackSvg, 'utf8');
    processed++;

    if (processed % 500 === 0) {
      process.stdout.write(`  ✓ ${processed} icons processed…\n`);
    }
  } catch (err) {
    console.error(`  [ERROR] Failed for "${folder}/${sourceFile}": ${err.message}`);
    errors++;
  }
}

console.log(`
────────────────────────────────
✅  Done!
   Processed : ${processed}
   Skipped   : ${skipped}
   Errors    : ${errors}
   Output    : white.svg written into each icon folder
────────────────────────────────
`);
