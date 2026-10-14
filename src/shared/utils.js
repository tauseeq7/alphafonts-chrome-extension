/*
 * Small, dependency-free helpers shared by the extension.
 * Everything here is pure (no DOM access) so it is easy to test.
 */
(function () {
  const root = globalThis;
  root.AlphaFonts = root.AlphaFonts || {};

  // ---------------------------------------------------------------------
  // Pages the extension cannot run on
  // ---------------------------------------------------------------------

  /**
   * Returns true for pages Chrome never lets extensions touch
   * (chrome://, the Web Store, about:blank, ...).
   * An unknown URL (undefined) returns false: we simply try and handle the error.
   */
  function isRestrictedUrl(url) {
    if (!url) return false;
    let parsed;
    try {
      parsed = new URL(url);
    } catch (e) {
      return true;
    }
    const allowedProtocols = ['http:', 'https:', 'file:'];
    if (!allowedProtocols.includes(parsed.protocol)) return true;
    if (parsed.hostname === 'chromewebstore.google.com') return true;
    if (parsed.hostname === 'chrome.google.com' && parsed.pathname.startsWith('/webstore')) return true;
    return false;
  }

  // ---------------------------------------------------------------------
  // Colors
  // ---------------------------------------------------------------------

  function clampByte(n) {
    return Math.max(0, Math.min(255, Math.round(n)));
  }

  function parseChannel(token) {
    token = token.trim();
    if (token.endsWith('%')) return clampByte((parseFloat(token) / 100) * 255);
    return clampByte(parseFloat(token));
  }

  function parseAlpha(token) {
    if (token === undefined || token === '') return 1;
    token = token.trim();
    const value = token.endsWith('%') ? parseFloat(token) / 100 : parseFloat(token);
    if (Number.isNaN(value)) return 1;
    return Math.max(0, Math.min(1, value));
  }

  /**
   * Parses rgb(), rgba(), #hex and "transparent".
   * Returns { r, g, b, a } or null when the format is not understood
   * (for example lab() or color-mix()).
   */
  function parseColor(input) {
    if (typeof input !== 'string') return null;
    const value = input.trim().toLowerCase();
    if (!value) return null;
    if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

    const hex = value.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
      let h = hex[1];
      if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1
      };
    }

    const fn = value.match(/^rgba?\(\s*([^)]+)\)$/);
    if (!fn) return null;
    // Supports "34, 34, 34, 0.8" and "34 34 34 / 0.8".
    const parts = fn[1].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3 || parts.length > 4) return null;
    const color = {
      r: parseChannel(parts[0]),
      g: parseChannel(parts[1]),
      b: parseChannel(parts[2]),
      a: parseAlpha(parts[3])
    };
    if ([color.r, color.g, color.b].some(Number.isNaN)) return null;
    return color;
  }

  function toHex(color) {
    const part = (n) => n.toString(16).padStart(2, '0');
    return '#' + part(color.r) + part(color.g) + part(color.b);
  }

  function formatAlpha(a) {
    return String(Math.round(a * 1000) / 1000);
  }

  /** True when the color is fully opaque, i.e. a plain HEX value is a faithful representation. */
  function isOpaque(color) {
    return !!color && color.a >= 1;
  }

  /**
   * Formats a color for display.
   *  - format "hex": #rrggbb when opaque
   *  - format "rgb": rgb(r, g, b) when opaque
   *  - Transparent colors always use rgba(...) so the alpha is never lost.
   *  - Unknown formats return the original string untouched.
   */
  function formatColor(raw, format) {
    const color = parseColor(raw);
    if (!color) return raw;
    if (!isOpaque(color)) {
      return 'rgba(' + color.r + ', ' + color.g + ', ' + color.b + ', ' + formatAlpha(color.a) + ')';
    }
    if (format === 'rgb') return 'rgb(' + color.r + ', ' + color.g + ', ' + color.b + ')';
    return toHex(color);
  }

  /** Relative luminance (0 = black, 1 = white), used to pick a readable preview backdrop. */
  function luminance(color) {
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
  }

  // ---------------------------------------------------------------------
  // Contrast (WCAG)
  // ---------------------------------------------------------------------

  /** Puts a (possibly transparent) color on top of an opaque one. */
  function blend(top, bottom) {
    const a = top.a === undefined ? 1 : top.a;
    return {
      r: Math.round(top.r * a + bottom.r * (1 - a)),
      g: Math.round(top.g * a + bottom.g * (1 - a)),
      b: Math.round(top.b * a + bottom.b * (1 - a)),
      a: 1
    };
  }

  /** WCAG contrast ratio between two opaque colors: 1 (none) to 21 (black on white). */
  function contrastRatio(a, b) {
    const l1 = luminance(a);
    const l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  function rgbToHsl(color) {
    const r = color.r / 255, g = color.g / 255, b = color.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return { h: h / 6, s, l };
  }

  function hslToRgb(h, s, l) {
    if (s === 0) {
      const v = Math.round(l * 255);
      return { r: v, g: v, b: v, a: 1 };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return {
      r: Math.round(channel(h + 1 / 3) * 255),
      g: Math.round(channel(h) * 255),
      b: Math.round(channel(h - 1 / 3) * 255),
      a: 1
    };
  }

  /**
   * The closest color (same hue) that reaches the target contrast on this background,
   * found by making the text lighter or darker. Returns null if none exists.
   */
  function suggestColor(fg, bg, target) {
    const hsl = rgbToHsl(fg);
    let best = null;
    for (const direction of [-1, 1]) {
      for (let step = 1; step <= 100; step++) {
        const lightness = hsl.l + (direction * step) / 100;
        if (lightness < 0 || lightness > 1) break;
        const candidate = hslToRgb(hsl.h, hsl.s, lightness);
        if (contrastRatio(candidate, bg) >= target) {
          if (!best || step < best.step) best = { step, color: candidate };
          break;
        }
      }
    }
    return best ? best.color : null;
  }

  /**
   * Everything the panel needs to say about readability.
   * Large text (24px+, or 18.66px+ and bold) has easier targets: AA 3:1, AAA 4.5:1.
   * Normal text: AA 4.5:1, AAA 7:1. Semi-transparent text is mixed with the background first.
   */
  function contrastInfo(fg, bg, fontPx, fontWeight) {
    const text = fg.a < 1 ? blend(fg, bg) : fg;
    const ratio = contrastRatio(text, bg);
    const large = fontPx >= 24 || (fontPx >= 18.66 && Number(fontWeight) >= 700);
    const aa = ratio >= (large ? 3 : 4.5);
    const aaa = ratio >= (large ? 4.5 : 7);
    const info = { ratio: Math.round(ratio * 100) / 100, large, aa, aaa, suggestion: null, background: toHex(bg) };
    if (!aa) {
      const better = suggestColor(text, bg, large ? 3 : 4.5);
      if (better) info.suggestion = toHex(better);
    }
    return info;
  }

  // ---------------------------------------------------------------------
  // Font stacks
  // ---------------------------------------------------------------------

  const GENERIC_FAMILIES = [
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'math', 'emoji', 'fangsong'
  ];
  // Names that map to the operating system's UI font, which we cannot verify.
  const SYSTEM_FAMILIES = ['-apple-system', 'blinkmacsystemfont', 'system-ui'];

  /** Splits a CSS font-family value into clean names: '"Inter", Arial' -> ['Inter', 'Arial'] */
  function parseFontStack(value) {
    if (typeof value !== 'string') return [];
    const names = [];
    let current = '';
    let quote = null;
    for (const ch of value) {
      if (quote) {
        if (ch === quote) quote = null;
        else current += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ',') {
        names.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    names.push(current.trim());
    return names.filter(Boolean);
  }

  function isGenericFamily(name) {
    return GENERIC_FAMILIES.includes(String(name).toLowerCase());
  }

  function isSystemFamily(name) {
    return SYSTEM_FAMILIES.includes(String(name).toLowerCase());
  }

  /** True when running in Firefox (it has no page for changing shortcuts that extensions may open). */
  function isFirefox() {
    return typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);
  }

  root.AlphaFonts.utils = {
    isFirefox,
    isRestrictedUrl,
    parseColor,
    toHex,
    isOpaque,
    formatColor,
    luminance,
    blend,
    contrastRatio,
    suggestColor,
    contrastInfo,
    parseFontStack,
    isGenericFamily,
    isSystemFamily
  };
})();
