/*
 * AlphaFonts Font Inspector - content script.
 *
 * Injected on demand (popup button, keyboard shortcut or right-click menu).
 * It listens for the mouse while inspection is on, highlights the hovered
 * text element, shows the floating panel and lets the user lock it, copy
 * values, try new values live, and leave with Escape.
 */
(function () {
  const AF = (globalThis.AlphaFonts = globalThis.AlphaFonts || {});
  if (AF.inspectorLoaded) return; // already running in this page
  AF.inspectorLoaded = true;

  const { MESSAGES, ERRORS } = AF.constants;
  const typography = AF.typography;
  const settingsStore = AF.settings;

  const CURSOR_STYLE_ID = 'alphafonts-inspector-cursor';
  // Mouse events we swallow while inspecting, so clicks never reach the page's own handlers.
  const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'auxclick'];
  const SKIPPED_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'];
  const WATCH_INTERVAL_MS = 400;

  const state = {
    active: false,
    locked: false,
    editing: false,
    panel: null,
    settings: settingsStore.defaults(),
    element: null, // element currently shown in the panel
    data: null,
    info: null,
    cursor: { x: 0, y: 0 },
    pendingTarget: null,
    needsHitTest: false, // re-find the element under the cursor (after scroll)
    needsLayout: false, // re-measure the highlight/panel (after scroll/resize)
    frame: 0,
    watchTimer: 0,
    watchedRect: '',
    cssText: null,
    starting: null,
    // Live edits made from the panel: element -> Map(cssProperty -> original inline value).
    // They stay on the page after the inspector closes, until "Remove layers" or a reload.
    edits: new Map()
  };

  // ---------------------------------------------------------------------
  // Talking to the rest of the extension
  // ---------------------------------------------------------------------

  function notify(type) {
    try {
      const result = chrome.runtime.sendMessage({ type });
      if (result && result.catch) result.catch(() => {});
    } catch (e) {
      // The extension was reloaded while this page was open: nothing to tell.
    }
  }

  /** The panel's CSS lives in an extension file; the background service worker reads it for us. */
  async function loadPanelStyles() {
    if (state.cssText) return state.cssText;
    const reply = await chrome.runtime.sendMessage({ type: MESSAGES.GET_PANEL_STYLES });
    if (!reply || !reply.ok || typeof reply.css !== 'string') throw new Error('Panel styles unavailable');
    state.cssText = reply.css;
    return state.cssText;
  }

  // ---------------------------------------------------------------------
  // Settings (shared with the popup and options page)
  // ---------------------------------------------------------------------

  /** Applies new settings to a running panel. */
  function applySettings(settings) {
    state.settings = settings;
    if (!state.panel) return;
    state.panel.setTheme(settings.theme);
    if (state.element && state.data) {
      state.panel.setCompact(!state.locked && !settings.showAllOnHover);
      renderPanel();
      if (state.editing) state.panel.setEditing(true, state.data, settings.properties);
      updateLayout();
    }
  }

  function handleStorageChange(changes, area) {
    const next = settingsStore.fromChange(changes, area);
    if (next) applySettings(next);
  }

  function saveSetting(patch) {
    settingsStore.save(patch);
  }

  function toggleTheme() {
    const theme = state.settings.theme === 'light' ? 'dark' : 'light';
    applySettings({ ...state.settings, theme });
    saveSetting({ theme });
  }

  function setColorFormat(format) {
    const colorFormat = format === 'rgb' ? 'rgb' : 'hex';
    applySettings({ ...state.settings, colorFormat });
    saveSetting({ colorFormat });
  }

  // ---------------------------------------------------------------------
  // Start / stop
  // ---------------------------------------------------------------------

  async function startInspector() {
    if (state.active) return;
    if (!state.starting) {
      state.starting = (async () => {
        const css = await loadPanelStyles();
        state.settings = await settingsStore.load();
        const panel = AF.createPanel({
          onCopyCSS: copyCSS,
          onCopyInfo: copyFontInfo,
          onCopySelector: copySelector,
          onCopyColor: copyColor,
          onColorFormat: setColorFormat,
          onThemeToggle: toggleTheme,
          onUnlock: unlock,
          onStop: stopInspector,
          onLayoutChange: updateLayout,
          onToggleEdit: toggleEditing,
          onEdit: applyEdit,
          onResetEdits: resetEdits
        });
        panel.mount(css);
        panel.setTheme(state.settings.theme);
        panel.setLocked(false);
        state.panel = panel;
        state.active = true;
        addListeners();
        chrome.storage.onChanged.addListener(handleStorageChange);
        setCursorStyle(true);
        notify(MESSAGES.INSPECTOR_STARTED);
      })();
    }
    try {
      await state.starting;
    } finally {
      state.starting = null;
    }
  }

  function stopInspector() {
    if (!state.active) return;
    removeListeners();
    chrome.storage.onChanged.removeListener(handleStorageChange);
    setCursorStyle(false);
    if (state.frame) cancelAnimationFrame(state.frame);
    stopWatching();
    if (state.panel) state.panel.destroy();
    state.active = false;
    state.locked = false;
    state.editing = false;
    state.panel = null;
    state.element = null;
    state.data = null;
    state.info = null;
    state.pendingTarget = null;
    state.frame = 0;
    notify(MESSAGES.INSPECTOR_STOPPED);
  }

  /** "Remove layers": close the inspector AND undo every live edit on the page. */
  function removeLayers() {
    stopInspector();
    revertAllEdits();
  }

  /** Crosshair cursor while inspecting, done with a removable <style> so we never edit page elements. */
  function setCursorStyle(on) {
    const existing = document.getElementById(CURSOR_STYLE_ID);
    if (!on) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;
    const style = document.createElement('style');
    style.id = CURSOR_STYLE_ID;
    style.textContent = 'html, html * { cursor: crosshair !important; }';
    document.documentElement.append(style);
  }

  // ---------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------

  const listeners = [
    ['mousemove', handleMouseMove, { capture: true, passive: true }],
    ['mouseout', handleMouseOut, { capture: true, passive: true }],
    ['blur', handleWindowBlur, { capture: true }],
    ['keydown', handleKeyDown, { capture: true }],
    ['scroll', handleViewportChange, { capture: true, passive: true }],
    ['resize', handleViewportChange, { passive: true }]
  ].concat(BLOCKED_EVENTS.map((type) => [type, handlePageClick, { capture: true }]));

  function addListeners() {
    for (const [type, fn, options] of listeners) window.addEventListener(type, fn, options);
  }

  function removeListeners() {
    for (const [type, fn, options] of listeners) window.removeEventListener(type, fn, options);
  }

  /** The real element under the pointer (looks inside open shadow roots too). */
  function eventTarget(event) {
    const path = event.composedPath ? event.composedPath() : [];
    return path[0] || event.target;
  }

  function handleMouseMove(event) {
    state.cursor = { x: event.clientX, y: event.clientY };
    if (state.locked) return;
    state.pendingTarget = eventTarget(event);
    scheduleFrame();
  }

  function handleMouseOut(event) {
    if (state.locked) return;
    // relatedTarget is the element being entered. It is null when the pointer leaves the
    // window, and an <iframe> when it enters one (the page gets no more mouse events from
    // inside a frame). In both cases there is nothing to inspect, so the panel hides.
    state.pendingTarget = event.relatedTarget;
    scheduleFrame();
  }

  /** Clicking into an iframe moves focus away from this page: drop the stale hover. */
  function handleWindowBlur(event) {
    if (event.target !== window || state.locked) return;
    state.pendingTarget = null;
    scheduleFrame();
  }

  function handleViewportChange(event) {
    if (event.target && state.panel && state.panel.owns(event.target)) return;
    state.needsLayout = true;
    state.needsHitTest = !state.locked;
    scheduleFrame();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stopInspector();
    }
  }

  /** While inspecting, a click selects text to inspect instead of activating the page. */
  function handlePageClick(event) {
    if (state.panel && state.panel.owns(event.target)) return; // the panel's own buttons
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.type !== 'click') return;

    const element = findInspectable(eventTarget(event));
    if (!element) return;
    state.cursor = { x: event.clientX, y: event.clientY };
    inspectElement(element);
    lock();
  }

  // ---------------------------------------------------------------------
  // Hover handling (throttled with requestAnimationFrame)
  // ---------------------------------------------------------------------

  function scheduleFrame() {
    if (state.frame) return;
    state.frame = requestAnimationFrame(processFrame);
  }

  function processFrame() {
    state.frame = 0;
    if (!state.active) return;
    try {
      if (state.locked) {
        if (state.needsLayout) updateLayout();
        state.needsLayout = false;
        return;
      }
      if (state.needsHitTest) {
        state.pendingTarget = document.elementFromPoint(state.cursor.x, state.cursor.y);
        state.needsHitTest = false;
      }
      handleHover(findInspectable(state.pendingTarget));
      state.needsLayout = false;
    } catch (e) {
      // Never let one bad element break inspection mode.
    }
  }

  function handleHover(element) {
    if (!element) {
      clearHover();
    } else if (element !== state.element) {
      inspectElement(element);
    } else if (state.needsLayout) {
      updateLayout();
    }
  }

  function clearHover() {
    if (!state.element) return;
    state.element = null;
    state.panel.setHighlight(null);
    state.panel.showPanel(false);
  }

  /** Returns the element if it directly contains text worth inspecting, otherwise null. */
  function findInspectable(target) {
    if (target && target.nodeType !== 1) target = target.parentElement;
    if (!target || (state.panel && state.panel.owns(target))) return null;
    return hasOwnText(target) ? target : null;
  }

  function hasOwnText(element) {
    if (SKIPPED_TAGS.includes(element.tagName)) return false;
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      return !!(element.value || element.placeholder);
    }
    if (element.tagName === 'SELECT') return true;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && /\S/.test(node.nodeValue)) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------
  // Inspecting and locking
  // ---------------------------------------------------------------------

  /** Reads the element's typography and shows it in the panel. */
  function inspectElement(element) {
    if (state.editing) leaveEditing();
    state.element = element;
    state.data = typography.getTypographyData(element);
    state.info = typography.describeElement(element);
    state.panel.setCompact(!state.locked && !state.settings.showAllOnHover);
    state.panel.setEdited(state.edits.has(element));
    renderPanel();
    state.panel.showPanel(true);
    updateLayout();
  }

  function renderPanel() {
    state.panel.render({ data: state.data, element: state.info, settings: state.settings });
  }

  function lock() {
    if (!state.element) return;
    state.locked = true;
    state.info.selector = typography.generateSelector(state.element); // computed once, only when needed
    state.panel.setLocked(true);
    state.panel.setCompact(false);
    renderPanel();
    updateLayout();
    state.panel.focus();
    startWatching();
  }

  function unlock() {
    if (!state.locked) return;
    if (state.editing) leaveEditing();
    state.locked = false;
    stopWatching();
    state.panel.setLocked(false);
    if (state.info) state.info.selector = '';
    state.pendingTarget = document.elementFromPoint(state.cursor.x, state.cursor.y);
    state.needsHitTest = false;
    clearHover();
    scheduleFrame();
  }

  /**
   * While locked, the page may move or remove the element without any scroll or
   * resize (animations, lazy images, React/Vue re-renders). A light timer keeps up.
   */
  function startWatching() {
    stopWatching();
    state.watchedRect = '';
    state.watchTimer = setInterval(() => {
      if (!state.locked || !state.element) return;
      if (!state.element.isConnected) return updateLayout(); // unlocks
      const r = state.element.getBoundingClientRect();
      const signature = [r.left, r.top, r.width, r.height].join(',');
      if (signature !== state.watchedRect) {
        state.watchedRect = signature;
        updateLayout();
      }
    }, WATCH_INTERVAL_MS);
  }

  function stopWatching() {
    if (state.watchTimer) clearInterval(state.watchTimer);
    state.watchTimer = 0;
  }

  /** Re-measures the element and moves the highlight and panel to match. */
  function updateLayout() {
    if (!state.active || !state.element || !state.panel) return;
    if (!state.element.isConnected) {
      // The page removed the element (common in React/Vue apps).
      if (state.locked) unlock();
      else clearHover();
      return;
    }
    const rect = state.element.getBoundingClientRect();
    state.panel.setHighlight(rect);
    state.panel.place(rect, state.cursor);
  }

  // ---------------------------------------------------------------------
  // Live editing
  // ---------------------------------------------------------------------
  // Edits are written to the element's inline style (with !important, so they win over the
  // page's own CSS). The original inline value is remembered so every change can be undone.

  function toggleEditing() {
    if (!state.locked || !state.element) return;
    if (state.editing) {
      leaveEditing();
    } else {
      state.editing = true;
      state.panel.setEditing(true, state.data, state.settings.properties);
    }
    updateLayout();
  }

  function leaveEditing() {
    state.editing = false;
    if (state.panel) state.panel.setEditing(false);
  }

  /** Applies one new value. Returns false when the browser would not accept it. */
  function applyEdit(property, value) {
    const element = state.element;
    const next = String(value).trim();
    if (!element || !state.locked || !next || !CSS.supports(property, next)) return false;

    let originals = state.edits.get(element);
    if (!originals) {
      originals = new Map();
      state.edits.set(element, originals);
    }
    if (!originals.has(property)) {
      originals.set(property, {
        value: element.style.getPropertyValue(property),
        priority: element.style.getPropertyPriority(property)
      });
    }
    element.style.setProperty(property, next, 'important');

    state.data = typography.getTypographyData(element);
    renderPanel();
    state.panel.setEdited(true);
    updateLayout();
    return true;
  }

  function revertElement(element) {
    const originals = state.edits.get(element);
    if (!originals) return;
    for (const [property, original] of originals) {
      if (original.value) element.style.setProperty(property, original.value, original.priority);
      else element.style.removeProperty(property);
    }
    if (!element.getAttribute('style')) element.removeAttribute('style'); // leave no empty style="" behind
    state.edits.delete(element);
  }

  function resetEdits() {
    if (!state.element) return;
    revertElement(state.element);
    state.data = typography.getTypographyData(state.element);
    renderPanel();
    state.panel.setEdited(false);
    if (state.editing) state.panel.setEditing(true, state.data, state.settings.properties);
    updateLayout();
    state.panel.toast('Edits reset');
  }

  function revertAllEdits() {
    for (const element of Array.from(state.edits.keys())) revertElement(element);
  }

  // ---------------------------------------------------------------------
  // Panel actions
  // ---------------------------------------------------------------------

  async function copyAndReport(button, text, successMessage) {
    if (!state.panel) return;
    const ok = await state.panel.copyText(text);
    if (!state.panel) return; // inspector was closed while copying
    if (ok) {
      if (button) state.panel.flashCopied(button);
      state.panel.toast(successMessage);
    } else {
      state.panel.toast('Copy failed. Please try again.', 'error');
    }
  }

  function copyCSS() {
    if (!state.data) return;
    let css = typography.buildCSS(state.data, state.settings.properties);
    if (state.settings.copyAsRule && state.info) css = typography.wrapRule(css, state.info.selector);
    copyAndReport(state.panel.buttons.copyCss, css, 'CSS copied');
  }

  function copyFontInfo() {
    if (!state.data) return;
    const info = typography.buildInfo(state.data, state.info, state.settings.properties);
    copyAndReport(state.panel.buttons.copyInfo, info, 'Font info copied');
  }

  function copySelector() {
    if (!state.info || !state.info.selector) return;
    copyAndReport(state.panel.buttons.copySelector, state.info.selector, 'Selector copied');
  }

  function copyColor(text) {
    if (text) copyAndReport(null, text, 'Color copied');
  }

  // ---------------------------------------------------------------------
  // Messages from the background service worker
  // ---------------------------------------------------------------------

  function respondWithStatus(sendResponse) {
    sendResponse({ ok: true, active: state.active, edited: state.edits.size > 0 });
  }

  function start(sendResponse) {
    startInspector()
      .then(() => respondWithStatus(sendResponse))
      .catch(() => sendResponse({ ok: false, error: ERRORS.START_FAILED }));
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message && message.type) {
      case MESSAGES.START_INSPECTOR:
        start(sendResponse);
        return true; // answer asynchronously
      case MESSAGES.STOP_INSPECTOR:
        stopInspector();
        respondWithStatus(sendResponse);
        return false;
      case MESSAGES.REMOVE_LAYERS:
        removeLayers();
        respondWithStatus(sendResponse);
        return false;
      case MESSAGES.TOGGLE_INSPECTOR:
        if (state.active) {
          stopInspector();
          respondWithStatus(sendResponse);
          return false;
        }
        start(sendResponse);
        return true;
      case MESSAGES.GET_STATUS:
        respondWithStatus(sendResponse);
        return false;
      default:
        return false;
    }
  });
})();
