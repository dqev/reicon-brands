<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://brands.reicon.dev/favicon/og-image.png">
    <img src="https://brands.reicon.dev/favicon/og-image.png" width="100%" alt="Brands by Reicon.dev" style="max-width:800px;border-radius:12px">
  </picture>
</p>

<h1 align="center">Brands by Reicon.dev</h1>

<p align="center">
  <strong>4,900+ free SVG brand icons</strong> — open-source logo icons with multiple color variants.<br>
  Default · Brand · Black · White — every icon, every variant, ready to download.
</p>

<p align="center">
  <a href="https://brands.reicon.dev">brands.reicon.dev</a> &nbsp;|&nbsp;
  <a href="https://reicon.dev">Reicon.dev</a>
</p>

---

## Features

- **4,909 brand icons** — from Adobe to Zyte, Google to GitHub
- **4 variants each** — `default`, `brand` (original color), `black`, `white`
- **Color picker** — recolor any icon with a custom hex color
- **Size presets** — download at 24, 64, 128, 256, or 512px
- **Multiple formats** — SVG, PNG, WebP export
- **Download all** — batch download all variants at once
- **Dark/light mode** — automatic theme support
- **Fully SEO-optimized** — each icon has its own standalone HTML page with JSON-LD schema, breadcrumbs, OG tags, and sitemap

## Project Structure

```
.
├── index.html              # Main gallery (search, categories, grid)
├── icon/                   # Standalone icon pages (4,909 pages)
│   ├── ace/
│   │   └── index.html
│   ├── google/
│   │   └── index.html
│   └── ...
├── icons/                  # SVG source files (organized by slug)
│   ├── ace/
│   │   ├── default.svg
│   │   ├── black.svg
│   │   ├── white.svg
│   │   └── ...
│   └── ...
├── database/               # JSON databases for icons, categories, stats
├── favicon/                # Favicon files + OG image
├── scripts/                # Generator tools
│   ├── generate-icon-pages.js
│   └── generate-seo-files.js
├── sitemap.xml             # XML sitemap (4,910 URLs)
├── robots.txt
├── llms.txt                # LLM-friendly index
├── brands-index.md         # Markdown brand index
├── humans.txt
└── .well-known/
    └── security.txt
```

## Usage

### Browse icons

Open [`index.html`](index.html) in a browser (use a local server due to CORS):

```bash
python3 -m http.server 8000
# or
npx serve .
```

### Generate icon pages

```bash
node scripts/generate-icon-pages.js
```

### Generate SEO files

```bash
node scripts/generate-seo-files.js
```

## SEO

Every icon page includes:

| Feature | Description |
|---------|-------------|
| Canonical URL | `https://brands.reicon.dev/icon/{slug}/` |
| JSON-LD Schema | BreadcrumbList + ImageObject |
| Open Graph | Title, description, image (1200×630) |
| Twitter Cards | `summary_large_image` |
| Meta description | Unique per brand |
| Semantic HTML | `<h1>`, `<nav>`, `<article>` landmarks |
| Sitemap | All 4,910 URLs with priorities |
| robots.txt | Allow all, sitemap reference |
| llms.txt | Full index for AI crawlers |

## License

The icons in this collection are sourced from their respective brands. Each icon is an SVG representation of the brand's logo. All trademarks, logos, and brand names are the property of their respective owners.

The code and build tools are open source.

---

<p align="center">
  <a href="https://brands.reicon.dev">brands.reicon.dev</a> &nbsp;·&nbsp;
  Powered by <a href="https://reicon.dev">Reicon.dev</a>
</p>
