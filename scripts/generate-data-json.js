#!/usr/bin/env node
/**
 * generate-data-json.js
 *
 * Merges all 5 database JSON files into a single `/database/data.json`.
 * This replaces 5 fetch() calls on the main page with 1.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'database');
const OUTPUT = path.join(DB_DIR, 'data.json');

function read(name) {
  const p = path.join(DB_DIR, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

const data = {
  icons: read('icons.json') || [],
  topBrands: read('top-brands.json') || {},
  brandsByCategory: read('brands-by-category.json') || {},
  statistics: read('statistics.json') || {},
  featuredBrands: read('featured-brands.json') || [],
};

fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2), 'utf8');

console.log(`Generated database/data.json (${(Buffer.byteLength(JSON.stringify(data), 'utf8') / 1024).toFixed(1)} KB)`);
console.log(`  icons: ${data.icons.length}`);
console.log(`  topBrands: ${Object.keys(data.topBrands).length} categories`);
console.log(`  brandsByCategory: ${Object.keys(data.brandsByCategory).length} categories`);
console.log(`  statistics: included`);
console.log(`  featuredBrands: ${data.featuredBrands.length} brands`);
