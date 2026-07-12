#!/usr/bin/env node
/**
 * process-complete-data.js
 *
 * Reads icons-complete-data.json and for each icon:
 *  1. Creates folder in extra/ if missing
 *  2. Generates mono.svg, color.svg (if color data exists), black.svg, white.svg
 *  3. Extracts hex colors (can be multiple from multi-colored paths)
 *  4. Merges into icons.json (updates existing or adds new entries)
 */

const fs   = require('fs');
const path = require('path');

const BASE      = __dirname;
const EXTRA_DIR = path.join(BASE, '..', 'icons');
const DATA_FILE = path.join(BASE, 'icons-complete-data.json');
const ICONS_FILE= path.join(BASE, '..', 'database', 'icons.json');

// ── SVG builders ──────────────────────────────────────────────────────────────

function buildMonoSVG(svgData, title) {
  const vb        = svgData.viewBox || '0 0 24 24';
  const fillRule  = svgData.fillRule ? ` fill-rule="${svgData.fillRule}"` : '';
  const paths     = (svgData.paths || []).map(p => {
    // mono paths usually have no individual fill
    return `  <path d="${p.d}" />`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="currentColor"${fillRule}>
  <title>${escXml(title)}</title>
${paths}
</svg>`;
}

function buildColorSVG(svgData, title) {
  const vb       = svgData.viewBox || '0 0 24 24';
  const topFill  = svgData.fill || '';
  const fillRule = svgData.fillRule ? ` fill-rule="${svgData.fillRule}"` : '';
  const topFillAttr = topFill && topFill !== 'currentColor' ? ` fill="${topFill}"` : ' fill="currentColor"';

  const paths = (svgData.paths || []).map(p => {
    const fillAttr = p.fill ? ` fill="${p.fill}"` : '';
    const extraAttrs = Object.entries(p)
      .filter(([k]) => !['d', 'fill'].includes(k))
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    return `  <path d="${p.d}"${fillAttr}${extraAttrs} />`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${topFillAttr}${fillRule}>
  <title>${escXml(title)}</title>
${paths}
</svg>`;
}

function buildBlackSVG(svgData, title) {
  const vb       = svgData.viewBox || '0 0 24 24';
  const fillRule = svgData.fillRule ? ` fill-rule="${svgData.fillRule}"` : '';
  const paths    = (svgData.paths || []).map(p => `  <path d="${p.d}" />`).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="#000000"${fillRule}>
  <title>${escXml(title)}</title>
${paths}
</svg>`;
}

function buildWhiteSVG(svgData, title) {
  const vb       = svgData.viewBox || '0 0 24 24';
  const fillRule = svgData.fillRule ? ` fill-rule="${svgData.fillRule}"` : '';
  const paths    = (svgData.paths || []).map(p => `  <path d="${p.d}" />`).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="#ffffff"${fillRule}>
  <title>${escXml(title)}</title>
${paths}
</svg>`;
}

function escXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Hex extraction ────────────────────────────────────────────────────────────

function extractHexColors(icon) {
  const hexSet = new Set();

  // From color SVG paths individual fills
  const colorSvg = icon.svg && icon.svg.color;
  if (colorSvg && colorSvg.paths) {
    colorSvg.paths.forEach(p => {
      if (p.fill && p.fill !== 'currentColor' && p.fill !== 'none') {
        hexSet.add(normalizeHex(p.fill));
      }
    });
    if (colorSvg.fill && colorSvg.fill !== 'currentColor' && colorSvg.fill !== 'none') {
      hexSet.add(normalizeHex(colorSvg.fill));
    }
  }

  // From top-level color field
  if (icon.color && icon.color !== 'none') {
    hexSet.add(normalizeHex(icon.color));
  }

  // From style.COLOR_PRIMARY
  if (icon.style && icon.style.COLOR_PRIMARY) {
    hexSet.add(normalizeHex(icon.style.COLOR_PRIMARY));
  }

  // Remove invalid
  const valid = [...hexSet].filter(h => /^[0-9a-fA-F]{6}$/.test(h));
  return valid;
}

function normalizeHex(raw) {
  if (!raw) return '';
  let h = raw.trim().replace(/^#/, '');
  // Expand short hex #abc → aabbcc
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return h.toUpperCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────

const completeData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const existingIcons= JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8'));

// Index existing icons by name (lowercased) for quick lookup
const existingBySlug = new Map();
existingIcons.forEach(icon => {
  // Use the first variant path to infer slug  e.g. "/icons/adobe/color.svg" -> "adobe"
  const firstVariant = icon.variants && Object.values(icon.variants)[0];
  if (firstVariant) {
    const slug = firstVariant.split('/')[2]; // "/icons/{slug}/..."
    existingBySlug.set(slug, icon);
  }
});

let created  = 0;
let updated  = 0;
let skipped  = 0;
let errors   = 0;
const newEntries = [];

for (const icon of completeData) {
  const slug  = icon.docsUrl;
  const title = (icon.fullTitle || icon.title || slug)
    .replace(/[^\x00-\x7F]+/g, '').replace(/\(\s*\)/g, '').trim();

  if (!slug) { skipped++; continue; }

  const folderPath = path.join(EXTRA_DIR, slug);

  // ── SKIP if folder already exists (don't overwrite existing icons) ──
  if (fs.existsSync(folderPath)) {
    skipped++;
    continue;
  }

  // Create folder for new icon
  try {
    fs.mkdirSync(folderPath, { recursive: true });
  } catch(e) {
    console.error(`[ERROR] mkdir "${slug}": ${e.message}`);
    errors++; continue;
  }

  const svgData = icon.svg || {};
  const monoData  = svgData.mono;
  const colorData = svgData.color;

  // Pick the best source for black/white (prefer color → mono)
  const baseData = colorData || monoData;
  if (!baseData) { skipped++; continue; }

  // --- default.svg (points to best available) ---
  try {
    if (colorData && colorData.paths && colorData.paths.length) {
      fs.writeFileSync(path.join(folderPath, 'default.svg'), buildColorSVG(colorData, title), 'utf8');
    } else {
      fs.writeFileSync(path.join(folderPath, 'default.svg'), buildMonoSVG(baseData, title), 'utf8');
    }
    variants.default = `/icons/${slug}/default.svg`;
  } catch(e) { console.error(`[ERROR] default "${slug}": ${e.message}`); }

  // --- black.svg ---
  try {
    fs.writeFileSync(path.join(folderPath, 'black.svg'), buildBlackSVG(baseData, title), 'utf8');
    variants.black = `/icons/${slug}/black.svg`;
  } catch(e) { console.error(`[ERROR] black "${slug}": ${e.message}`); }

  // --- white.svg ---
  try {
    fs.writeFileSync(path.join(folderPath, 'white.svg'), buildWhiteSVG(baseData, title), 'utf8');
    variants.white = `/icons/${slug}/white.svg`;
  } catch(e) { console.error(`[ERROR] white "${slug}": ${e.message}`); }

  // --- Extract hex colors ---
  const hexColors = extractHexColors(icon);
  // Use single string if 1 color, array if multiple
  const hexValue = hexColors.length === 0 ? ''
                 : hexColors.length === 1 ? hexColors[0]
                 : hexColors;

  const hexNorm = typeof hexValue === 'string' ? hexValue.trim().toLowerCase() : (Array.isArray(hexValue) && hexValue.length > 0 ? hexValue[0].trim().toLowerCase() : null);
  const isBlackOrWhite = (
    hexNorm === '000' || hexNorm === '000000' ||
    hexNorm === 'fff' || hexNorm === 'ffffff'
  );

  if (isBlackOrWhite && variants.default) {
    variants.brand = variants.default;
  }

  // --- Determine categories ---
  const categories = icon.group ? [icon.group] : [];

  // --- Build icons.json entry ---
  const entry = {
    name: title,
    hex:  hexValue,
    categories,
    variants,
    url:        icon.desc && icon.desc.startsWith('http') ? icon.desc : '',
    collection: 'brands'
  };

  // Only add if not already in icons.json
  if (!existingBySlug.has(slug)) {
    newEntries.push(entry);
    created++;
  } else {
    // Already in icons.json — was kept from folder check above, shouldn't reach here
    skipped++;
  }
}

// Append new entries
const finalIcons = [...existingIcons, ...newEntries];
fs.writeFileSync(ICONS_FILE, JSON.stringify(finalIcons, null, 2), 'utf8');

console.log(`
────────────────────────────────
✅  Done!
   Total in complete-data  : ${completeData.length}
   New icons added         : ${created}
   Skipped (already exist) : ${skipped}
   Errors                  : ${errors}
   Final icons.json count  : ${finalIcons.length}
────────────────────────────────
`);
