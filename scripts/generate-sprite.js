#!/usr/bin/env node
/**
 * generate-sprite.js
 *
 * Generates a single SVG sprite containing all icons as <symbol> elements.
 * This replaces 4900+ individual <img> requests on the gallery page with 1 sprite load.
 *
 * Also builds a viewBox map (sprite-index.json) so the gallery page knows each icon's
 * natural viewBox when rendering from the sprite.
 */

const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'icons');
const OUTPUT_SPRITE = path.join(__dirname, '..', 'icons', 'sprite.svg');
const OUTPUT_INDEX = path.join(__dirname, '..', 'database', 'sprite-index.json');

function extractSvgContent(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Strip <svg ...> and </svg> tags, keep everything between
  const inner = raw.replace(/<svg[^>]*>/i, '').replace(/<\/svg>/i, '').trim();
  // Extract viewBox
  const vbMatch = raw.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 24 24';
  // Extract fill attributes from svg tag
  const fillMatch = raw.match(/fill\s*=\s*["']([^"']+)["']/i);
  const fill = fillMatch && fillMatch[1] !== 'none' ? ` fill="${fillMatch[1]}"` : '';
  return { inner, viewBox, fill };
}

const folders = fs.readdirSync(ICONS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory() && !d.name.startsWith('.'))
  .map(d => d.name);

console.log(`Building sprite from ${folders.length} icons...`);

const symbols = [];
const viewBoxMap = {};
let skipped = 0;

for (const slug of folders) {
  const defaultPath = path.join(ICONS_DIR, slug, 'default.svg');
  if (!fs.existsSync(defaultPath)) {
    skipped++;
    continue;
  }
  try {
    const { inner, viewBox, fill } = extractSvgContent(defaultPath);
    // Escape the inner content for XML — wrap paths in a <g> to preserve structure
    symbols.push(`  <symbol id="${slug}" viewBox="${viewBox}"${fill}>\n${inner}\n  </symbol>`);
    viewBoxMap[slug] = viewBox;
  } catch (e) {
    console.error(`  [SKIP] ${slug}: ${e.message}`);
    skipped++;
  }
}

const sprite = `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbols.join('\n')}
</svg>
`;

fs.writeFileSync(OUTPUT_SPRITE, sprite, 'utf8');
fs.writeFileSync(OUTPUT_INDEX, JSON.stringify(viewBoxMap, null, 2), 'utf8');

const sizeKb = (Buffer.byteLength(sprite, 'utf8') / 1024).toFixed(1);
console.log(`\n✅ Sprite generated:`);
console.log(`   icons/sprite.svg       (${sizeKb} KB, ${symbols.length} symbols)`);
console.log(`   database/sprite-index.json  (${Object.keys(viewBoxMap).length} viewBox entries)`);
if (skipped) console.log(`   Skipped: ${skipped} (no default.svg)`);
