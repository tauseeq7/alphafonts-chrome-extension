#!/usr/bin/env node
/*
 * Builds the store packages (.zip files you can upload to a browser add-on store).
 *
 *   node tools/package.js            build everything
 *   node tools/package.js chrome     Chrome Web Store and Opera Add-ons (the extension as it is)
 *   node tools/package.js firefox    Firefox Add-ons (addons.mozilla.org)
 *
 * Needs only Node.js (version 18 or newer). No npm install. Works on Windows, macOS and Linux.
 *
 * Chrome and Opera (both Chromium browsers) take the extension exactly as it is in this folder.
 * Firefox reads a slightly different manifest, so for Firefox the Chrome manifest.json is turned into a
 * Firefox one:
 *   - Firefox runs the background code as a page, so "background.scripts" replaces
 *     Chrome's "background.service_worker".
 *   - "browser_specific_settings.gecko" gives the add-on its ID and says it collects no data.
 * Everything under src/ is copied unchanged. The Chrome files are never modified.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

// ---------------------------------------------------------------------
// 1. The Firefox manifest
// ---------------------------------------------------------------------

const GECKO_ID = 'alphafonts-font-inspector@alphafonts.com';

function firefoxManifest(chrome) {
  const result = JSON.parse(JSON.stringify(chrome));
  // The same files Chrome loads with importScripts, in the same order, then the background code.
  result.background = {
    scripts: ['src/shared/constants.js', 'src/shared/utils.js', 'src/shared/settings.js', chrome.background.service_worker]
  };
  result.browser_specific_settings = {
    gecko: {
      id: GECKO_ID,
      strict_min_version: '142.0',
      // Mozilla asks every new add-on to state what data it collects. This one collects none.
      data_collection_permissions: { required: ['none'] }
    }
  };
  return result;
}

// ---------------------------------------------------------------------
// 2. Files to include
// ---------------------------------------------------------------------

function listFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/')); // always forward slashes (AMO requires it)
  }
  return out;
}

function collectFiles(target) {
  const manifestData =
    target === 'firefox'
      ? Buffer.from(JSON.stringify(firefoxManifest(manifest), null, 2) + '\n')
      : fs.readFileSync(path.join(root, 'manifest.json'));
  return [
    { name: 'manifest.json', data: manifestData },
    { name: 'LICENSE', data: fs.readFileSync(path.join(root, 'LICENSE')) },
    ...listFiles(path.join(root, 'src')).map((file) => ({ name: 'src/' + file, data: fs.readFileSync(path.join(root, 'src', file)) }))
  ];
}

// ---------------------------------------------------------------------
// 3. A tiny zip writer (so no extra tools are needed)
// ---------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
  // Fixed date so the same files always give the same zip.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuffer = Buffer.from(name, 'utf8');
    const packed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    locals.push(local, nameBuffer, packed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + packed.length;
  }

  const centralSize = centrals.reduce((sum, buf) => sum + buf.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

// ---------------------------------------------------------------------
// 4. Write it
// ---------------------------------------------------------------------

function build(target) {
  const files = collectFiles(target);
  const outDir = path.join(root, 'releases');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'alphafonts-font-inspector-' + manifest.version + '-' + target + '.zip');
  fs.writeFileSync(outFile, buildZip(files));
  console.log('Created ' + path.relative(root, outFile) + ' (' + files.length + ' files, version ' + manifest.version + ')');
  return outFile;
}

module.exports = { build };

if (require.main === module) {
  const target = process.argv[2] || 'all';
  const targets = target === 'all' ? ['chrome', 'firefox'] : [target];
  for (const name of targets) {
    if (!['chrome', 'firefox'].includes(name)) {
      console.error('Unknown target "' + name + '". Use: chrome, firefox or all.');
      process.exit(1);
    }
    build(name);
  }
}
