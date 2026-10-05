/*
 * Typography helpers for the content script:
 *  - reading computed styles
 *  - guessing the rendered font
 *  - building the "Copy CSS" and "Copy Info" text
 *  - describing an element and generating a short CSS selector
 *
 * Nothing here touches the page: it only reads.
 */
(function () {
  const AF = (globalThis.AlphaFonts = globalThis.AlphaFonts || {});
  const { UNAVAILABLE } = AF.constants;
  const utils = AF.utils;

  // ---------------------------------------------------------------------
  // Reading computed styles
  // ---------------------------------------------------------------------

  /** Reads one computed property. Returns null when it is missing or unsupported. */
  function readProperty(style, name) {
    try {
      const value = style.getPropertyValue(name);
      return value && value.trim() ? value.trim() : null;
    } catch (e) {
      return null;
    }
  }

  const PROPERTIES = {
    fontFamily: 'font-family',
    fontSize: 'font-size',
    fontWeight: 'font-weight',
    fontStyle: 'font-style',
    fontVariant: 'font-variant',
    fontStretch: 'font-stretch',
    lineHeight: 'line-height',
    letterSpacing: 'letter-spacing',
    wordSpacing: 'word-spacing',
    textAlign: 'text-align',
    textTransform: 'text-transform',
    textDecorationLine: 'text-decoration-line',
    textDecorationStyle: 'text-decoration-style',
    textDecorationThickness: 'text-decoration-thickness',
    color: 'color',
    opacity: 'opacity',
    textRendering: 'text-rendering',
    whiteSpace: 'white-space'
  };

  /**
   * Collects typography data for an element.
   * Missing values are null, so the UI can show "Unavailable" or hide them.
   */
  function getTypographyData(element) {
    const data = {};
    let style = null;
    try {
      style = window.getComputedStyle(element);
    } catch (e) {
      style = null;
    }
    for (const key of Object.keys(PROPERTIES)) {
      data[key] = style ? readProperty(style, PROPERTIES[key]) : null;
    }
    data.renderedFont = detectRenderedFont(data.fontFamily);
    return data;
  }

  // ---------------------------------------------------------------------
  // "Likely rendered font"
  // ---------------------------------------------------------------------
  // Browsers do not tell pages which font file was really used. As a hint we
  // walk the font stack and pick the first family that the browser can
  // actually load (installed or a loaded web font), by comparing text widths
  // against generic fallbacks. It is a good guess, not a guarantee, so the UI
  // always calls it "likely".

  let measureContext = null;
  const SAMPLE_TEXT = 'mmmmmmmmmmlliWWiiAaQq@#0123456789';
  const BASELINES = ['monospace', 'serif', 'sans-serif'];

  function getMeasureContext() {
    if (!measureContext) {
      measureContext = document.createElement('canvas').getContext('2d');
    }
    return measureContext;
  }

  function isFamilyAvailable(name) {
    const ctx = getMeasureContext();
    if (!ctx) return false;
    const quoted = '"' + name.replace(/["\\]/g, '\\$&') + '"';
    for (const baseline of BASELINES) {
      ctx.font = '72px ' + baseline;
      const baseWidth = ctx.measureText(SAMPLE_TEXT).width;
      ctx.font = '72px ' + quoted + ', ' + baseline;
      if (ctx.measureText(SAMPLE_TEXT).width !== baseWidth) return true;
    }
    return false;
  }

  /** Returns the first available named family in the stack, or null if we cannot tell. */
  function detectRenderedFont(fontFamilyValue) {
    try {
      for (const name of utils.parseFontStack(fontFamilyValue)) {
        // Reaching a generic/system family means the OS picks the font: stop guessing.
        if (utils.isGenericFamily(name) || utils.isSystemFamily(name)) return null;
        if (isFamilyAvailable(name)) return name;
      }
    } catch (e) {
      // Fall through: "unknown" is always a safe answer.
    }
    return null;
  }

  // ---------------------------------------------------------------------
  // Text output
  // ---------------------------------------------------------------------

  function hasValue(value) {
    return !!value && value !== UNAVAILABLE;
  }

  function isDefaultStretch(value) {
    return value === 'normal' || value === '100%';
  }

  /** Builds the CSS block for "Copy CSS". Only properties with real values are included. */
  function buildCSS(data) {
    const lines = [];
    const add = (property, value) => {
      if (hasValue(value)) lines.push(property + ': ' + value + ';');
    };

    add('font-family', data.fontFamily);
    add('font-size', data.fontSize);
    add('font-weight', data.fontWeight);
    add('font-style', data.fontStyle);
    if (hasValue(data.fontVariant) && data.fontVariant !== 'normal') add('font-variant', data.fontVariant);
    if (hasValue(data.fontStretch) && !isDefaultStretch(data.fontStretch)) add('font-stretch', data.fontStretch);
    add('line-height', data.lineHeight);
    add('letter-spacing', data.letterSpacing);
    if (hasValue(data.wordSpacing) && data.wordSpacing !== 'normal' && data.wordSpacing !== '0px') {
      add('word-spacing', data.wordSpacing);
    }
    add('color', data.color);
    add('text-align', data.textAlign);
    add('text-transform', data.textTransform);
    if (hasValue(data.textDecorationLine) && data.textDecorationLine !== 'none') {
      add('text-decoration-line', data.textDecorationLine);
      add('text-decoration-style', data.textDecorationStyle);
      if (data.textDecorationThickness !== 'auto') add('text-decoration-thickness', data.textDecorationThickness);
    }
    return lines.join('\n');
  }

  function colorForInfo(raw) {
    const parsed = utils.parseColor(raw);
    if (parsed && utils.isOpaque(parsed)) return raw + ' (' + utils.toHex(parsed) + ')';
    return raw;
  }

  /** Builds the readable summary for "Copy Info". */
  function buildInfo(data, elementInfo) {
    const lines = ['AlphaFonts Font Inspector', ''];
    const add = (label, value) => {
      if (hasValue(value)) lines.push(label + ': ' + value);
    };

    add('Font Family', data.fontFamily);
    add('Likely Rendered Font', data.renderedFont);
    add('Font Size', data.fontSize);
    add('Font Weight', data.fontWeight);
    add('Font Style', data.fontStyle);
    if (hasValue(data.fontVariant) && data.fontVariant !== 'normal') add('Font Variant', data.fontVariant);
    if (hasValue(data.fontStretch) && !isDefaultStretch(data.fontStretch)) add('Font Stretch', data.fontStretch);
    add('Line Height', data.lineHeight);
    add('Letter Spacing', data.letterSpacing);
    if (hasValue(data.wordSpacing) && data.wordSpacing !== 'normal' && data.wordSpacing !== '0px') {
      add('Word Spacing', data.wordSpacing);
    }
    if (hasValue(data.color)) add('Color', colorForInfo(data.color));
    add('Text Align', data.textAlign);
    add('Text Transform', data.textTransform);
    if (hasValue(data.textDecorationLine) && data.textDecorationLine !== 'none') {
      add('Text Decoration', [data.textDecorationLine, data.textDecorationStyle].filter(hasValue).join(' '));
    }
    if (hasValue(data.opacity) && data.opacity !== '1') add('Opacity', data.opacity);
    if (elementInfo) {
      add('Element', elementInfo.tag.toLowerCase());
      add('Selector', elementInfo.selector);
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------------
  // Element description and selector
  // ---------------------------------------------------------------------

  const UNSTABLE_CLASS_PREFIXES = ['css-', 'sc-', 'jsx-', 'emotion-', 'styled-', 'svelte-', 'ng-'];

  /** Classes/ids that look hand-written, not generated (hashes, utility classes with symbols). */
  function isStableToken(token) {
    if (!token || token.length > 40) return false;
    if (/\d{4,}/.test(token)) return false;
    if (/[:\[\]/%#!@]/.test(token)) return false;
    const lower = token.toLowerCase();
    return !UNSTABLE_CLASS_PREFIXES.some((prefix) => lower.startsWith(prefix));
  }

  function getClassList(element) {
    const raw = element.getAttribute && element.getAttribute('class');
    return raw ? raw.split(/\s+/).filter(Boolean) : [];
  }

  /** Plain facts about the element for the "Element" section. */
  function describeElement(element) {
    const classes = getClassList(element);
    return {
      tag: element.tagName || 'UNKNOWN',
      id: element.id || '',
      classes: classes.join(' ')
    };
  }

  function escapeIdent(value) {
    return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(value) : value.replace(/[^\w-]/g, '\\$&');
  }

  function tagOf(element) {
    return element.tagName.toLowerCase();
  }

  function nthOfType(element) {
    let index = 1;
    for (let sib = element.previousElementSibling; sib; sib = sib.previousElementSibling) {
      if (sib.tagName === element.tagName) index++;
    }
    return index;
  }

  function hasSameTagSibling(element) {
    const parent = element.parentElement;
    if (!parent) return false;
    for (const sib of parent.children) {
      if (sib !== element && sib.tagName === element.tagName) return true;
    }
    return false;
  }

  /** One step of a selector: #id, or tag.class.class, or tag:nth-of-type(n). */
  function selectorSegment(element) {
    if (element.id && isStableToken(element.id)) return '#' + escapeIdent(element.id);
    const classes = getClassList(element).filter(isStableToken).slice(0, 2);
    if (classes.length) return tagOf(element) + classes.map((c) => '.' + escapeIdent(c)).join('');
    const tag = tagOf(element);
    return hasSameTagSibling(element) ? tag + ':nth-of-type(' + nthOfType(element) + ')' : tag;
  }

  /** Guaranteed-unique fallback: tag:nth-of-type steps up to an id or <body>. */
  function pathSelector(element) {
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
      if (node.id && isStableToken(node.id)) {
        parts.unshift('#' + escapeIdent(node.id));
        return parts.join(' > ');
      }
      parts.unshift(tagOf(node) + ':nth-of-type(' + nthOfType(node) + ')');
      node = node.parentElement;
    }
    if (document.body && node === document.body) parts.unshift('body');
    return parts.join(' > ');
  }

  /**
   * Builds a short, reasonably stable selector such as ".hero-title" or "#main-heading".
   * Tries the shortest options first and only grows when needed.
   */
  function generateSelector(element) {
    try {
      const scope = element.getRootNode();
      const isUnique = (selector) => {
        try {
          const matches = scope.querySelectorAll(selector);
          return matches.length === 1 && matches[0] === element;
        } catch (e) {
          return false;
        }
      };

      // 1. #id or a single class on its own.
      if (element.id && isStableToken(element.id) && isUnique('#' + escapeIdent(element.id))) {
        return '#' + escapeIdent(element.id);
      }
      const classes = getClassList(element).filter(isStableToken).slice(0, 3);
      for (const name of classes) {
        const selector = '.' + escapeIdent(name);
        if (isUnique(selector)) return selector;
      }

      // 2. Add the tag and parents until the selector is unique (at most 3 parents).
      const parts = [selectorSegment(element)];
      if (isUnique(parts[0])) return parts[0];
      let parent = element.parentElement;
      for (let depth = 0; depth < 3 && parent && parent !== document.documentElement; depth++) {
        parts.unshift(selectorSegment(parent));
        const selector = parts.join(' > ');
        if (isUnique(selector)) return selector;
        parent = parent.parentElement;
      }

      // 3. Last resort: a full path, always unique.
      return pathSelector(element);
    } catch (e) {
      return tagOf(element);
    }
  }

  AF.typography = {
    getTypographyData,
    detectRenderedFont,
    buildCSS,
    buildInfo,
    describeElement,
    generateSelector
  };
})();
