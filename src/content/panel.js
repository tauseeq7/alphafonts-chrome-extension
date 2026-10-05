/*
 * The inspector's user interface: highlight box, floating panel and toast.
 *
 * Everything lives in one Shadow DOM host so page CSS cannot touch it.
 * Page text is only ever written with textContent / style properties
 * (never innerHTML), so a website cannot inject markup into the panel.
 *
 * createPanel(handlers) returns a small object the content script drives.
 */
(function () {
  const AF = (globalThis.AlphaFonts = globalThis.AlphaFonts || {});
  const { UNAVAILABLE, WEBSITE_URL } = AF.constants;
  const utils = AF.utils;

  const HOST_TAG = 'alphafonts-inspector';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const PREVIEW_TEXT = 'The quick brown fox';
  const GAP = 12; // space between the element and the panel
  const MARGIN = 8; // minimum space between the panel and the viewport edge
  const COPIED_LABEL = 'Copied ✓';

  // ---------------------------------------------------------------------
  // Tiny DOM helpers
  // ---------------------------------------------------------------------

  /** h('button', { class: 'x', 'aria-label': 'y' }, 'text' | [children]) */
  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === false || value === null || value === undefined) continue;
      node.setAttribute(key, value === true ? '' : value);
    }
    for (const child of [].concat(children === undefined ? [] : children)) {
      node.append(child);
    }
    return node;
  }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  /** The AlphaFonts "A" mark. */
  function createLogo() {
    const logo = svg('svg', { viewBox: '0 0 32 32', class: 'af-logo', 'aria-hidden': 'true', focusable: 'false' });
    logo.append(
      svg('rect', { x: 0.5, y: 0.5, width: 31, height: 31, rx: 7, fill: '#0d1117', stroke: '#30363d' }),
      svg('path', {
        d: 'M8 24 L16 7.5 L24 24 M11.2 18.8 H20.8',
        fill: 'none', stroke: '#3dd6b0', 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round'
      }),
      svg('path', { d: 'M6 28 H26', fill: 'none', stroke: '#8b949e', 'stroke-width': 1.4, 'stroke-linecap': 'round' })
    );
    return logo;
  }

  /** Sun (shown in dark mode: "switch to light") or moon (shown in light mode). */
  function createThemeIcon(theme) {
    const icon = svg('svg', {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'
    });
    if (theme === 'dark') {
      icon.append(
        svg('circle', { cx: 12, cy: 12, r: 4 }),
        svg('path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' })
      );
    } else {
      icon.append(svg('path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' }));
    }
    return icon;
  }

  function show(node, visible) {
    node.hidden = !visible;
  }

  function orUnavailable(value) {
    return value ? value : UNAVAILABLE;
  }

  function viewportSize() {
    // In quirks mode the <html> element is not the viewport, <body> is.
    const el = document.compatMode === 'BackCompat' ? document.body : document.documentElement;
    return { width: el.clientWidth || window.innerWidth, height: el.clientHeight || window.innerHeight };
  }

  // ---------------------------------------------------------------------
  // Panel
  // ---------------------------------------------------------------------

  /**
   * handlers: { onCopyCSS, onCopyInfo, onCopySelector, onCopyColor,
   *             onColorFormat(format), onThemeToggle, onUnlock, onStop, onLayoutChange }
   */
  function createPanel(handlers) {
    // Remove leftovers from an older copy of the extension (e.g. after an update).
    document.querySelectorAll(HOST_TAG).forEach((old) => old.remove());

    const host = document.createElement(HOST_TAG);
    host.style.setProperty('all', 'initial', 'important');
    host.style.setProperty('position', 'fixed', 'important');
    host.style.setProperty('top', '0', 'important');
    host.style.setProperty('left', '0', 'important');
    host.style.setProperty('width', '0', 'important');
    host.style.setProperty('height', '0', 'important');
    host.style.setProperty('z-index', '2147483647', 'important');
    host.style.setProperty('pointer-events', 'none', 'important');
    const shadow = host.attachShadow({ mode: 'closed' });

    const ui = {};
    const timers = new Set();
    let colorFormat = 'hex';
    let selectorText = '';

    // ----- Build the DOM -----

    ui.highlight = h('div', { class: 'af-highlight', hidden: true });

    ui.themeBtn = h('button', { type: 'button', class: 'af-theme', hidden: true });

    ui.statusDot = h('span', { class: 'af-dot' });
    ui.statusText = h('span', {}, 'Inspecting');
    ui.status = h('span', { class: 'af-status', role: 'status' }, [ui.statusDot, ui.statusText]);

    ui.family = h('p', { class: 'af-family' });
    ui.renderedName = h('strong');
    ui.rendered = h('p', { class: 'af-rendered', hidden: true }, ['Likely rendered: ', ui.renderedName]);

    ui.stats = {};
    const statsList = h('dl', { class: 'af-stats' });
    for (const [key, label] of [
      ['fontSize', 'Size'], ['fontWeight', 'Weight'], ['fontStyle', 'Style'],
      ['lineHeight', 'Line height'], ['letterSpacing', 'Spacing']
    ]) {
      ui.stats[key] = h('dd');
      statsList.append(h('div', { class: 'af-stat' }, [h('dt', {}, label), ui.stats[key]]));
    }

    ui.swatch = h('span', { class: 'af-swatch' });
    ui.colorValue = h('span', { class: 'af-color-value' });
    ui.colorBtn = h('button', { type: 'button', class: 'af-color-btn', 'aria-label': 'Copy color value' }, [ui.swatch, ui.colorValue]);
    ui.hexBtn = h('button', { type: 'button', 'data-format': 'hex', 'aria-pressed': 'true' }, 'HEX');
    ui.rgbBtn = h('button', { type: 'button', 'data-format': 'rgb', 'aria-pressed': 'false' }, 'RGB');
    const formatSwitch = h('div', { class: 'af-segmented', role: 'group', 'aria-label': 'Color format' }, [ui.hexBtn, ui.rgbBtn]);

    ui.preview = h('div', { class: 'af-preview', 'aria-label': 'Typography preview' }, PREVIEW_TEXT);

    ui.moreRows = h('dl', { class: 'af-rows' });
    ui.more = h('details', { class: 'af-details' }, [h('summary', {}, 'More typography'), ui.moreRows]);

    ui.elementHint = h('span', { class: 'af-summary-hint' });
    ui.elementRows = h('dl', { class: 'af-rows' });
    ui.element = h('details', { class: 'af-details' }, [
      h('summary', {}, ['Element', ui.elementHint]),
      ui.elementRows
    ]);

    ui.copyCss = h('button', { type: 'button', class: 'af-btn af-btn-primary', 'data-label': 'Copy CSS' }, 'Copy CSS');
    ui.copyInfo = h('button', { type: 'button', class: 'af-btn', 'data-label': 'Copy Info' }, 'Copy Info');
    ui.copySelector = h('button', { type: 'button', class: 'af-btn', 'data-label': 'Copy Selector' }, 'Copy Selector');
    ui.unlock = h('button', { type: 'button', class: 'af-btn' }, 'Unlock');
    ui.link = h('a', { class: 'af-link', href: WEBSITE_URL, target: '_blank', rel: 'noopener noreferrer' }, 'Find more font tools at AlphaFonts');
    ui.actions = h('div', { class: 'af-actions', hidden: true }, [ui.copyCss, ui.copyInfo, ui.copySelector, ui.unlock, ui.link]);

    ui.hint = h('span', {});
    ui.stop = h('button', { type: 'button', class: 'af-stop', hidden: true }, 'Stop Inspecting');
    const foot = h('div', { class: 'af-foot' }, [ui.hint, ui.stop]);

    ui.panel = h('div', { class: 'af-panel', role: 'dialog', 'aria-label': 'AlphaFonts Font Inspector', tabindex: '-1', hidden: true, 'data-locked': 'false' }, [
      h('div', { class: 'af-head' }, [
        h('div', { class: 'af-brand' }, [
          createLogo(),
          h('div', { class: 'af-brand-text' }, [h('span', { class: 'af-brand-name' }, 'AlphaFonts'), h('span', { class: 'af-brand-sub' }, 'Font Inspector')])
        ]),
        h('div', { class: 'af-head-actions' }, [ui.themeBtn, ui.status])
      ]),
      h('div', { class: 'af-section' }, [h('h2', { class: 'af-label' }, 'Font family stack'), ui.family, ui.rendered]),
      h('div', { class: 'af-section' }, [h('h2', { class: 'af-label' }, 'Typography'), statsList]),
      h('div', { class: 'af-section' }, [h('h2', { class: 'af-label' }, 'Color'), h('div', { class: 'af-color-row' }, [ui.colorBtn, formatSwitch])]),
      h('div', { class: 'af-section' }, [h('h2', { class: 'af-label' }, 'Preview'), ui.preview]),
      ui.more,
      ui.element,
      ui.actions,
      foot
    ]);

    ui.toast = h('div', { class: 'af-toast', role: 'status', 'aria-live': 'polite', hidden: true });
    ui.clipboardArea = null;

    shadow.append(ui.highlight, ui.panel, ui.toast);

    // ----- Wire up events -----

    const press = (button, handler) => button.addEventListener('click', () => handler && handler());
    press(ui.copyCss, () => handlers.onCopyCSS());
    press(ui.copyInfo, () => handlers.onCopyInfo());
    press(ui.copySelector, () => handlers.onCopySelector());
    press(ui.colorBtn, () => handlers.onCopyColor(ui.colorValue.textContent));
    press(ui.unlock, () => handlers.onUnlock());
    press(ui.themeBtn, () => handlers.onThemeToggle());
    press(ui.stop, () => handlers.onStop());
    for (const button of [ui.hexBtn, ui.rgbBtn]) {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        handlers.onColorFormat(button.getAttribute('data-format'));
      });
    }
    // Opening/closing a section changes the panel height, so it may need to move.
    ui.more.addEventListener('toggle', () => handlers.onLayoutChange());
    ui.element.addEventListener('toggle', () => handlers.onLayoutChange());
    ui.panel.addEventListener('keydown', trapTab);

    /** Keeps Tab inside the panel while it is locked. */
    function trapTab(event) {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(ui.panel.querySelectorAll('button, a[href], summary')).filter(
        (el) => !el.disabled && el.offsetParent !== null
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = shadow.activeElement;
      if (event.shiftKey && (active === first || active === ui.panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    // ----- Rendering -----

    function addRow(list, label, value) {
      list.append(h('div', { class: 'af-row' }, [h('dt', {}, label), h('dd', {}, value)]));
    }

    function renderColor(raw) {
      const parsed = utils.parseColor(raw);
      const canUseHex = !!parsed && utils.isOpaque(parsed);
      ui.swatch.style.backgroundColor = parsed ? raw : 'transparent';
      ui.colorValue.textContent = raw ? utils.formatColor(raw, colorFormat) : UNAVAILABLE;
      ui.colorBtn.disabled = !raw;

      // Transparent colors always show rgba(), so the format switch has nothing to change.
      const switchable = !!parsed && canUseHex;
      const activeFormat = switchable ? colorFormat : 'rgb';
      ui.hexBtn.disabled = !switchable;
      ui.rgbBtn.disabled = !switchable;
      ui.hexBtn.setAttribute('aria-pressed', String(switchable && activeFormat === 'hex'));
      ui.rgbBtn.setAttribute('aria-pressed', String(switchable && activeFormat === 'rgb'));
      const reason = switchable ? '' : 'Transparent or unsupported colors are shown as written, so no alpha is lost.';
      ui.hexBtn.title = reason;
      ui.rgbBtn.title = reason;
    }

    function renderPreview(data) {
      const style = ui.preview.style;
      style.fontFamily = data.fontFamily || 'inherit';
      // Cap the size so a giant heading does not make the panel huge.
      const size = parseFloat(data.fontSize);
      style.fontSize = size > 0 ? Math.min(size, 28) + 'px' : '16px';
      style.fontWeight = data.fontWeight || 'normal';
      style.fontStyle = data.fontStyle || 'normal';
      style.letterSpacing = data.letterSpacing || 'normal';
      style.lineHeight = '1.3';
      style.textTransform = data.textTransform || 'none';
      style.color = data.color || '#f0f6fc';
      // Pick a backdrop the text color is readable on (dark text -> light backdrop).
      const parsed = utils.parseColor(data.color);
      const darkText = parsed ? utils.luminance(parsed) < 0.4 : false;
      style.backgroundColor = darkText ? '#f6f8fa' : '#0d1117';
    }

    function renderMore(data) {
      ui.moreRows.replaceChildren();
      const rows = [
        ['Align', data.textAlign],
        ['Transform', data.textTransform],
        ['Decoration', data.textDecorationLine && data.textDecorationLine !== 'none'
          ? [data.textDecorationLine, data.textDecorationStyle].filter(Boolean).join(' ')
          : data.textDecorationLine],
        ['Word spacing', data.wordSpacing],
        ['Variant', data.fontVariant],
        ['Stretch', data.fontStretch],
        ['Opacity', data.opacity],
        ['White space', data.whiteSpace],
        ['Rendering', data.textRendering]
      ];
      for (const [label, value] of rows) {
        if (value) addRow(ui.moreRows, label, value);
      }
    }

    function renderElement(element) {
      ui.elementRows.replaceChildren();
      addRow(ui.elementRows, 'Tag', element.tag.toLowerCase());
      if (element.classes) addRow(ui.elementRows, 'Class', element.classes);
      if (element.id) addRow(ui.elementRows, 'ID', element.id);
      selectorText = element.selector || '';
      if (selectorText) addRow(ui.elementRows, 'Selector', selectorText);

      const firstClass = element.classes ? '.' + element.classes.split(' ')[0] : '';
      ui.elementHint.textContent = element.tag.toLowerCase() + (element.id ? '#' + element.id : firstClass);
    }

    /** model: { data, element, colorFormat } */
    function render(model) {
      const { data, element } = model;
      colorFormat = model.colorFormat || colorFormat;
      ui.family.textContent = orUnavailable(data.fontFamily);
      ui.preview.textContent = data.previewText || PREVIEW_TEXT;
      ui.renderedName.textContent = data.renderedFont || '';
      show(ui.rendered, !!data.renderedFont);
      for (const key of Object.keys(ui.stats)) ui.stats[key].textContent = orUnavailable(data[key]);
      renderColor(data.color);
      renderPreview(data);
      renderMore(data);
      renderElement(element);
    }

    function setLocked(locked) {
      ui.panel.setAttribute('data-locked', String(locked));
      ui.highlight.setAttribute('data-locked', String(locked));
      ui.statusText.textContent = locked ? 'Locked' : 'Inspecting';
      show(ui.actions, locked);
      show(ui.themeBtn, locked); // the panel only takes clicks while locked
      show(ui.stop, locked);
      ui.hint.replaceChildren();
      if (locked) {
        ui.hint.append(h('span', { class: 'af-kbd' }, 'ESC'), ' to exit');
      } else {
        ui.hint.append('Click to lock · ', h('span', { class: 'af-kbd' }, 'ESC'), ' to exit');
      }
    }

    /** theme: 'dark' | 'light' */
    function setTheme(theme) {
      const light = theme === 'light';
      host.setAttribute('data-theme', light ? 'light' : 'dark');
      const label = light ? 'Switch to dark mode' : 'Switch to light mode';
      ui.themeBtn.setAttribute('aria-label', label);
      ui.themeBtn.title = label;
      ui.themeBtn.replaceChildren(createThemeIcon(light ? 'light' : 'dark'));
    }

    // ----- Positioning -----

    function setHighlight(rect) {
      if (!rect || rect.width <= 0 || rect.height <= 0) {
        ui.highlight.hidden = true;
        return;
      }
      ui.highlight.hidden = false;
      const style = ui.highlight.style;
      style.transform = 'translate(' + rect.left + 'px, ' + rect.top + 'px)';
      style.width = rect.width + 'px';
      style.height = rect.height + 'px';
    }

    /** Picks where the panel goes: right of the element, else left, below, above, else near the cursor. */
    function computePosition(rect, cursor, size, viewport) {
      const maxX = viewport.width - size.width - MARGIN;
      const maxY = viewport.height - size.height - MARGIN;
      const clampX = (x) => Math.max(MARGIN, Math.min(x, maxX));
      const clampY = (y) => Math.max(MARGIN, Math.min(y, maxY));

      const candidates = [
        { x: rect.right + GAP, y: rect.top, fits: rect.right + GAP <= maxX },
        { x: rect.left - GAP - size.width, y: rect.top, fits: rect.left - GAP - size.width >= MARGIN },
        { x: rect.left, y: rect.bottom + GAP, fits: rect.bottom + GAP <= maxY },
        { x: rect.left, y: rect.top - GAP - size.height, fits: rect.top - GAP - size.height >= MARGIN }
      ];
      const pick = candidates.find((c) => c.fits);
      if (pick) return { x: clampX(pick.x), y: clampY(pick.y) };

      // The element is huge: sit next to the cursor instead.
      const offset = 16;
      const x = cursor.x + offset <= maxX ? cursor.x + offset : cursor.x - offset - size.width;
      const y = cursor.y + offset <= maxY ? cursor.y + offset : cursor.y - offset - size.height;
      return { x: clampX(x), y: clampY(y) };
    }

    function place(rect, cursor) {
      const viewport = viewportSize();
      ui.panel.style.maxHeight = Math.max(120, viewport.height - MARGIN * 2) + 'px';
      const size = { width: ui.panel.offsetWidth, height: ui.panel.offsetHeight };
      const pos = computePosition(rect, cursor, size, viewport);
      ui.panel.style.transform = 'translate(' + Math.round(pos.x) + 'px, ' + Math.round(pos.y) + 'px)';
    }

    // ----- Feedback -----

    function later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id);
        fn();
      }, ms);
      timers.add(id);
      return id;
    }

    let toastTimer = null;
    function toast(message, kind) {
      ui.toast.textContent = message;
      ui.toast.setAttribute('data-kind', kind || 'info');
      ui.toast.hidden = false;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = later(() => {
        ui.toast.hidden = true;
      }, 2000);
    }

    /** Shows "Copied ✓" on a button for a moment, then restores its label. */
    function flashCopied(button) {
      const label = button.getAttribute('data-label') || button.textContent;
      button.textContent = COPIED_LABEL;
      later(() => {
        button.textContent = label;
      }, 1500);
    }

    /** Fallback copy for pages where navigator.clipboard is not available (e.g. plain http). */
    function legacyCopy(text) {
      const area = h('textarea', { readonly: true, style: 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;' });
      area.value = text;
      shadow.append(area);
      area.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (e) {
        ok = false;
      }
      area.remove();
      return ok;
    }

    /** Copies text. Returns true on success. */
    async function copyText(text) {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) {
        // Fall back below.
      }
      return legacyCopy(text);
    }

    return {
      buttons: { copyCss: ui.copyCss, copyInfo: ui.copyInfo, copySelector: ui.copySelector },
      mount(cssText) {
        const style = document.createElement('style');
        style.textContent = cssText;
        shadow.prepend(style);
        document.documentElement.append(host);
      },
      destroy() {
        timers.forEach(clearTimeout);
        timers.clear();
        host.remove();
      },
      /** True if a DOM event came from inside the inspector's own UI. */
      owns(node) {
        return node === host;
      },
      render,
      setLocked,
      setTheme,
      setHighlight,
      place,
      showPanel(visible) {
        show(ui.panel, visible);
      },
      focus() {
        ui.panel.focus({ preventScroll: true });
      },
      toast,
      flashCopied,
      copyText
    };
  }

  AF.createPanel = createPanel;
})();
