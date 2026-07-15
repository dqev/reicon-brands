#!/usr/bin/env node
/**
 * add-icon.js
 *
 * One-step script to add a new brand icon to the collection.
 *
 * Usage:
 *   node scripts/add-icon.js \
 *     --input /path/to/source.svg \
 *     --name "Brand Name" \
 *     --hex "HEXCOLOR" \
 *     --categories "Cat1,Cat2" \
 *     --url "https://example.com"
 *
 * What it does:
 *   1. Fixes viewBox/sizing (makes width/height match viewBox)
 *   2. Creates icons/<slug>/ directory
 *   3. Writes default.svg (fixed source)
 *   4. Generates brand.svg (all fills → brand hex, with role=img + title)
 *   5. Generates black.svg (all fills → #000000)
 *   6. Generates white.svg (all fills → #ffffff)
 *   7. Adds/updates entry in database/icons.json
 *   8. Syncs all database files (sorted, categorized, stats, etc.)
 *   9. Generates icon HTML page at /icon/<slug>/
 *   10. Generates SEO files (sitemap.xml, llms.txt, robots.txt, humans.txt, brands-index.md)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ICONS_DIR = path.join(ROOT, 'icons');
const ICONS_JSON = path.join(ROOT, 'database', 'icons.json');

// ── CLI ──────────────────────────────────────────────────────

const args = {};
process.argv.slice(2).forEach((arg, i, arr) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const val = arr[i + 1];
    args[key] = (val && !val.startsWith('--')) ? val : true;
  }
});

if (args.help || args.h) {
  console.log(`
Usage: node scripts/add-icon.js [options]

Options:
  --input <path>     Path to source SVG file (required)
  --name <string>    Brand name (required)
  --hex <string>     Primary brand hex color, e.g. "7CCE24" (required)
  --categories <str> Comma-separated categories, e.g. "Design,Icon"
  --url <string>     Official website URL
  --collection <str> Collection name (default: "brands")
  --help             Show this help

Example:
  node scripts/add-icon.js \\
    --input ~/Desktop/icon.svg \\
    --name "Hugeicons" \\
    --hex "7CCE24" \\
    --categories "Design,Icon" \\
    --url "https://hugeicons.com"
`);
  process.exit(0);
}

if (!args.input || !args.name || !args.hex) {
  console.error('ERROR: --input, --name, and --hex are required');
  process.exit(1);
}

const sourcePath = path.resolve(args.input);
if (!fs.existsSync(sourcePath)) {
  console.error(`ERROR: Input file not found: ${sourcePath}`);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .replace(/\./g, '-')
    || 'icon';
}

function hexColor(raw) {
  return '#' + raw.trim().replace(/^#/, '');
}

function fixViewBox(svg) {
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/);
  if (!vb) return svg;
  const parts = vb[1].split(/\s+/).map(Number);
  if (parts.length !== 4) return svg;
  const [, , w, h] = parts;
  return svg
    .replace(/\bwidth\s*=\s*["']\d+(\.\d+)?["']/gi, `width="${w}"`)
    .replace(/\bheight\s*=\s*["']\d+(\.\d+)?["']/gi, `height="${h}"`);
}

function stripStyle(svg) {
  return svg.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
}

function replaceColors(svg, color) {
  let s = svg;
  // fill/stroke attribute values
  s = s.replace(
    /\b(fill|stroke|stop-color|flood-color|color)\s*=\s*(["'])([^"']*)\2/gi,
    (m, attr, q, val) => {
      const v = val.trim().toLowerCase();
      if (v === 'none' || v === 'inherit' || v === 'transparent' || v === '') return m;
      return `${attr}=${q}${color}${q}`;
    }
  );
  // inline CSS property values
  s = s.replace(
    /\b(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"'}\s]+)/gi,
    (m, prop, val) => {
      const v = val.trim().toLowerCase();
      if (v === 'none' || v === 'inherit' || v === 'transparent') return m;
      return `${prop}:${color}`;
    }
  );
  s = s.replace(/\bcurrentColor\b/g, color);
  return s;
}

function generateVariant(svg, color) {
  let s = stripStyle(svg);
  s = replaceColors(s, color);
  // Inject style override after <svg>
  s = s.replace(
    /(<svg[^>]*>)/i,
    `$1\n  <style>*:not([fill="none"]):not([stroke="none"]){fill:${color}}</style>`
  );
  return s;
}

function runScript(name) {
  const scriptPath = path.join(__dirname, name);
  if (!fs.existsSync(scriptPath)) {
    console.error(`  [SKIP] Script not found: ${name}`);
    return;
  }
  console.log(`  Running ${name}...`);
  execSync(`node "${scriptPath}"`, { cwd: ROOT, stdio: 'inherit' });
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  const name = args.name.trim();
  const hex = args.hex.trim().replace(/^#/, '');
  const brandColor = hexColor(hex);
  const slug = slugify(name);
  const categories = args.categories
    ? args.categories.split(',').map(c => c.trim()).filter(Boolean)
    : [];
  const url = args.url || '';
  const collection = args.collection || 'brands';
  const targetDir = path.join(ICONS_DIR, slug);

  console.log(`\n═══ Adding icon: ${name} ═══`);
  console.log(`  Slug:       ${slug}`);
  console.log(`  Hex:        #${hex}`);
  console.log(`  Categories: ${categories.join(', ') || '(none)'}`);
  console.log(`  URL:        ${url || '(none)'}`);
  console.log(`  Directory:  icons/${slug}/\n`);

  // ── Step 1: Read and fix viewBox ──
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const fixed = fixViewBox(raw);
  const vb = fixed.match(/viewBox\s*=\s*["']([^"']+)["']/);
  const viewBox = vb ? vb[1] : '0 0 24 24';

  // ── Step 2: Create directory ──
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`  [1/7] Created icons/${slug}/`);
  } else {
    console.log(`  [1/7] Directory exists: icons/${slug}/`);
  }

  // ── Step 3: Write default.svg ──
  fs.writeFileSync(path.join(targetDir, 'default.svg'), fixed, 'utf8');
  console.log(`  [2/7] Wrote default.svg  (viewBox="${viewBox}")`);

  // ── Step 4: Generate brand.svg ──
  const brandRaw = generateVariant(fixed, brandColor);
  // Add role="img" and <title> for accessibility
  const brandFinal = brandRaw
    .replace(/^(<svg)(\s)/i, '$1 role="img"$2')
    .replace(
      /(<svg[^>]*>)/i,
      `$1\n  <title>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</title>`
    );
  fs.writeFileSync(path.join(targetDir, 'brand.svg'), brandFinal, 'utf8');
  console.log(`  [3/7] Generated brand.svg (#${hex})`);

  // ── Step 5: Generate black.svg ──
  fs.writeFileSync(path.join(targetDir, 'black.svg'), generateVariant(fixed, '#000000'), 'utf8');
  console.log('  [4/7] Generated black.svg (#000000)');

  // ── Step 6: Generate white.svg ──
  fs.writeFileSync(path.join(targetDir, 'white.svg'), generateVariant(fixed, '#ffffff'), 'utf8');
  console.log('  [5/7] Generated white.svg (#ffffff)');

  // ── Step 7: Update icons.json ──
  const icons = JSON.parse(fs.readFileSync(ICONS_JSON, 'utf8'));
  const entry = {
    name,
    hex,
    categories,
    variants: {
      default: `/icons/${slug}/default.svg`,
      brand: `/icons/${slug}/brand.svg`,
      black: `/icons/${slug}/black.svg`,
      white: `/icons/${slug}/white.svg`,
    },
    url,
    collection,
  };

  const existing = icons.findIndex(i => {
    const s = i.variants?.default?.split('/')[2];
    return s === slug;
  });

  if (existing >= 0) {
    icons[existing] = entry;
    console.log(`  [6/7] Updated existing entry in icons.json`);
  } else {
    icons.push(entry);
    console.log(`  [6/7] Added entry to icons.json`);
  }
  fs.writeFileSync(ICONS_JSON, JSON.stringify(icons, null, 2), 'utf8');

  // ── Step 8–10: Run pipeline scripts ──
  console.log(`\n  [7/7] Running pipeline...\n`);

  runScript('update-database-files.js');
  runScript('generate-icon-pages.js');
  runScript('generate-seo-files.js');

  console.log(`\n✅  Done! Added "${name}" (${slug})`);
  console.log(`   HTML page: /icon/${slug}/`);
  console.log(`   SVGs:      icons/${slug}/{default,brand,black,white}.svg`);
  console.log(`   All DB, SEO, and HTML files regenerated.\n`);
}

main();
