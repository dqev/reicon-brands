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
    const slug = icon.variants.default.split('/')[2];
    if (!seen.has(slug)) {
        seen.add(slug);
        slugs.push(slug);
    }
}

console.log(`Generating SEO files for ${slugs.length} icon pages...`);

// ─── SITEMAP ────────────────────────────────────────────────
function generateSitemap() {
    const lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '  <url><loc>' + SITE_URL + '/</loc><priority>1.0</priority><changefreq>weekly</changefreq></url>',
    ];
    for (const slug of slugs) {
        lines.push('  <url><loc>' + SITE_URL + '/icon/' + slug + '/</loc><priority>0.8</priority><changefreq>monthly</changefreq></url>');
    }
    lines.push('</urlset>');
    return lines.join('\n') + '\n';
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
        'description: A collection of ' + slugs.length + ' free SVG brand icons available in default, brand, black, and white variants.',
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
        'Variants: default, brand, black, white',
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

// ─── WRITE FILES ────────────────────────────────────────────
const files = {
    'sitemap.xml': generateSitemap(),
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
