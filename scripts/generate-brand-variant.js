#!/usr/bin/env node
/**
 * generate-brand-variant.js
 *
 * For every icon in icons.json, this script reads the best available mono/source SVG,
 * colors it with the brand's primary hex color (or first color from array),
 * writes a `brand.svg` in the corresponding folder,
 * and updates icons.json to include the "brand" variant path.
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const EXTRA_DIR = path.join(BASE, '..', 'icons');
const ICONS_FILE = path.join(BASE, '..', 'database', 'icons.json');
const OUTPUT_FILE = 'brand.svg';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBrandColor(hexVal) {
  if (!hexVal) return null;
  if (Array.isArray(hexVal)) {
    return hexVal.length > 0 ? '#' + hexVal[0].replace(/^#/, '') : null;
  }
  if (typeof hexVal === 'string' && hexVal.trim() !== '') {
    return '#' + hexVal.trim().replace(/^#/, '');
  }
  return null;
}

function toBrandColor(svgContent, brandColor) {
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
      return `${attr}=${quote}${brandColor}${quote}`;
    }
  );

  // 3. Replace currentColor keyword
  s = s.replace(/\bcurrentColor\b/g, brandColor);

  // 4. Replace inline style property values: fill:#xxx, stroke:rgb(...), etc.
  s = s.replace(
    /\b(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"'}\s]+)/gi,
    (match, prop, value) => {
      const v = value.trim().toLowerCase();
      if (v === 'none' || v === 'inherit' || v === 'transparent') return match;
      return `${prop}:${brandColor}`;
    }
  );

  // 5. Inject a style block for elements that might not have explicit fill/stroke attributes
  s = s.replace(
    /(<svg[^>]*>)/i,
    `$1\n  <style>svg{fill:${brandColor}}</style>`
  );

  return s;
}

const SOURCE_PRIORITY = ['default.svg'];

function pickSource(files) {
  for (const candidate of SOURCE_PRIORITY) {
    if (files.includes(candidate)) return candidate;
  }
  return files.find(f => f.endsWith('.svg')) || null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(ICONS_FILE)) {
  console.error(`[ERROR] ${ICONS_FILE} not found.`);
  process.exit(1);
}

const icons = JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8'));

let processed = 0;
let skipped = 0;
let errors = 0;

for (const icon of icons) {
  // Try to find the slug from the variants
  let slug = null;
  if (icon.variants) {
    const firstVariant = Object.values(icon.variants)[0];
    if (firstVariant) {
      slug = firstVariant.split('/')[2]; // "/icons/{slug}/..."
    }
  }

  if (!slug) {
    skipped++;
    continue;
  }

  const folderPath = path.join(EXTRA_DIR, slug);
  if (!fs.existsSync(folderPath)) {
    skipped++;
    continue;
  }

  const brandColor = getBrandColor(icon.hex);
  if (!brandColor) {
    // If no brand color is defined, skip or default to black? Let's skip.
    skipped++;
    continue;
  }

  const hexNorm = typeof icon.hex === 'string' ? icon.hex.trim().toLowerCase() : (Array.isArray(icon.hex) && icon.hex.length > 0 ? icon.hex[0].trim().toLowerCase() : '');
  const isBlackOrWhite = (
    hexNorm === '000' || hexNorm === '000000' ||
    hexNorm === 'fff' || hexNorm === 'ffffff'
  );

  if (isBlackOrWhite) {
    icon.variants = icon.variants || {};
    if (icon.variants.default) {
      icon.variants.brand = icon.variants.default;
    }
    skipped++;
    continue;
  }

  let files;
  try {
    files = fs.readdirSync(folderPath);
  } catch (err) {
    console.error(`  [ERROR] Cannot read "${slug}": ${err.message}`);
    errors++;
    continue;
  }

  const sourceFile = pickSource(files);
  if (!sourceFile) {
    skipped++;
    continue;
  }

  const sourcePath = path.join(folderPath, sourceFile);
  const outputPath = path.join(folderPath, OUTPUT_FILE);

  try {
    const original = fs.readFileSync(sourcePath, 'utf8');
    const brandSvg = toBrandColor(original, brandColor);
    fs.writeFileSync(outputPath, brandSvg, 'utf8');

    // Update variants inicons.json
    icon.variants = icon.variants || {};
    icon.variants.brand = `/icons/${slug}/brand.svg`;
    processed++;

    if (processed % 500 === 0) {
      process.stdout.write(`  ✓ ${processed} brand variants generated…\n`);
    }
  } catch (err) {
    console.error(`  [ERROR] Failed for "${slug}/${sourceFile}": ${err.message}`);
    errors++;
  }
}

// Write the updated icons.json back
fs.writeFileSync(ICONS_FILE, JSON.stringify(icons, null, 2), 'utf8');

console.log(`
────────────────────────────────
✅  Done!
   Processed (brand.svg generated) : ${processed}
   Skipped (no hex/no folder)       : ${skipped}
   Errors                           : ${errors}
   Output                           : brand.svg in each icon folder, updated icons.json
────────────────────────────────
`);
