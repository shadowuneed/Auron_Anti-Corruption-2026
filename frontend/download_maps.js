const fs = require('fs');
const https = require('https');
const path = require('path');

const publicDataDir = path.join(__dirname, 'public', 'data');
if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true });
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${url} -> ${dest}`);
        const req = https.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                return download(res.headers.location, dest).then(resolve).catch(reject);
            }
            if (res.statusCode !== 200) {
                reject(new Error(`Failed with status ${res.statusCode}`));
                return;
            }
            const file = fs.createWriteStream(dest);
            res.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        });
        req.on('error', reject);
    });
}

async function run() {
    await download('https://unpkg.com/world-atlas@2.0.2/countries-110m.json', path.join(publicDataDir, 'world-110m.json'));
    await download('https://raw.githubusercontent.com/yeyusiz/kazakhstan-geojson/master/kazakhstan.geojson', path.join(publicDataDir, 'kz-regions.json'));
    console.log('Maps downloaded successfully!');
}

run().catch(console.error);
