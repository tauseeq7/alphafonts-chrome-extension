// Unit tests for the pure helpers. Run with:  node --test tests/utils.test.js
// No npm packages needed (uses Node's built-in test runner).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// The extension files are plain browser scripts, so load them into a fake global.
function load(...files) {
  const sandbox = { URL, CSS: { escape: (s) => s } };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
  }
  return sandbox.AlphaFonts;
}

const { utils } = load('src/shared/constants.js', 'src/shared/utils.js');

test('parseColor understands rgb, rgba, space syntax and hex', () => {
  assert.deepStrictEqual({ ...utils.parseColor('rgb(34, 34, 34)') }, { r: 34, g: 34, b: 34, a: 1 });
  assert.deepStrictEqual({ ...utils.parseColor('rgba(34, 34, 34, 0.8)') }, { r: 34, g: 34, b: 34, a: 0.8 });
  assert.deepStrictEqual({ ...utils.parseColor('rgb(0 128 255 / 50%)') }, { r: 0, g: 128, b: 255, a: 0.5 });
  assert.deepStrictEqual({ ...utils.parseColor('#0af') }, { r: 0, g: 170, b: 255, a: 1 });
  assert.strictEqual(utils.parseColor('transparent').a, 0);
  assert.strictEqual(utils.parseColor('oklch(0.5 0.2 200)'), null);
  assert.strictEqual(utils.parseColor(undefined), null);
});

test('formatColor converts opaque colors and never drops alpha', () => {
  assert.strictEqual(utils.formatColor('rgb(34, 34, 34)', 'hex'), '#222222');
  assert.strictEqual(utils.formatColor('rgb(34, 34, 34)', 'rgb'), 'rgb(34, 34, 34)');
  assert.strictEqual(utils.formatColor('rgba(34, 34, 34, 0.8)', 'hex'), 'rgba(34, 34, 34, 0.8)');
  assert.strictEqual(utils.formatColor('rgba(34, 34, 34, 0.8)', 'rgb'), 'rgba(34, 34, 34, 0.8)');
  assert.strictEqual(utils.formatColor('rgba(0, 0, 0, 0)', 'hex'), 'rgba(0, 0, 0, 0)');
  assert.strictEqual(utils.formatColor('oklch(0.5 0.2 200)', 'hex'), 'oklch(0.5 0.2 200)');
});

test('parseFontStack splits quoted and unquoted families', () => {
  assert.deepStrictEqual(Array.from(utils.parseFontStack('"Open Sans", Arial, sans-serif')), ['Open Sans', 'Arial', 'sans-serif']);
  assert.deepStrictEqual(Array.from(utils.parseFontStack("'A, B', serif")), ['A, B', 'serif']);
  assert.deepStrictEqual(Array.from(utils.parseFontStack('')), []);
});

test('isRestrictedUrl blocks browser pages and the Web Store only', () => {
  assert.strictEqual(utils.isRestrictedUrl('chrome://extensions'), true);
  assert.strictEqual(utils.isRestrictedUrl('about:blank'), true);
  assert.strictEqual(utils.isRestrictedUrl('chrome-extension://abc/popup.html'), true);
  assert.strictEqual(utils.isRestrictedUrl('https://chromewebstore.google.com/detail/x'), true);
  assert.strictEqual(utils.isRestrictedUrl('https://chrome.google.com/webstore/detail/x'), true);
  assert.strictEqual(utils.isRestrictedUrl('https://example.com/'), false);
  assert.strictEqual(utils.isRestrictedUrl('http://localhost:3000/'), false);
  assert.strictEqual(utils.isRestrictedUrl(undefined), false);
});

