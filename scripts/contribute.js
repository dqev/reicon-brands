#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { syncDatabase } = require('./update-database-files');

const BASE_DIR = path.join(__dirname, '..');
const ICONS_DIR = path.join(BASE_DIR, 'icons');
const DB_DIR = path.join(BASE_DIR, 'database');
const ICONS_JSON_PATH = path.join(DB_DIR, 'icons.json');

const BLACK = '#000000';
const WHITE = '#ffffff';

function toBlack(svgContent) {
  let s = svgContent;
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\b(fill|stroke|stop-color|flood-color|color)\s*=\s*(["'])([^"']*)\2/gi, (match, attr, quote, value) => {
    const v = value.trim().toLowerCase();
    if (v === 'none' || v === 'inherit' || v === 'transparent' || v === '') return match;
    return `${attr}=${quote}${BLACK}${quote}`;
  });
  s = s.replace(/\bcurrentColor\b/g, BLACK);
  s = s.replace(/\b(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"'}\s]+)/gi, (match, prop, value) => {
    const v = value.trim().toLowerCase();
    if (v === 'none' || v === 'inherit' || v === 'transparent') return match;
    return `${prop}:${BLACK}`;
  });
  s = s.replace(/(<svg[^>]*>)/i, `$1\n  <style>svg{fill:${BLACK}}</style>`);
  return s;
}

function toWhite(svgContent) {
  let s = svgContent;
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\b(fill|stroke|stop-color|flood-color|color)\s*=\s*(["'])([^"']*)\2/gi, (match, attr, quote, value) => {
    const v = value.trim().toLowerCase();
    if (v === 'none' || v === 'inherit' || v === 'transparent' || v === '') return match;
    return `${attr}=${quote}${WHITE}${quote}`;
  });
  s = s.replace(/\bcurrentColor\b/g, WHITE);
  s = s.replace(/\b(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"'}\s]+)/gi, (match, prop, value) => {
    const v = value.trim().toLowerCase();
    if (v === 'none' || v === 'inherit' || v === 'transparent') return match;
    return `${prop}:${WHITE}`;
  });
  s = s.replace(/(<svg[^>]*>)/i, `$1\n  <style>svg{fill:${WHITE}}</style>`);
  return s;
}

function toBrandColor(svgContent, brandColor) {
  let s = svgContent;
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/\b(fill|stroke|stop-color|flood-color|color)\s*=\s*(["'])([^"']*)\2/gi, (match, attr, quote, value) => {
    const v = value.trim().toLowerCase();
    if (v === 'none' || v === 'inherit' || v === 'transparent' || v === '') return match;
    return `${attr}=${quote}${brandColor}${quote}`;
  });
  s = s.replace(/\bcurrentColor\b/g, brandColor);
  s = s.replace(/\b(fill|stroke|stop-color|flood-color|color)\s*:\s*([^;"'}\s]+)/gi, (match, prop, value) => {
    const v = value.trim().toLowerCase();
    if (v === 'none' || v === 'inherit' || v === 'transparent') return match;
    return `${prop}:${brandColor}`;
  });
  s = s.replace(/(<svg[^>]*>)/i, `$1\n  <style>svg{fill:${brandColor}}</style>`);
  return s;
}

function getSlug(name) {
  return name
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/\./g, 'dot')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function validateSvg(content) {
  const trimmed = content.trim();
  return trimmed.includes('<svg') && trimmed.includes('</svg>');
}

// Simple CLI arg parser
const args = process.argv.slice(2);
const parsedArgs = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const key = args[i].slice(2);
    const val = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
    parsedArgs[key] = val;
    if (val !== true) i++;
  }
}

