const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..');
const DB_DIR = path.join(BASE_DIR, 'database');

function syncDatabase() {
  console.log('Synchronizing database files...');
  
  // 1. Load database/icons.json
  const iconsPath = path.join(DB_DIR, 'icons.json');
  if (!fs.existsSync(iconsPath)) {
    throw new Error('icons.json not found in database/ folder');
  }
  const icons = JSON.parse(fs.readFileSync(iconsPath, 'utf8'));
  
  // Sort icons array alphabetically by name
  icons.sort((a, b) => a.name.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
  fs.writeFileSync(iconsPath, JSON.stringify(icons, null, 2), 'utf8');
  console.log(`Sorted icons.json (${icons.length} entries)`);

  // 2. Generate database/brand-names.json
  const brandNamesPath = path.join(DB_DIR, 'brand-names.json');
  const brandNames = icons.map(i => i.name).sort();
  fs.writeFileSync(brandNamesPath, JSON.stringify(brandNames, null, 2), 'utf8');
  console.log(`Generated brand-names.json (${brandNames.length} names)`);

  // 3. Update database/brands-by-category.json
  const categorizedPath = path.join(DB_DIR, 'brands-by-category.json');
  let categorized = {};
  if (fs.existsSync(categorizedPath)) {
    categorized = JSON.parse(fs.readFileSync(categorizedPath, 'utf8'));
  }
  
  // Preserving existing curated categories to keep the curated structure intact
  const curatedCategories = Object.keys(categorized).filter(k => k !== 'Other');
  
  // Re-initialize each category to prevent duplicate/stale entries
  const newCategorized = {};
  curatedCategories.forEach(cat => {
    newCategorized[cat] = [];
  });
  newCategorized['Other'] = [];

  // Group brands into curated categories or fallback to "Other"
  icons.forEach(icon => {
    let matched = false;
    if (icon.categories && Array.isArray(icon.categories)) {
      icon.categories.forEach(cat => {
        // Direct match with curated category name
        if (curatedCategories.includes(cat)) {
          newCategorized[cat].push(icon.name);
          matched = true;
        } else {
          // Check if curated category name is included as substring/case-insensitive helper
          const matchedCurated = curatedCategories.find(cur => cur.toLowerCase() === cat.toLowerCase());
          if (matchedCurated) {
            newCategorized[matchedCurated].push(icon.name);
            matched = true;
          }
        }
      });
    }
    
    if (!matched) {
      newCategorized['Other'].push(icon.name);
    }
  });

  // Sort brand names inside categories alphabetically and remove duplicates
  Object.keys(newCategorized).forEach(cat => {
    const uniqueList = [...new Set(newCategorized[cat])];
    uniqueList.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    newCategorized[cat] = uniqueList;
  });

  fs.writeFileSync(categorizedPath, JSON.stringify(newCategorized, null, 2), 'utf8');
  console.log(`Updated brands-by-category.json`);

  // 4. Update database/top-brands.json
  const topByCategoryPath = path.join(DB_DIR, 'top-brands.json');
  let topByCategory = {};
  if (fs.existsSync(topByCategoryPath)) {
    topByCategory = JSON.parse(fs.readFileSync(topByCategoryPath, 'utf8'));
  }

  // Load list of featured brands
  const featuredBrandsPath = path.join(DB_DIR, 'featured-brands.json');
  let featuredBrandsList = [];
  if (fs.existsSync(featuredBrandsPath)) {
    featuredBrandsList = JSON.parse(fs.readFileSync(featuredBrandsPath, 'utf8'));
  }

  // Update top brands list per category, prioritising items in featuredBrandsList
  const newTopByCategory = {};
  Object.keys(newCategorized).forEach(cat => {
    if (cat === 'Other') return;
    
    const allBrandsInCat = newCategorized[cat];
    const preferred = allBrandsInCat.filter(b => featuredBrandsList.includes(b));
    const nonPreferred = allBrandsInCat.filter(b => !featuredBrandsList.includes(b));
    const merged = [...preferred, ...nonPreferred].slice(0, 10);
    
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    newTopByCategory[cat] = merged;
  });

  fs.writeFileSync(topByCategoryPath, JSON.stringify(newTopByCategory, null, 2), 'utf8');
  console.log(`Updated top-brands.json`);

  // 5. Recompute database/statistics.json
  const statsPath = path.join(DB_DIR, 'statistics.json');
  
  const allCategoriesSet = new Set();
  const brandsByCategoryCounts = {};
  
  icons.forEach(icon => {
    if (icon.categories && Array.isArray(icon.categories)) {
      icon.categories.forEach(cat => {
        allCategoriesSet.add(cat);
        brandsByCategoryCounts[cat] = (brandsByCategoryCounts[cat] || 0) + 1;
      });
    }
  });

  const stats = {
    totalBrands: icons.length,
    totalCategories: allCategoriesSet.size,
    brandsByCategory: brandsByCategoryCounts
  };

  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`Generated statistics.json`);

  // 6. Generate database/complete-database.json
  const completeDbPath = path.join(DB_DIR, 'complete-database.json');
  
  const familiesPath = path.join(DB_DIR, 'brand-families.json');
  const families = fs.existsSync(familiesPath) ? JSON.parse(fs.readFileSync(familiesPath, 'utf8')) : {};
  
  const completeDb = {
    categorized: newCategorized,
    families: families,
    topBrands: newTopByCategory,
    stats: {
      totalBrands: stats.totalBrands,
      totalCategories: stats.totalCategories,
      brandsByCategory: brandsByCategoryCounts
    }
  };

  fs.writeFileSync(completeDbPath, JSON.stringify(completeDb, null, 2), 'utf8');
  console.log(`Generated complete-database.json`);

  // 7. Update database/category-summary.json statistics block
  const categorySummaryPath = path.join(DB_DIR, 'category-summary.json');
  if (fs.existsSync(categorySummaryPath)) {
    const summary = JSON.parse(fs.readFileSync(categorySummaryPath, 'utf8'));
    if (summary.statistics) {
      summary.statistics.total_brands = icons.length;
      summary.statistics.total_categories = curatedCategories.length;
      summary.statistics.average_brands_per_category = Math.round(icons.length / curatedCategories.length);
      fs.writeFileSync(categorySummaryPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(`Updated statistics in category-summary.json`);
    }
  }

  // 8. Generate database/data.json (single composite for the main page)
  const dataJsonPath = path.join(DB_DIR, 'data.json');
  const dataJson = {
    icons: icons,
    topBrands: newTopByCategory,
    brandsByCategory: newCategorized,
    statistics: stats,
    featuredBrands: featuredBrandsList,
  };
  fs.writeFileSync(dataJsonPath, JSON.stringify(dataJson, null, 2), 'utf8');
  console.log(`Generated data.json (composite, ${(Buffer.byteLength(JSON.stringify(dataJson), 'utf8') / 1024).toFixed(1)} KB)`);

  console.log('All database files successfully synchronized!');
}

module.exports = { syncDatabase };

if (require.main === module) {
  try {
    syncDatabase();
  } catch (err) {
    console.error(`Error syncing database: ${err.message}`);
    process.exit(1);
  }
}
