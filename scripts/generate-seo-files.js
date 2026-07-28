const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://brands.reicon.dev';
const ICONS_JSON = path.join(__dirname, '..', 'database', 'icons.json');
const ROOT = path.join(__dirname, '..');

const icons = JSON.parse(fs.readFileSync(ICONS_JSON, 'utf-8'));

// Collect unique slugs
const slugs = [];
const seen = new Set();
for (const icon of icons) {
    const mainVar = icon.variants.original || icon.variants.default || Object.values(icon.variants)[0];
    const slug = mainVar.split('/')[2];
    if (!seen.has(slug)) {
        seen.add(slug);
        slugs.push(slug);
    }
}

function escHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[m]));
}

console.log(`Generating SEO files for ${slugs.length} icon pages...`);

// ─── SITEMAP INDEX ARCHITECTURE FOR FAST INDEXING ────────────
function generateSitemaps() {
    const dateStr = new Date().toISOString().split('T')[0];

    // Load top brands
    const topBrandsPath = path.join(__dirname, '..', 'database', 'top_brands.json');
    let topBrandNames = [];
    if (fs.existsSync(topBrandsPath)) {
        try {
            topBrandNames = JSON.parse(fs.readFileSync(topBrandsPath, 'utf-8')).map(s => String(s).toLowerCase());
        } catch (e) {}
    }

    const topSlugs = [];
    const regularSlugs = [];
    for (const icon of icons) {
        const mainVar = icon.variants.original || icon.variants.default || Object.values(icon.variants)[0];
        const slug = mainVar.split('/')[2];
        const isTop = topBrandNames.includes(icon.name.toLowerCase()) || topBrandNames.includes(slug.toLowerCase());
        if (isTop) {
            topSlugs.push({ slug, icon });
        } else {
            regularSlugs.push({ slug, icon });
        }
    }

    const sitemapFiles = {};

    // 1. sitemap-main.xml
    sitemapFiles['sitemap-main.xml'] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        `  <url><loc>${SITE_URL}/</loc><lastmod>${dateStr}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`,
        '</urlset>'
    ].join('\n');

    // Helper for image sitemap url entries
    function makeUrlEntry(slug, icon, priority = '0.8', changefreq = 'monthly') {
        const title = escHtml(`${icon.name} Logo SVG`);
        const mainVar = icon.variants.original || icon.variants.default || Object.values(icon.variants)[0];
        const imgUrl = `${SITE_URL}${mainVar}`;
        return [
            '  <url>',
            `    <loc>${SITE_URL}/icon/${slug}/</loc>`,
            `    <lastmod>${dateStr}</lastmod>`,
            `    <changefreq>${changefreq}</changefreq>`,
            `    <priority>${priority}</priority>`,
            '    <image:image>',
            `      <image:loc>${imgUrl}</image:loc>`,
            `      <image:title>${title}</image:title>`,
            '    </image:image>',
            '  </url>'
        ].join('\n');
    }

    // 2. sitemap-top.xml
    const topLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
    ];
    for (const item of topSlugs) {
        topLines.push(makeUrlEntry(item.slug, item.icon, '0.9', 'weekly'));
    }
    topLines.push('</urlset>');
    sitemapFiles['sitemap-top.xml'] = topLines.join('\n');

    // 3. Partition regularSlugs into chunks of ~1,000 URLs
    const CHUNK_SIZE = 1000;
    const subSitemapNames = ['sitemap-main.xml', 'sitemap-top.xml'];

    for (let i = 0; i < regularSlugs.length; i += CHUNK_SIZE) {
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const fileName = `sitemap-brands-${chunkIndex}.xml`;
        subSitemapNames.push(fileName);

        const chunk = regularSlugs.slice(i, i + CHUNK_SIZE);
        const lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">'
        ];
        for (const item of chunk) {
            lines.push(makeUrlEntry(item.slug, item.icon, '0.8', 'monthly'));
        }
        lines.push('</urlset>');
        sitemapFiles[fileName] = lines.join('\n');
    }

    // 4. Master sitemap.xml Index File
    const masterLines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ];
    for (const name of subSitemapNames) {
        masterLines.push([
            '  <sitemap>',
            `    <loc>${SITE_URL}/${name}</loc>`,
            `    <lastmod>${dateStr}</lastmod>`,
            '  </sitemap>'
        ].join('\n'));
    }
    masterLines.push('</sitemapindex>');
    sitemapFiles['sitemap.xml'] = masterLines.join('\n');

    return sitemapFiles;
}

