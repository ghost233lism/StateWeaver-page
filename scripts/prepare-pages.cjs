const fs = require('node:fs');
const path = require('node:path');
const { hosted } = require('../dist/media-routing.js');
const release = require('./exhibit-media.json');

const root = path.resolve(__dirname, '..', 'dist');
const [directory] = process.argv.slice(2);
if (!directory) throw new Error('Supply a new output directory for the Pages artifact.');
const output = path.resolve(directory);
if (output === root || output.startsWith(root + path.sep)) throw new Error('Choose an output outside dist.');
const scope = process.env.MEDIA_SCOPE || release.scope;
if (!['films', 'exhibit'].includes(scope)) throw new Error('MEDIA_SCOPE must be films or exhibit.');
let base = '';
const mediaRoot = process.env.MEDIA_BASE_URL || release.base;
if (mediaRoot) {
  const value = new URL(mediaRoot);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(value.hostname);
  if ((value.protocol !== 'https:' && !(loopback && value.protocol === 'http:')) ||
      value.username || value.password || value.search || value.hash) {
    throw new Error('Set MEDIA_BASE_URL to the HTTPS media root, without credentials, a query or fragment.');
  }
  base = value.href.replace(/\/?$/, '/');
}
fs.mkdirSync(output);
let bytes = 0, externalFiles = 0, externalBytes = 0;
function copy(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const src = path.join(directory, entry.name);
    const key = path.relative(root, src).split(path.sep).join('/');
    if (key === 'studio/archive-local' || /^studio\/archive-data\/[^/]+\.json$/.test(key) || key === 'media/films/hero.mp4') continue;
    if (entry.isDirectory()) { copy(src); continue; }
    if (!entry.isFile()) throw new Error('Unexpected build entry: ' + key);
    const size = fs.statSync(src).size;
    if (base && hosted(key, scope)) { externalFiles++; externalBytes += size; continue; }
    const target = path.join(output, key);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (key === 'index.html' || key === 'studio/index.html') {
      const html = fs.readFileSync(src, 'utf8');
      const marker = 'data-media-base="" data-media-scope="exhibit"';
      if (!html.includes(marker)) throw new Error('Missing media settings in ' + key);
      fs.writeFileSync(target, html.replace(marker, () =>
        'data-media-base="' + base.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '" data-media-scope="' + scope + '"'));
    } else fs.copyFileSync(src, target);
    bytes += fs.statSync(target).size;
  }
}
copy(root);
console.log('Pages:', bytes, 'bytes. External media:', externalFiles, 'files,', externalBytes, 'bytes.');
