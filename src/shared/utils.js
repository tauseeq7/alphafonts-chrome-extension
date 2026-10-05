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

  root.AlphaFonts.utils = {
    isRestrictedUrl,
    parseColor,
    toHex,
    isOpaque,
    formatColor,
    luminance,
    parseFontStack,
    isGenericFamily,
    isSystemFamily
  };
})();