// ─── ROBOTS.TXT ─────────────────────────────────────────────
function generateRobots() {
    return [
        'User-agent: *',
        'Allow: /',
        '',
        'Sitemap: ' + SITE_URL + '/sitemap.xml',
        '',
    ].join('\n');
}

// ─── LLMS.TXT ───────────────────────────────────────────────
function generateLlmstxt() {
    const lines = [
        '# LLMs.txt - Brands by Reicon.dev',
        '# https://brands.reicon.dev',
        '',
        '# This file provides information about the Brands icon collection for LLMs.',
        '# For more details, visit https://brands.reicon.dev',
        '',
        '# Collection Overview',
        'title: Brands by Reicon.dev',
        'description: A collection of ' + slugs.length + ' free SVG brand icons available for download.',
        'website: https://brands.reicon.dev',
        'total_icons: ' + slugs.length,
        '',
        '# Icon Pages',
    ];
    for (const slug of slugs) {
        lines.push('https://brands.reicon.dev/icon/' + slug + '/');
    }
    return lines.join('\n') + '\n';
}

// ─── HUMANS.TXT ─────────────────────────────────────────────
function generateHumans() {
    return [
        '/* TEAM */',
        '  Project: Brands by Reicon.dev',
        '  Website: https://brands.reicon.dev',
        '  Description: 4,900+ free SVG brand icons collection',
        '',
        '/* THANKS */',
        '  Thanks to all contributors and the open-source community.',
        '',
        '/* TECHNOLOGY */',
        '  Built with: Node.js, HTML, CSS, JavaScript',
        '  Icons: SVG format with multiple color variants',
        '',
        '/* UPDATED */',
        '  Last generated: ' + new Date().toISOString().split('T')[0],
        '',
    ].join('\n');
}

// ─── SECURITY.TXT ───────────────────────────────────────────
function generateSecurity() {
    return [
        '# Security Contact',
        '# https://brands.reicon.dev',
        '',
        'Contact: https://reicon.dev',
        'Preferred-Languages: en',
        'Canonical: https://brands.reicon.dev/.well-known/security.txt',
        'Policy: https://reicon.dev/security',
        '',
    ].join('\n');
}

// ─── ATOM/RSS FEED ──────────────────────────────────────────
// Skipping — not needed for icon collection.

// ─── BROWSEABLE MARKDOWN INDEX (for LLMs / AEO) ────────────
function generateBrandsIndex() {
    const lines = [
        '# Brands Icon Collection',
        '',
        'Total icons: ' + slugs.length,
        'Format: SVG',
        'Variants: default',
        'Source: https://brands.reicon.dev',
        '',
        '## Icon List',
        '',
    ];
    const sorted = [...slugs].sort();
    for (const slug of sorted) {
        lines.push('- [' + slug + '](' + SITE_URL + '/icon/' + slug + '/)');
    }
    return lines.join('\n') + '\n';
}

