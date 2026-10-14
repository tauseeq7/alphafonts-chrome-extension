/*
 * Page-wide labels: "Label all text".
 *
 * Puts a thin outline around every text element on the page and a small label
 * above it showing the properties the person chose (font, size, weight, ...).
 *
 * How it stays fast on big pages:
 *  - the page is scanned once, then only when it changes (debounced);
 *  - an IntersectionObserver tells us which elements are on screen, and only
 *    those get labels (at most MAX_LABELS);
 *  - scrolling only moves existing labels, it never re-reads styles.
 *
 * Labels sit ABOVE their element (not on top of the text) and are nudged
 * sideways when two would overlap. They never take mouse clicks.
 */
(function () {
  const AF = (globalThis.AlphaFonts = globalThis.AlphaFonts || {});
  const utils = AF.utils;
  const typography = AF.typography;
  const settingsStore = AF.settings;
  const { PROPERTIES } = settingsStore;

  const HOST_TAG = 'alphafonts-labels';
  const MAX_LABELS = 400;
  const PILL_HEIGHT = 18;
  const PILL_GAP = 3;
  const RESCAN_DELAY_MS = 700;
  const COLLISION_WINDOW = 40; // only the most recent labels can overlap a new one

  // ---------------------------------------------------------------------
  // What a label says
  // ---------------------------------------------------------------------

  function isDefault(key, value) {
    switch (key) {
      case 'fontStyle': return value === 'normal';
      case 'letterSpacing':
      case 'wordSpacing': return value === 'normal' || value === '0px';
      case 'textAlign': return value === 'start' || value === 'left';
      case 'textTransform': return value === 'none';
      case 'textDecoration': return value === 'none';
      default: return false;
    }
  }

  function shorten(text, max) {
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  /**
   * Turns computed styles into label pieces: [{ text, color? }].
   * Values that are just the browser default (normal style, no spacing...) are left out
   * so labels only show what is worth noticing.
   */
  function labelParts(data, enabled, colorFormat) {
    const parts = [];
    for (const { key } of PROPERTIES) {
      if (!enabled[key]) continue;
      switch (key) {
        case 'fontFamily': {
          const first = utils.parseFontStack(data.fontFamily)[0];
          if (first) parts.push({ text: shorten(first, 16) });
          break;
        }
        case 'fontSize':
          if (data.fontSize) parts.push({ text: data.fontSize });
          break;
        case 'fontWeight':
          if (data.fontWeight) parts.push({ text: data.fontWeight });
          break;
        case 'fontColor':
          if (data.color) parts.push({ text: utils.formatColor(data.color, colorFormat), color: data.color });
          break;
        case 'lineHeight':
          if (data.lineHeight) parts.push({ text: 'lh ' + data.lineHeight });
          break;
        case 'letterSpacing':
          if (data.letterSpacing && !isDefault(key, data.letterSpacing)) parts.push({ text: 'ls ' + data.letterSpacing });
          break;
        case 'wordSpacing':
          if (data.wordSpacing && !isDefault(key, data.wordSpacing)) parts.push({ text: 'ws ' + data.wordSpacing });
          break;
        case 'textDecoration':
          if (data.textDecorationLine && !isDefault(key, data.textDecorationLine)) parts.push({ text: data.textDecorationLine });
          break;
        default: {
          // fontStyle, textAlign, textTransform: the computed value is the label.
          const value = data[key];
          if (value && !isDefault(key, value)) parts.push({ text: value });
        }
      }
    }
    return parts;
  }

  // ---------------------------------------------------------------------
  // The overlay
  // ---------------------------------------------------------------------

  function viewportSize() {
    const el = document.compatMode === 'BackCompat' ? document.body : document.documentElement;
    return { width: el.clientWidth || window.innerWidth, height: el.clientHeight || window.innerHeight };
  }

  function el(tag, className) {
    const node = document.createElement(tag);
    node.className = className;
    return node;
  }

  function createLabels() {
    let active = false;
    let host = null;
    let layer = null;
    let observer = null;
    let mutations = null;
    let settings = null;
    let frame = 0;
    let rescanTimer = 0;
    let lastScanMs = 0;

    const candidates = new Set(); // every text element found on the page
    const visible = new Set(); // the ones currently on (or near) the screen
    const items = new Map(); // element -> { box, pill, w, h, parts }

    // ----- Finding text elements -----

    function scan() {
      const started = performance.now();
      const root = document.body || document.documentElement;
      const found = new Set();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      let node = walker.currentNode;
      while (node) {
        if (node.nodeType === 1 && typography.hasOwnText(node)) {
          found.add(node);
          if (!candidates.has(node)) {
            candidates.add(node);
            observer.observe(node);
          }
        }
        node = walker.nextNode();
      }
      for (const element of Array.from(candidates)) {
        if (found.has(element)) continue;
        candidates.delete(element);
        visible.delete(element);
        observer.unobserve(element);
        removeItem(element);
      }
      lastScanMs = performance.now() - started;
    }

    /** The page changed: look again, but not too often (slow pages wait longer). */
    function scheduleRescan() {
      if (rescanTimer || !active) return;
      rescanTimer = setTimeout(() => {
        rescanTimer = 0;
        if (!active) return;
        scan();
        clearItems(); // styles may have changed too
        scheduleRender();
      }, Math.max(RESCAN_DELAY_MS, lastScanMs * 15));
    }

    function onIntersect(entries) {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target);
        else {
          visible.delete(entry.target);
          removeItem(entry.target);
        }
      }
      scheduleRender();
    }

    // ----- Label elements -----

    function removeItem(element) {
      const item = items.get(element);
      if (!item) return;
      item.box.remove();
      if (item.pill) item.pill.remove();
      items.delete(element);
    }

    function clearItems() {
      for (const element of Array.from(items.keys())) removeItem(element);
    }

    function createItem(element) {
      const item = { box: el('div', 'afl-box'), pill: null, w: 0, h: 0, parts: null };
      layer.append(item.box);
      const parts = labelParts(typography.getLabelData(element), settings.labelProperties, settings.colorFormat);
      if (parts.length) {
        item.pill = el('div', 'afl-pill');
        for (const part of parts) {
          const group = el('span', 'afl-part');
          if (part.color) {
            const swatch = el('span', 'afl-swatch');
            swatch.style.backgroundColor = part.color;
            group.append(swatch);
          }
          group.append(document.createTextNode(part.text));
          item.pill.append(group);
        }
        layer.append(item.pill);
      }
      items.set(element, item);
      return item;
    }

    // ----- Drawing (batched: write, then read, then write) -----

    function scheduleRender() {
      if (frame || !active) return;
      frame = requestAnimationFrame(render);
    }

    function render() {
      frame = 0;
      if (!active) return;
      const view = viewportSize();

      // 1. Measure which elements are really on screen.
      const onScreen = [];
      for (const element of Array.from(visible)) {
        if (!element.isConnected) {
          visible.delete(element);
          candidates.delete(element);
          removeItem(element);
          continue;
        }
        const rect = element.getBoundingClientRect();
        const outside = rect.bottom < 0 || rect.top > view.height || rect.right < 0 || rect.left > view.width;
        if (rect.width < 1 || rect.height < 1 || outside) {
          removeItem(element);
          continue;
        }
        onScreen.push({ element, rect });
      }
      onScreen.sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);
      const shown = onScreen.slice(0, MAX_LABELS);
      const keep = new Set(shown.map((entry) => entry.element));
      for (const element of Array.from(items.keys())) {
        if (!keep.has(element)) removeItem(element);
      }

      // 2. Create missing labels, then read all new label widths in one go.
      for (const { element } of shown) {
        if (!items.has(element)) createItem(element);
      }
      for (const { element } of shown) {
        const item = items.get(element);
        if (item.pill && !item.w) item.w = item.pill.offsetWidth;
      }

      // 3. Position everything.
      const placed = [];
      for (const { element, rect } of shown) {
        const item = items.get(element);
        item.box.style.transform = 'translate(' + rect.left + 'px, ' + rect.top + 'px)';
        item.box.style.width = rect.width + 'px';
        item.box.style.height = rect.height + 'px';
        if (!item.pill) continue;

        const spot = chooseSpot(element, rect, item.w, shown, placed, view);
        placed.push({ x: spot.x, y: spot.y, w: item.w });
        item.pill.style.transform = 'translate(' + Math.round(spot.x) + 'px, ' + Math.round(spot.y) + 'px)';
      }
    }

    /**
     * Picks where a label goes. Preferred spots, in order: above the element's left edge,
     * above its right edge, below it, inside its top-left corner. The first spot that
     * covers neither another label nor another element's text wins.
     */
    function chooseSpot(element, rect, w, shown, placed, view) {
      const clampX = (x) => Math.max(0, Math.min(x, view.width - w - 2));
      const above = rect.top - PILL_HEIGHT - 2;
      const candidates = [
        { x: clampX(rect.left), y: above },
        { x: clampX(rect.right - w), y: above },
        { x: clampX(rect.left), y: rect.bottom + 2 },
        { x: clampX(rect.left + 2), y: rect.top + 2 }
      ].filter((c) => c.y >= 0 && c.y + PILL_HEIGHT <= view.height);

      const recent = placed.slice(-COLLISION_WINDOW);
      const hitsLabel = (c) =>
        recent.some((p) => c.x < p.x + p.w + PILL_GAP && c.x + w + PILL_GAP > p.x && c.y < p.y + PILL_HEIGHT && c.y + PILL_HEIGHT > p.y);
      const hitsText = (c) => {
        for (const other of shown) {
          if (other.rect.top >= c.y + PILL_HEIGHT) break; // `shown` is sorted by top
          if (other.element === element || other.element.contains(element) || element.contains(other.element)) continue;
          const r = other.rect;
          if (c.x < r.right && c.x + w > r.left && c.y < r.bottom && c.y + PILL_HEIGHT > r.top) return true;
        }
        return false;
      };

      const clean = candidates.find((c) => !hitsLabel(c) && !hitsText(c));
      if (clean) return clean;

      // Crowded: keep the first spot that avoids other labels, sliding right or dropping down.
      let x = clampX(rect.left);
      let y = above >= 0 ? above : rect.top + 2;
      for (let attempt = 0; attempt < 4; attempt++) {
        const hit = recent.find((p) => x < p.x + p.w + PILL_GAP && x + w + PILL_GAP > p.x && y < p.y + PILL_HEIGHT && y + PILL_HEIGHT > p.y);
        if (!hit) break;
        x = hit.x + hit.w + PILL_GAP;
        if (x + w > view.width) {
          x = Math.max(0, rect.left);
          y = hit.y + PILL_HEIGHT + 2;
        }
      }
      return { x, y };
    }

    // ----- Settings -----

    function onStorage(changes, area) {
      const next = settingsStore.fromChange(changes, area);
      if (!next || !active) return;
      settings = next;
      host.setAttribute('data-theme', next.theme);
      clearItems();
      scheduleRender();
    }

    // ----- Public API -----

    function start(cssText, initialSettings) {
      if (active) return;
      active = true;
      settings = initialSettings;
      document.querySelectorAll(HOST_TAG).forEach((old) => old.remove());

      host = document.createElement(HOST_TAG);
      for (const [name, value] of [
        ['all', 'initial'], ['position', 'fixed'], ['top', '0'], ['left', '0'], ['width', '0'],
        ['height', '0'], ['z-index', '2147483646'], ['pointer-events', 'none']
      ]) {
        host.style.setProperty(name, value, 'important');
      }
      host.setAttribute('data-theme', settings.theme);
      const shadow = host.attachShadow({ mode: 'closed' });
      const style = document.createElement('style');
      style.textContent = cssText;
      layer = el('div', 'afl-layer');
      shadow.append(style, layer);
      document.documentElement.append(host);

      observer = new IntersectionObserver(onIntersect, { rootMargin: '150px' });
      mutations = new MutationObserver(scheduleRescan);
      mutations.observe(document.body || document.documentElement, { childList: true, subtree: true, characterData: true });
      window.addEventListener('scroll', scheduleRender, { capture: true, passive: true });
      window.addEventListener('resize', scheduleRender, { passive: true });
      chrome.storage.onChanged.addListener(onStorage);
      scan();
      scheduleRender();
    }

    function stop() {
      if (!active) return;
      active = false;
      if (frame) cancelAnimationFrame(frame);
      if (rescanTimer) clearTimeout(rescanTimer);
      frame = 0;
      rescanTimer = 0;
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener('scroll', scheduleRender, { capture: true });
      window.removeEventListener('resize', scheduleRender);
      chrome.storage.onChanged.removeListener(onStorage);
      host.remove();
      candidates.clear();
      visible.clear();
      items.clear();
      host = layer = observer = mutations = null;
    }

    /** Re-read styles (for example after a live edit) and redraw. */
    function refresh() {
      if (!active) return;
      clearItems();
      scheduleRender();
    }

    return { start, stop, refresh, isActive: () => active };
  }

  AF.createLabels = createLabels;
  AF.labelParts = labelParts; // exposed for tests
})();
