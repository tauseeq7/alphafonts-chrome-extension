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