test('buildCSS and buildInfo only include meaningful values', () => {
  const { typography } = load('src/shared/constants.js', 'src/shared/utils.js', 'src/content/typography.js');
  const data = {
    fontFamily: '"Inter", Arial, sans-serif', fontSize: '18px', fontWeight: '600', fontStyle: 'normal',
    fontVariant: 'normal', fontStretch: '100%', lineHeight: '28px', letterSpacing: '0.2px', wordSpacing: '0px',
    textAlign: 'left', textTransform: 'none', textDecorationLine: 'none', textDecorationStyle: 'solid',
    textDecorationThickness: 'auto', color: 'rgb(34, 34, 34)', opacity: '1', renderedFont: 'Inter'
  };
  assert.strictEqual(
    typography.buildCSS(data),
    [
      'font-family: "Inter", Arial, sans-serif;', 'font-size: 18px;', 'font-weight: 600;', 'font-style: normal;',
      'line-height: 28px;', 'letter-spacing: 0.2px;', 'color: rgb(34, 34, 34);', 'text-align: left;', 'text-transform: none;'
    ].join('\n')
  );
  const css = typography.buildCSS({ ...data, textDecorationLine: 'underline', color: null, fontFamily: null });
  assert.ok(css.includes('text-decoration-line: underline;'));
  assert.ok(!css.includes('color:') && !css.includes('font-family'));

  const info = typography.buildInfo(data, { tag: 'H1', selector: '.hero-title' });
  assert.ok(info.startsWith('AlphaFonts Font Inspector\n\nFont Family: "Inter", Arial, sans-serif'));
  assert.ok(info.includes('Color: rgb(34, 34, 34) (#222222)'));
  assert.ok(info.includes('Likely Rendered Font: Inter'));
  assert.ok(info.includes('Selector: .hero-title'));
  const alphaInfo = typography.buildInfo({ ...data, color: 'rgba(34, 34, 34, 0.8)' });
  assert.ok(alphaInfo.includes('Color: rgba(34, 34, 34, 0.8)\n'));
});

test('buildCSS and buildInfo respect the chosen properties', () => {
  const { typography } = load('src/shared/constants.js', 'src/shared/utils.js', 'src/content/typography.js');
  const data = {
    fontFamily: 'Inter, sans-serif', fontSize: '18px', fontWeight: '600', fontStyle: 'normal', fontVariant: 'normal',
    fontStretch: '100%', lineHeight: '28px', letterSpacing: '0.2px', wordSpacing: '0px', textAlign: 'left',
    textTransform: 'none', textDecorationLine: 'none', textDecorationStyle: 'solid', textDecorationThickness: 'auto',
    color: 'rgb(0, 0, 0)', opacity: '1'
  };
  const only = (...keys) => Object.fromEntries(
    ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontColor', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textAlign', 'textTransform', 'textDecoration']
      .map((key) => [key, keys.includes(key)])
  );
  const css = typography.buildCSS(data, only('fontSize', 'fontColor'));
  assert.strictEqual(css, 'font-size: 18px;\ncolor: rgb(0, 0, 0);');
  const info = typography.buildInfo(data, null, only('fontSize'));
  assert.ok(info.includes('Font Size: 18px') && !info.includes('Color:') && !info.includes('Font Family'));
  assert.strictEqual(typography.wrapRule('font-size: 18px;', '.hero'), '.hero {\n  font-size: 18px;\n}');
  assert.strictEqual(typography.wrapRule('', '.hero'), '');
});

test('settings are always complete and valid, and old theme-only data still works', () => {
  const { settings } = load('src/shared/constants.js', 'src/shared/settings.js');
  const fresh = settings.normalize(undefined);
  assert.strictEqual(fresh.theme, 'dark');
  assert.strictEqual(fresh.colorFormat, 'hex');
  assert.strictEqual(fresh.showAllOnHover, true);
  assert.strictEqual(fresh.contextMenu, true);
  assert.strictEqual(Object.keys(fresh.properties).length, settings.PROPERTIES.length);
  assert.ok(Object.values(fresh.properties).every((v) => v === true));
  assert.strictEqual(settings.normalize(undefined, 'light').theme, 'light'); // version 2.0 data
  const custom = settings.normalize({ theme: 'nope', colorFormat: 'rgb', showAllOnHover: false, contextMenu: false, properties: { fontSize: false, bogus: false } });
  assert.strictEqual(custom.theme, 'dark');
  assert.strictEqual(custom.colorFormat, 'rgb');
  assert.strictEqual(custom.showAllOnHover, false);
  assert.strictEqual(custom.contextMenu, false);
  assert.strictEqual(custom.properties.fontSize, false);
  assert.strictEqual(custom.properties.fontFamily, true);
  assert.strictEqual('bogus' in custom.properties, false);
});