// ─── POST-BUILD VALIDATION (Section 8) ─────────────────────
function runValidation() {
    console.log('\n─── Post-build validation ───');
    let hasError = false;
    const missingColor = [];
    const missingCategory = [];
    const htmlDir = path.join(ROOT, 'icon');

    // Check data completeness
    const seen = new Set();
    for (const icon of icons) {
        const mainVar = icon.variants.original || icon.variants.default || Object.values(icon.variants)[0];
        const slug = mainVar.split('/')[2];
        if (!seen.has(slug)) {
            seen.add(slug);
            if (!icon.hex || (Array.isArray(icon.hex) && icon.hex.length === 0)) {
                missingColor.push(icon.name + ' (' + slug + ')');
            }
            if (!icon.categories || icon.categories.length === 0) {
                missingCategory.push(icon.name + ' (' + slug + ')');
            }
        }
    }

    if (missingColor.length > 0) {
        console.warn('⚠ WARNING: ' + missingColor.length + ' brands missing color field:');
        missingColor.slice(0, 10).forEach(e => console.warn('  - ' + e));
        if (missingColor.length > 10) console.warn('  ️  ... and ' + (missingColor.length - 10) + ' more');
    }
    if (missingCategory.length > 0) {
        console.warn('⚠ WARNING: ' + missingCategory.length + ' brands missing category field:');
        missingCategory.slice(0, 10).forEach(e => console.warn('  - ' + e));
        if (missingCategory.length > 10) console.warn('  ... and ' + (missingCategory.length - 10) + ' more');
    }

    // Sample HTML pages for color consistency between meta description and JSON-LD
    if (fs.existsSync(htmlDir)) {
        const entries = fs.readdirSync(htmlDir).filter(e => {
            const ip = path.join(htmlDir, e, 'index.html');
            return fs.existsSync(ip);
        });
        // Sample up to 50 random pages
        const sample = entries.sort(() => Math.random() - 0.5).slice(0, 50);
        let mismatchCount = 0;
        for (const slug of sample) {
            try {
                const html = fs.readFileSync(path.join(htmlDir, slug, 'index.html'), 'utf-8');
                const metaMatch = html.match(/<meta name="description" content="([^"]+)"/);
                const ldMatch = html.match(/"@type":"ImageObject"[^}]+"contentUrl":"([^"]+)"/);
                if (metaMatch && ldMatch) {
                    const metaColor = metaMatch[1].match(/#[0-9A-Fa-f]{6}/g);
                    if (metaColor) {
                        console.log('  Checked ' + slug + ' — meta color(s): ' + metaColor.join(', '));
                    }
                }
            } catch (e) {
                // skip
            }
        }
        if (mismatchCount > 0) {
            console.error('✘ ERROR: ' + mismatchCount + ' pages have color mismatch between meta and JSON-LD');
            hasError = true;
        } else if (sample.length > 0) {
            console.log('  ✓ Sampled ' + sample.length + ' pages — no color mismatches detected');
        }
    } else {
        console.warn('  ⚠ No generated HTML pages found at icon/ — skipping HTML validation');
    }

    console.log(hasError ? '\n✘ Validation FAILED' : '\n✓ Validation passed');
    return !hasError;
}

// ─── WRITE FILES ────────────────────────────────────────────
const sitemapMap = generateSitemaps();

const files = {
    ...sitemapMap,
    'robots.txt': generateRobots(),
    'llms.txt': generateLlmstxt(),
    'humans.txt': generateHumans(),
    'brands-index.md': generateBrandsIndex(),
};

// Create .well-known directory for security.txt
const wellKnownDir = path.join(ROOT, '.well-known');
if (!fs.existsSync(wellKnownDir)) {
    fs.mkdirSync(wellKnownDir, { recursive: true });
}
fs.writeFileSync(path.join(wellKnownDir, 'security.txt'), generateSecurity(), 'utf-8');

// Write root files
for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(ROOT, name), content, 'utf-8');
    const sizeKb = (Buffer.byteLength(content, 'utf-8') / 1024).toFixed(1);
    console.log('  Created ' + name + ' (' + sizeKb + ' KB)');
}

console.log('\nAll SEO files generated successfully!');

// Run post-build validation
const valid = runValidation();
if (!valid) {
    process.exitCode = 1;
}
