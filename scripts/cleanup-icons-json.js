#!/usr/bin/env node
/**
 * cleanup-icons-json.js
 *
 * Rewrites icons.json keeping only:
 *   name, hex, categories, variants (+ black/white added), url, collection
 *
 * Also removes entries whose extra/ folder was deleted.
 */

const fs   = require('fs');
const path = require('path');

const ICONS_JSON = path.join(__dirname, '..', 'database', 'icons.json');
const EXTRA_DIR  = path.join(__dirname, '..', 'icons');
const OUTPUT     = path.join(__dirname, '..', 'database', 'icons.json'); // overwrite in-place

// Build a Set of slugs that still have a folder in extra/
const existingFolders = new Set(
  fs.readdirSync(EXTRA_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.'))
    .map(d => d.name)
);

console.log(`Folders in extra/: ${existingFolders.size}`);

// Load original icons.json
const icons = JSON.parse(fs.readFileSync(ICONS_JSON, 'utf8'));
console.log(`Entries in icons.json: ${icons.length}`);

const result = [];

for (const icon of icons) {
  let slug = icon.slug;
  if (!slug && icon.variants) {
    const firstVariant = Object.values(icon.variants)[0];
    if (firstVariant) {
      slug = firstVariant.split('/')[2];
    }
  }

  // Skip if folder was deleted
  if (!slug || !existingFolders.has(slug)) continue;

  // Check which SVG files actually exist in the folder
  const folderPath = path.join(EXTRA_DIR, slug);
  let files;
  try {
    files = new Set(fs.readdirSync(folderPath));
  } catch {
    continue;
  }

  const hexNorm = icon.hex ? (Array.isArray(icon.hex) ? (icon.hex.length > 0 ? icon.hex[0] : '') : icon.hex).trim().toLowerCase() : '';
  const isBlackOrWhite = (
    hexNorm === '000' || hexNorm === '000000' ||
    hexNorm === 'fff' || hexNorm === 'ffffff'
  );

  // Build updated variants object
  const variants = {};

  // Default
  if (files.has('default.svg')) {
    variants['default'] = `/icons/${slug}/default.svg`;
  }

  // Brand
  if (isBlackOrWhite) {
    if (variants['default']) {
      variants['brand'] = variants['default'];
    }
  } else if (files.has('brand.svg')) {
    variants['brand'] = `/icons/${slug}/brand.svg`;
  }

  // Black / White
  if (files.has('black.svg')) variants['black'] = `/icons/${slug}/black.svg`;
  if (files.has('white.svg')) variants['white'] = `/icons/${slug}/white.svg`;

  // Text variants
  if (files.has('text.svg')) variants['text'] = `/icons/${slug}/text.svg`;
  if (files.has('text-black.svg')) variants['textBlack'] = `/icons/${slug}/text-black.svg`;
  if (files.has('text-white.svg')) variants['textWhite'] = `/icons/${slug}/text-white.svg`;

  if (icon.variants && icon.variants.textBrand) {
    if (isBlackOrWhite) {
      if (variants['text']) {
        variants['textBrand'] = variants['text'];
      }
    } else if (files.has('text-brand.svg')) {
      variants['textBrand'] = `/icons/${slug}/text-brand.svg`;
    }
  }

  result.push({
    name:       icon.name || icon.title,
    hex:        icon.hex,
    categories: icon.categories,
    variants,
    url:        icon.url,
    collection: icon.collection,
  });
}

fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), 'utf8');

console.log(`
────────────────────────────────
✅  icons.json rewritten!
   Original entries : ${icons.length}
   Kept entries     : ${result.length}
   Removed entries  : ${icons.length - result.length}
   Output           : icons.json (in-place)
────────────────────────────────
`);
