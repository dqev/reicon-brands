#!/usr/bin/env node
/**
 * process-text-variants.js
 *
 * Scans icons-complete-data.json for icons with a `svg.text` variant.
 * If the icon's folder exists in extra/:
 *   - Generates text.svg
 *   - Generates text-black.svg
 *   - Generates text-white.svg
 *   - Generates text-brand.svg (using the brand color hex)
 *   - Updates icons.json variants mapping.
 */

const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const EXTRA_DIR = path.join(BASE, '..', 'icons');
const DATA_FILE = path.join(BASE, 'icons-complete-data.json');
const ICONS_FILE = path.join(BASE, '..', 'database', 'icons.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBrandColor(hexVal) {
  if (!hexVal) return '#000000';
  if (Array.isArray(hexVal)) {
    return hexVal.length > 0 ? '#' + hexVal[0].replace(/^#/, '') : '#000000';
  }
  if (typeof hexVal === 'string' && hexVal.trim() !== '') {
    return '#' + hexVal.trim().replace(/^#/, '');
  }
  return '#000000';
}

function buildSVG(svgData, title, fillOverride) {
  const vb = svgData.viewBox || '0 0 24 24';
  const fillRule = svgData.fillRule ? ` fill-rule="${svgData.fillRule}"` : '';
  const topFill = fillOverride || svgData.fill || 'currentColor';
  const topFillAttr = topFill !== 'none' ? ` fill="${topFill}"` : '';

  const paths = (svgData.paths || []).map(p => {
    let fillAttr = '';
    if (fillOverride) {
      if (p.fill && p.fill !== 'none') fillAttr = ` fill="${fillOverride}"`;
    } else if (p.fill) {
      fillAttr = ` fill="${p.fill}"`;
    }

    const extraAttrs = Object.entries(p)
      .filter(([k]) => !['d', 'fill'].includes(k))
      .map(([k, v]) => ` ${k}="${v}"`)
      .join('');
    return `  <path d="${p.d}"${fillAttr}${extraAttrs} />`;
  }).join('\n');

  let styleBlock = '';
  if (fillOverride && fillOverride !== 'none') {
    styleBlock = `\n  <style>*:not([fill="none"]):not([stroke="none"]){fill:${fillOverride}}</style>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${topFillAttr}${fillRule}>${styleBlock}
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

// ── Main ──────────────────────────────────────────────────────────────────────

if (!fs.existsSync(DATA_FILE) || !fs.existsSync(ICONS_FILE)) {
  console.error('[ERROR] Source files missing.');
  process.exit(1);
}

const completeData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const icons = JSON.parse(fs.readFileSync(ICONS_FILE, 'utf8'));

// Index icons by slug
const iconsBySlug = new Map();
icons.forEach(icon => {
  if (icon.variants) {
    const firstVariant = Object.values(icon.variants)[0];
    if (firstVariant) {
      const slug = firstVariant.split('/')[2];
      iconsBySlug.set(slug, icon);
    }
  }
});

let processed = 0;
let skipped = 0;
let errors = 0;

for (const icon of completeData) {
  const slug = icon.docsUrl;
  if (!slug || !icon.svg || !icon.svg.text) {
    continue;
  }

  const folderPath = path.join(EXTRA_DIR, slug);
  if (!fs.existsSync(folderPath)) {
    skipped++;
    continue;
  }

  const title = (icon.fullTitle || icon.title || slug)
    .replace(/[^\x00-\x7F]+/g, '').replace(/\(\s*\)/g, '').trim();

  const textData = icon.svg.text;
  const brandColor = iconsBySlug.has(slug) ? getBrandColor(iconsBySlug.get(slug).hex) : getBrandColor(icon.color);

  const hexNorm = brandColor.trim().toLowerCase().replace(/^#/, '');
  const isBlackOrWhite = (
    hexNorm === '000' || hexNorm === '000000' ||
    hexNorm === 'fff' || hexNorm === 'ffffff'
  );

  try {
    // 1. Generate text.svg
    fs.writeFileSync(path.join(folderPath, 'text.svg'), buildSVG(textData, title), 'utf8');

    // 2. Generate text-black.svg
    fs.writeFileSync(path.join(folderPath, 'text-black.svg'), buildSVG(textData, title, '#000000'), 'utf8');

    // 3. Generate text-white.svg
    fs.writeFileSync(path.join(folderPath, 'text-white.svg'), buildSVG(textData, title, '#ffffff'), 'utf8');

    // 4. Generate text-brand.svg (only if brand color is not black/white)
    if (!isBlackOrWhite) {
      fs.writeFileSync(path.join(folderPath, 'text-brand.svg'), buildSVG(textData, title, brandColor), 'utf8');
    }

    // Update icons.json entry
    if (iconsBySlug.has(slug)) {
      const targetIcon = iconsBySlug.get(slug);
      targetIcon.variants = targetIcon.variants || {};
      targetIcon.variants.text = `/icons/${slug}/text.svg`;
      targetIcon.variants.textBlack = `/icons/${slug}/text-black.svg`;
      targetIcon.variants.textWhite = `/icons/${slug}/text-white.svg`;
      if (isBlackOrWhite) {
        targetIcon.variants.textBrand = targetIcon.variants.text;
      } else {
        targetIcon.variants.textBrand = `/icons/${slug}/text-brand.svg`;
      }
    }

    processed++;
  } catch (err) {
    console.error(`[ERROR] Failed to write text SVGs for "${slug}": ${err.message}`);
    errors++;
  }
}

// Write the updated icons.json back
fs.writeFileSync(ICONS_FILE, JSON.stringify(icons, null, 2), 'utf8');

console.log(`
────────────────────────────────
✅  Done!
   Processed (text SVGs written) : ${processed}
   Skipped (folder not found)     : ${skipped}
   Errors                         : ${errors}
   Output                         : text.svg, text-black.svg, text-white.svg, text-brand.svg, updated icons.json
────────────────────────────────
`);