test('labels show only noteworthy values, with short names', () => {
  const AF = load('src/shared/constants.js', 'src/shared/utils.js', 'src/shared/settings.js', 'src/content/typography.js', 'src/content/labels.js');
  const none = Object.fromEntries(AF.settings.PROPERTIES.map((p) => [p.key, false]));
  const on = (...keys) => ({ ...none, ...Object.fromEntries(keys.map((k) => [k, true])) });
  const data = {
    fontFamily: '"Open Sans", Arial, sans-serif', fontSize: '18px', fontWeight: '700', fontStyle: 'normal',
    lineHeight: '28px', letterSpacing: 'normal', wordSpacing: '0px', textAlign: 'start', textTransform: 'none',
    textDecorationLine: 'none', color: 'rgb(34, 34, 34)'
  };
  const text = (enabled, fmt = 'hex', d = data) => Array.from(AF.labelParts(d, enabled, fmt)).map((p) => p.text);
  assert.deepStrictEqual(text(on('fontFamily', 'fontSize', 'fontWeight')), ['Open Sans', '18px', '700']);
  assert.deepStrictEqual(text(on('fontColor')), ['#222222']);
  assert.deepStrictEqual(text(on('fontColor'), 'rgb'), ['rgb(34, 34, 34)']);
  assert.deepStrictEqual(text(on('lineHeight')), ['lh 28px']);
  // browser defaults are left out
  assert.deepStrictEqual(text(on('fontStyle', 'letterSpacing', 'wordSpacing', 'textAlign', 'textTransform', 'textDecoration')), []);
  const fancy = { ...data, fontStyle: 'italic', letterSpacing: '0.5px', textAlign: 'center', textTransform: 'uppercase', textDecorationLine: 'underline' };
  assert.deepStrictEqual(
    text(on('fontStyle', 'letterSpacing', 'textAlign', 'textTransform', 'textDecoration'), 'hex', fancy),
    ['italic', 'ls 0.5px', 'center', 'uppercase', 'underline']
  );
  // long family names are shortened; transparent colors keep their alpha
  assert.ok(text(on('fontFamily'), 'hex', { ...data, fontFamily: 'A Really Very Long Font Family Name' })[0].endsWith('…'));
  assert.deepStrictEqual(text(on('fontColor'), 'hex', { ...data, color: 'rgba(0, 0, 0, 0.5)' }), ['rgba(0, 0, 0, 0.5)']);
});

test('label settings: separate from panel settings, short by default', () => {
  const { settings } = load('src/shared/constants.js', 'src/shared/settings.js');
  const fresh = settings.normalize(undefined);
  const labelOn = Object.keys(fresh.labelProperties).filter((k) => fresh.labelProperties[k]);
  assert.deepStrictEqual(labelOn.sort(), ['fontFamily', 'fontSize', 'fontWeight']);
  assert.ok(Object.values(fresh.properties).every(Boolean));
  const custom = settings.normalize({ labelProperties: { fontColor: true, fontSize: false } });
  assert.strictEqual(custom.labelProperties.fontColor, true);
  assert.strictEqual(custom.labelProperties.fontSize, false);
  assert.strictEqual(custom.labelProperties.fontWeight, true);
});

