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

  // 2. Generate database/brand_names.json
  const brandNamesPath = path.join(DB_DIR, 'brand_names.json');
  const brandNames = icons.map(i => i.name).sort();
  fs.writeFileSync(brandNamesPath, JSON.stringify(brandNames, null, 2), 'utf8');
  console.log(`Generated brand_names.json (${brandNames.length} names)`);

  // 3. Update database/1_brands_categorized.json
  const categorizedPath = path.join(DB_DIR, '1_brands_categorized.json');
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
  console.log(`Updated 1_brands_categorized.json`);

  // 4. Update database/3_top_brands_by_category.json
  const topByCategoryPath = path.join(DB_DIR, '3_top_brands_by_category.json');
  let topByCategory = {};
  if (fs.existsSync(topByCategoryPath)) {
    topByCategory = JSON.parse(fs.readFileSync(topByCategoryPath, 'utf8'));
  }

  // Load list of top brands
  const topBrandsPath = path.join(DB_DIR, 'top_brands.json');
  let topBrandsList = [];
  if (fs.existsSync(topBrandsPath)) {
    topBrandsList = JSON.parse(fs.readFileSync(topBrandsPath, 'utf8'));
  }

  // Update top brands list per category, prioritising items in topBrandsList
  const newTopByCategory = {};
  Object.keys(newCategorized).forEach(cat => {
    if (cat === 'Other') return;
    
    const allBrandsInCat = newCategorized[cat];
    const preferred = allBrandsInCat.filter(b => topBrandsList.includes(b));
    const nonPreferred = allBrandsInCat.filter(b => !topBrandsList.includes(b));
    const merged = [...preferred, ...nonPreferred].slice(0, 10);
    
    merged.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    newTopByCategory[cat] = merged;
  });

  fs.writeFileSync(topByCategoryPath, JSON.stringify(newTopByCategory, null, 2), 'utf8');
  console.log(`Updated 3_top_brands_by_category.json`);

  // 5. Recompute database/4_brands_statistics.json
  const statsPath = path.join(DB_DIR, '4_brands_statistics.json');
  
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
  console.log(`Generated 4_brands_statistics.json`);

  // 6. Generate database/5_complete_brand_database.json
  const completeDbPath = path.join(DB_DIR, '5_complete_brand_database.json');
  
  const familiesPath = path.join(DB_DIR, '2_brand_families.json');
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
  console.log(`Generated 5_complete_brand_database.json`);

  // 7. Update database/6_category_summary.json statistics block
  const categorySummaryPath = path.join(DB_DIR, '6_category_summary.json');
  if (fs.existsSync(categorySummaryPath)) {
    const summary = JSON.parse(fs.readFileSync(categorySummaryPath, 'utf8'));
    if (summary.statistics) {
      summary.statistics.total_brands = icons.length;
      summary.statistics.total_categories = curatedCategories.length;
      summary.statistics.average_brands_per_category = Math.round(icons.length / curatedCategories.length);
      fs.writeFileSync(categorySummaryPath, JSON.stringify(summary, null, 2), 'utf8');
      console.log(`Updated statistics in 6_category_summary.json`);
    }
  }

  console.log('✅ All database files successfully synchronized!');
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
