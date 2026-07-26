const fs = require('fs');
const path = require('path');
const https = require('https');

const SITE_URL = 'https://brands.reicon.dev';
const HOST = 'brands.reicon.dev';
const KEY = 'reicon2026indexnowkey4915';
const KEY_FILE = `${KEY}.txt`;
const ROOT = path.join(__dirname, '..');
const ICONS_JSON = path.join(__dirname, '..', 'database', 'icons.json');

// 1. Create IndexNow Key file in root
fs.writeFileSync(path.join(ROOT, KEY_FILE), KEY, 'utf-8');
console.log(`Created IndexNow key file: /${KEY_FILE}`);

// 2. Load URLs
const icons = JSON.parse(fs.readFileSync(ICONS_JSON, 'utf-8'));
const urlList = [`${SITE_URL}/`];

const seen = new Set();
for (const icon of icons) {
    const slug = icon.variants.default.split('/')[2];
    if (!seen.has(slug)) {
        seen.add(slug);
        urlList.push(`${SITE_URL}/icon/${slug}/`);
    }
}

console.log(`Total URLs prepared for IndexNow submission: ${urlList.length}`);

// 3. Submit in batches of 10,000 (IndexNow max batch size)
function submitBatch(urls) {
    const payload = JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${SITE_URL}/${KEY_FILE}`,
        urlList: urls
    });

    const options = {
        hostname: 'api.indexnow.org',
        port: 443,
        path: '/indexnow',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        console.log(`IndexNow Submission Response Status: ${res.statusCode} ${res.statusMessage}`);
        if (res.statusCode === 200 || res.statusCode === 202) {
            console.log('✅ IndexNow submission successful! All URLs submitted for instant indexing to Bing/Yandex/Seznam.');
        } else {
            console.log(`Response code: ${res.statusCode}`);
        }
    });

    req.on('error', (e) => {
        console.error(`IndexNow submission error: ${e.message}`);
    });

    req.write(payload);
    req.end();
}

submitBatch(urlList);