test('contrast math matches WCAG reference values', () => {
  const { utils } = load('src/shared/constants.js', 'src/shared/utils.js');
  const c = (hex) => utils.parseColor(hex);
  const round = (n) => Math.round(n * 100) / 100;
  assert.strictEqual(round(utils.contrastRatio(c('#000000'), c('#ffffff'))), 21);
  assert.strictEqual(round(utils.contrastRatio(c('#ffffff'), c('#ffffff'))), 1);
  assert.strictEqual(round(utils.contrastRatio(c('#767676'), c('#ffffff'))), 4.54); // the classic "just passes AA" grey
  assert.strictEqual(round(utils.contrastRatio(c('#777777'), c('#ffffff'))), 4.48); // one step lighter fails
  const passAA = utils.contrastInfo(c('#767676'), c('#ffffff'), 16, '400');
  assert.ok(passAA.aa && !passAA.aaa && !passAA.large && passAA.suggestion === null);
  const fail = utils.contrastInfo(c('#aaaaaa'), c('#ffffff'), 16, '400');
  assert.ok(!fail.aa && fail.suggestion);
  assert.ok(utils.contrastRatio(c(fail.suggestion), c('#ffffff')) >= 4.5, 'suggestion really passes AA');
  // large text has easier targets
  assert.ok(utils.contrastInfo(c('#949494'), c('#ffffff'), 32, '700').aa);
  assert.ok(!utils.contrastInfo(c('#949494'), c('#ffffff'), 14, '400').aa);
  assert.ok(utils.contrastInfo(c('#000'), c('#fff'), 14, '400').aaa);
  // semi-transparent text is mixed with the background first (50% black on white = #808080, 3.95:1)
  assert.strictEqual(utils.contrastInfo({ r: 0, g: 0, b: 0, a: 0.5 }, c('#ffffff'), 16, '400').ratio, 3.95);
  // dark backgrounds suggest lighter text
  const onDark = utils.contrastInfo(c('#444444'), c('#111111'), 16, '400');
  assert.ok(!onDark.aa && utils.contrastRatio(c(onDark.suggestion), c('#111111')) >= 4.5);
  assert.deepStrictEqual({ ...utils.blend({ r: 255, g: 0, b: 0, a: 0.5 }, { r: 0, g: 0, b: 255, a: 1 }) }, { r: 128, g: 0, b: 128, a: 1 });
});

test('isFirefox detects the browser from the user agent', () => {
  const make = (userAgent) => {
    const sandbox = { URL, navigator: { userAgent } };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    for (const file of ['src/shared/constants.js', 'src/shared/utils.js']) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
    }
    return sandbox.AlphaFonts.utils.isFirefox();
  };
  assert.strictEqual(make('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0'), true);
  assert.strictEqual(make('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/147.0 Safari/537.36'), false);
});

test('the Firefox package keeps every file the Chrome extension needs', () => {
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [path.join(__dirname, '..', 'firefox', 'package.js')], { stdio: 'pipe' });
  const version = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8')).version;
  const zip = fs.readFileSync(path.join(__dirname, '..', 'releases', 'alphafonts-font-inspector-' + version + '-firefox.zip'));
  // Read the file list from the zip's central directory (the index at the end of the file).
  const endAt = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let pos = zip.readUInt32LE(endAt + 16);
  const names = [];
  while (zip.readUInt32LE(pos) === 0x02014b50) {
    const nameLength = zip.readUInt16LE(pos + 28);
    names.push(zip.toString('utf8', pos + 46, pos + 46 + nameLength));
    pos += 46 + nameLength + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
  }
  for (const name of ['manifest.json', 'src/background/background.js', 'src/content/labels.js', 'src/popup/popup.html', 'src/options/options.html', 'src/icons/icon128.png']) {
    assert.ok(names.includes(name), name + ' is in the zip');
  }
  assert.ok(names.every((name) => !name.includes('\\')), 'no backslashes in zip paths (Windows zips are rejected by AMO)');
  assert.ok(names.every((name) => !name.startsWith('tests/') && !name.startsWith('screenshots/')), 'tests and screenshots are left out');
  assert.ok(names.length >= 20);
});
