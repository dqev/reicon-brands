const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const ICONS_JSON_PATH = path.join(BASE_DIR, 'database', 'icons.json');
const ICONS_DIR = path.join(BASE_DIR, 'icons');

if (!fs.existsSync(ICONS_JSON_PATH)) {
  console.error(`[ERROR] ${ICONS_JSON_PATH} not found.`);
  process.exit(1);
}

const icons = JSON.parse(fs.readFileSync(ICONS_JSON_PATH, 'utf8'));
console.log(`Loaded ${icons.length} icons from icons.json`);

function getBrandColor(hexVal) {
  if (!hexVal) return null;
  if (Array.isArray(hexVal)) {
    return hexVal.length > 0 ? hexVal[0].trim().toLowerCase() : null;
  }
  if (typeof hexVal === 'string' && hexVal.trim() !== '') {
    return hexVal.trim().toLowerCase();
  }
  return null;
}

let deletedMonoCount = 0;
let deletedColorCount = 0;
let deletedBrandCount = 0;
let deletedTextBrandCount = 0;
let foldersProcessed = 0;

for (const icon of icons) {
  let slug = null;
  if (icon.variants) {
    const firstVariant = Object.values(icon.variants)[0];
    if (firstVariant) {
      slug = firstVariant.split('/')[2]; // "/icons/{slug}/..."
    }
  }

  if (!slug) {
    continue;
  }

  const folderPath = path.join(ICONS_DIR, slug);
  if (!fs.existsSync(folderPath)) {
    continue;
  }

  foldersProcessed++;

  const hex = getBrandColor(icon.hex);
  const isBlackOrWhite = (
    hex === '000' || hex === '000000' ||
    hex === 'fff' || hex === 'ffffff'
  );

  // File system cleanup
  const defaultPath = path.join(folderPath, 'default.svg');
  const monoPath = path.join(folderPath, 'mono.svg');
  const colorPath = path.join(folderPath, 'color.svg');
  const brandPath = path.join(folderPath, 'brand.svg');
  const textBrandPath = path.join(folderPath, 'text-brand.svg');

  // Ensure default.svg exists
  if (!fs.existsSync(defaultPath)) {
    if (fs.existsSync(colorPath)) {
      fs.renameSync(colorPath, defaultPath);
    } else if (fs.existsSync(monoPath)) {
      fs.renameSync(monoPath, defaultPath);
    }
  }

  // Delete mono.svg
  if (fs.existsSync(monoPath)) {
    fs.unlinkSync(monoPath);
    deletedMonoCount++;
  }

  // Delete color.svg
  if (fs.existsSync(colorPath)) {
    fs.unlinkSync(colorPath);
    deletedColorCount++;
  }

  // Delete brand.svg and text-brand.svg if brand color is black or white
  if (isBlackOrWhite) {
    if (fs.existsSync(brandPath)) {
      fs.unlinkSync(brandPath);
      deletedBrandCount++;
    }
    if (fs.existsSync(textBrandPath)) {
      fs.unlinkSync(textBrandPath);
      deletedTextBrandCount++;
    }
  }

  // Update variants object
  const oldVariants = icon.variants || {};
  const newVariants = {};

  // Default is always default.svg
  if (fs.existsSync(defaultPath)) {
    newVariants.default = `/icons/${slug}/default.svg`;
  }

  // Brand variant
  if (isBlackOrWhite) {
    if (newVariants.default) {
      newVariants.brand = newVariants.default;
    }
  } else {
    if (fs.existsSync(brandPath)) {
      newVariants.brand = `/icons/${slug}/brand.svg`;
    }
  }

  // Black and white
  const blackPath = path.join(folderPath, 'black.svg');
  if (fs.existsSync(blackPath)) {
    newVariants.black = `/icons/${slug}/black.svg`;
  }
  const whitePath = path.join(folderPath, 'white.svg');
  if (fs.existsSync(whitePath)) {
    newVariants.white = `/icons/${slug}/white.svg`;
  }

  // Text variants
  const textPath = path.join(folderPath, 'text.svg');
  if (fs.existsSync(textPath)) {
    newVariants.text = `/icons/${slug}/text.svg`;
  }
  const textBlackPath = path.join(folderPath, 'text-black.svg');
  if (fs.existsSync(textBlackPath)) {
    newVariants.textBlack = `/icons/${slug}/text-black.svg`;
  }
  const textWhitePath = path.join(folderPath, 'text-white.svg');
  if (fs.existsSync(textWhitePath)) {
    newVariants.textWhite = `/icons/${slug}/text-white.svg`;
  }

  if (oldVariants.textBrand) {
    if (isBlackOrWhite) {
      if (newVariants.text) {
        newVariants.textBrand = newVariants.text;
      }
    } else {
      if (fs.existsSync(textBrandPath)) {
        newVariants.textBrand = `/icons/${slug}/text-brand.svg`;
      }
    }
  }

  icon.variants = newVariants;
}

// Write the updated icons.json back
fs.writeFileSync(ICONS_JSON_PATH, JSON.stringify(icons, null, 2), 'utf8');

console.log(`Processed ${foldersProcessed} folders.`);
console.log(`Deleted mono.svg files: ${deletedMonoCount}`);
console.log(`Deleted color.svg files: ${deletedColorCount}`);
console.log(`Deleted brand.svg files (black/white brand color): ${deletedBrandCount}`);
console.log(`Deleted text-brand.svg files (black/white brand color): ${deletedTextBrandCount}`);
console.log(`Updated ${ICONS_JSON_PATH} successfully.`);
