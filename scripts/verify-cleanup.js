const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const ICONS_JSON_PATH = path.join(BASE_DIR, 'database', 'icons.json');
const ICONS_DIR = path.join(BASE_DIR, 'icons');

if (!fs.existsSync(ICONS_JSON_PATH)) {
  console.error(`[FAIL] ${ICONS_JSON_PATH} not found.`);
  process.exit(1);
}

const icons = JSON.parse(fs.readFileSync(ICONS_JSON_PATH, 'utf8'));

let failures = 0;

function reportFail(msg) {
  console.error(`[FAIL] ${msg}`);
  failures++;
}

// 1. Check mapping issues in icons.json
for (const icon of icons) {
  let slug = null;
  if (icon.variants) {
    const firstVariant = Object.values(icon.variants)[0];
    if (firstVariant) {
      slug = firstVariant.split('/')[2];
    }
  }

  if (!slug) {
    reportFail(`Icon "${icon.name}" has no variants or cannot infer slug`);
    continue;
  }

  const hex = icon.hex ? (Array.isArray(icon.hex) ? (icon.hex.length > 0 ? icon.hex[0] : '') : icon.hex).trim().toLowerCase() : '';
  const isBlackOrWhite = (
    hex === '000' || hex === '000000' ||
    hex === 'fff' || hex === 'ffffff'
  );

  const variants = icon.variants || {};

  if (variants.mono) {
    reportFail(`Icon "${icon.name}" (${slug}) still has mapped "mono" variant: ${variants.mono}`);
  }
  if (variants.color) {
    reportFail(`Icon "${icon.name}" (${slug}) still has mapped "color" variant: ${variants.color}`);
  }

  if (isBlackOrWhite) {
    if (variants.brand !== variants.default) {
      reportFail(`Icon "${icon.name}" (${slug}) is black/white but brand variant (${variants.brand}) is not mapped to default (${variants.default})`);
    }
    if (variants.textBrand && variants.textBrand !== variants.text) {
      reportFail(`Icon "${icon.name}" (${slug}) is black/white but textBrand (${variants.textBrand}) is not mapped to text (${variants.text})`);
    }
  } else {
    if (variants.brand === variants.default && variants.brand) {
      // Note: Some colored brands might map brand to default if they have no brand-specific SVG,
      // but let's check if brand.svg physically exists.
    }
  }

  // Physical files checks
  const folderPath = path.join(ICONS_DIR, slug);
  if (fs.existsSync(folderPath)) {
    if (fs.existsSync(path.join(folderPath, 'mono.svg'))) {
      reportFail(`Folder "${slug}" still contains mono.svg`);
    }
    if (fs.existsSync(path.join(folderPath, 'color.svg'))) {
      reportFail(`Folder "${slug}" still contains color.svg`);
    }
    if (isBlackOrWhite) {
      if (fs.existsSync(path.join(folderPath, 'brand.svg'))) {
        reportFail(`Folder "${slug}" (black/white brand) still contains brand.svg`);
      }
      if (fs.existsSync(path.join(folderPath, 'text-brand.svg'))) {
        reportFail(`Folder "${slug}" (black/white brand) still contains text-brand.svg`);
      }
    }
  }
}

// 2. Global scan of the directory to verify no stray mono/color/brand files in tracked folders
const trackedSlugs = new Set();
for (const icon of icons) {
  if (icon.variants) {
    const firstVariant = Object.values(icon.variants)[0];
    if (firstVariant) {
      const slug = firstVariant.split('/')[2];
      trackedSlugs.add(slug);
    }
  }
}

const folders = fs.readdirSync(ICONS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const slug of folders) {
  if (!trackedSlugs.has(slug)) continue;
  const folderPath = path.join(ICONS_DIR, slug);
  if (fs.existsSync(path.join(folderPath, 'mono.svg'))) {
    reportFail(`Tracked folder "${slug}" contains mono.svg`);
  }
  if (fs.existsSync(path.join(folderPath, 'color.svg'))) {
    reportFail(`Tracked folder "${slug}" contains color.svg`);
  }
}

if (failures === 0) {
  console.log(`[PASS] Verification completed successfully! All brand SVG variants are clean and correct.`);
  process.exit(0);
} else {
  console.error(`[FAIL] Verification failed with ${failures} errors.`);
  process.exit(1);
}