async function run() {
  console.log('✨ Welcome to the Brand Icon Contribution Tool! ✨\n');

  let name = parsedArgs.name;
  let hex = parsedArgs.hex;
  let categories = parsedArgs.categories;
  let url = parsedArgs.url;
  let collection = parsedArgs.collection;
  let svgInput = parsedArgs.svg;

  const isInteractive = Object.keys(parsedArgs).length === 0;

  if (isInteractive) {
    const interface = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    const ask = (query) => new Promise(resolve => interface.question(query, resolve));

    try {
      name = await ask('1. Enter brand name (e.g. MyBrand): ');
      while (!name.trim()) {
        name = await ask('Brand name cannot be empty. Enter brand name: ');
      }

      hex = await ask('2. Enter brand color hex (e.g. FF0000 or 000): ');
      while (!hex.trim()) {
        hex = await ask('Hex color cannot be empty. Enter brand color hex: ');
      }

      categories = await ask('3. Enter categories (comma-separated, e.g. Social, DevTool): ');
      url = await ask('4. Enter official brand URL (e.g. https://mybrand.com): ');
      collection = await ask('5. Enter collection (brands/community) [default: brands]: ');
      if (!collection.trim()) collection = 'brands';

      console.log('\n--- SVG Content Input ---');
      console.log('You can either specify a file path or paste raw SVG code.');
      svgInput = await ask('6. Enter path to SVG file OR paste raw SVG code: ');
      while (!svgInput.trim()) {
        svgInput = await ask('SVG input cannot be empty. Enter path OR paste SVG code: ');
      }
    } finally {
      interface.close();
    }
  } else {
    if (!name || typeof name !== 'string') {
      console.error('[ERROR] Missing required option: --name');
      process.exit(1);
    }
    if (!hex || typeof hex !== 'string') {
      console.error('[ERROR] Missing required option: --hex');
      process.exit(1);
    }
    if (!svgInput || typeof svgInput !== 'string') {
      console.error('[ERROR] Missing required option: --svg (path to SVG file or raw SVG code)');
      process.exit(1);
    }
    collection = collection || 'brands';
  }

  // Normalize color
  hex = hex.trim().replace(/^#/, '');
  
  // Normalize categories
  const categoriesArray = categories 
    ? categories.split(',').map(c => c.trim()).filter(Boolean)
    : [];

  // Load SVG content
  let svgContent = '';
  if (fs.existsSync(svgInput)) {
    svgContent = fs.readFileSync(svgInput, 'utf8');
  } else if (svgInput.trim().startsWith('<svg')) {
    svgContent = svgInput;
  } else {
    console.error(`[ERROR] SVG input is neither a valid file path nor valid raw SVG code.`);
    process.exit(1);
  }

  if (!validateSvg(svgContent)) {
    console.error('[ERROR] Invalid SVG structure. The SVG content must start with <svg and end with </svg>');
    process.exit(1);
  }

  // Generate slug
  const slug = getSlug(name);
  const folderPath = path.join(ICONS_DIR, slug);

  console.log(`\nProcessing brand: "${name}" (${slug})`);

  // Check if directory already exists
  if (fs.existsSync(folderPath)) {
    console.warn(`[WARNING] Directory already exists: icons/${slug}`);
  } else {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log(`Created directory: icons/${slug}`);
  }

  // 1. Write default.svg
  const defaultPath = path.join(folderPath, 'default.svg');
  fs.writeFileSync(defaultPath, svgContent, 'utf8');
  console.log(`✓ Generated: icons/${slug}/default.svg`);

  // 2. Generate black.svg
  const blackPath = path.join(folderPath, 'black.svg');
  fs.writeFileSync(blackPath, toBlack(svgContent), 'utf8');
  console.log(`✓ Generated: icons/${slug}/black.svg`);

  // 3. Generate white.svg
  const whitePath = path.join(folderPath, 'white.svg');
  fs.writeFileSync(whitePath, toWhite(svgContent), 'utf8');
  console.log(`✓ Generated: icons/${slug}/white.svg`);

  // 4. Generate brand.svg (only if color is not black or white)
  const hexNorm = hex.trim().toLowerCase();
  const isBlackOrWhite = (
    hexNorm === '000' || hexNorm === '000000' ||
    hexNorm === 'fff' || hexNorm === 'ffffff'
  );

  let brandVariantPath = '';
  if (isBlackOrWhite) {
    brandVariantPath = `/icons/${slug}/default.svg`;
    console.log(`ℹ Brand color is black/white. Brand variant maps to default.svg (brand.svg skipped)`);
  } else {
    const brandPath = path.join(folderPath, 'brand.svg');
    const brandColor = '#' + hex;
    fs.writeFileSync(brandPath, toBrandColor(svgContent, brandColor), 'utf8');
    brandVariantPath = `/icons/${slug}/brand.svg`;
    console.log(`✓ Generated: icons/${slug}/brand.svg`);
  }

  // 5. Update database/icons.json
  if (!fs.existsSync(ICONS_JSON_PATH)) {
    console.error(`[ERROR] ${ICONS_JSON_PATH} not found.`);
    process.exit(1);
  }
  const icons = JSON.parse(fs.readFileSync(ICONS_JSON_PATH, 'utf8'));

  // Remove existing entry if it's there (to overwrite/update it)
  const filteredIcons = icons.filter(icon => {
    if (icon.name.toLowerCase() === name.toLowerCase()) return false;
    if (icon.variants && icon.variants.default) {
      const existingSlug = icon.variants.default.split('/')[2];
      if (existingSlug === slug) return false;
    }
    return true;
  });

  const entry = {
    name,
    hex,
    categories: categoriesArray,
    variants: {
      default: `/icons/${slug}/default.svg`,
      brand: brandVariantPath,
      black: `/icons/${slug}/black.svg`,
      white: `/icons/${slug}/white.svg`
    },
    url: url || '',
    collection
  };

  filteredIcons.push(entry);

  // Write icons.json
  fs.writeFileSync(ICONS_JSON_PATH, JSON.stringify(filteredIcons, null, 2), 'utf8');
  console.log(`✓ Added/updated "${name}" in database/icons.json`);

  // 6. Run database synchronizer
  try {
    syncDatabase();
  } catch (err) {
    console.error(`[ERROR] Sync failed: ${err.message}`);
    process.exit(1);
  }

  console.log(`\n🎉 Contribution complete! "${name}" successfully added to the database. 🎉`);
}

run().catch(err => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
