/*
 * AlphaFonts Font Inspector - content script.
 *
 * Injected on demand (popup button, keyboard shortcut or right-click menu).
 * It listens for the mouse while inspection is on, highlights the hovered
 * text element, shows the floating panel and lets the user lock it, copy
 * values and leave with Escape.
 */
(function () {
  const AF = (globalThis.AlphaFonts = globalThis.AlphaFonts || {});
  if (AF.inspectorLoaded) return; // already running in this page
  AF.inspectorLoaded = true;

  const { MESSAGES, ERRORS } = AF.constants;
  const typography = AF.typography;

  const THEME_KEY = 'theme';
  const CURSOR_STYLE_ID = 'alphafonts-inspector-cursor';
  // Mouse events we swallow while inspecting, so clicks never reach the page's own handlers.
  const BLOCKED_EVENTS = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'auxclick'];
  const SKIPPED_TAGS = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'];
  const WATCH_INTERVAL_MS = 400;

  const state = {
    active: false,
    locked: false,
    panel: null,
    element: null, // element currently shown in the panel
    data: null,
    info: null,
    colorFormat: 'hex',
    theme: 'dark',
    cursor: { x: 0, y: 0 },
    pendingTarget: null,
    needsHitTest: false, // re-find the element under the cursor (after scroll)
    needsLayout: false, // re-measure the highlight/panel (after scroll/resize)
    frame: 0,
    watchTimer: 0,
    watchedRect: '',
    cssText: null,
    starting: null
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
  // Theme (light / dark), remembered between pages and shared with the popup
  // ---------------------------------------------------------------------

  async function loadTheme() {
    try {
      const stored = await chrome.storage.local.get(THEME_KEY);
      state.theme = stored[THEME_KEY] === 'light' ? 'light' : 'dark';
    } catch (e) {
      state.theme = 'dark';
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    state.panel.setTheme(state.theme);
    try {
      chrome.storage.local.set({ [THEME_KEY]: state.theme });
    } catch (e) {
      // Not remembered, but it still works for this page.
    }
  }

  /** The popup can change the theme while the inspector is open. */
  function handleStorageChange(changes, area) {
    if (area !== 'local' || !changes[THEME_KEY] || !state.panel) return;
    state.theme = changes[THEME_KEY].newValue === 'light' ? 'light' : 'dark';
    state.panel.setTheme(state.theme);
  }

  // ---------------------------------------------------------------------
  // Start / stop
  // ---------------------------------------------------------------------

  async function startInspector() {
    if (state.active) return;
    if (!state.starting) {
      state.starting = (async () => {
        const css = await loadPanelStyles();
        await loadTheme();
        const panel = AF.createPanel({
          onCopyCSS: copyCSS,
          onCopyInfo: copyFontInfo,
          onCopySelector: copySelector,
          onCopyColor: copyColor,
          onColorFormat: setColorFormat,
          onThemeToggle: toggleTheme,
          onUnlock: unlock,
          onStop: stopInspector,
          onLayoutChange: updateLayout
        });
        panel.mount(css);
        panel.setTheme(state.theme);
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
    state.panel = null;
    state.element = null;
    state.data = null;
    state.info = null;
    state.pendingTarget = null;
    state.frame = 0;
    notify(MESSAGES.INSPECTOR_STOPPED);
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
    state.element = element;
    state.data = typography.getTypographyData(element);
    state.info = typography.describeElement(element);
    renderPanel();
    state.panel.showPanel(true);
    updateLayout();
  }

  function renderPanel() {
    state.panel.render({ data: state.data, element: state.info, colorFormat: state.colorFormat });
  }

  function lock() {
    if (!state.element) return;
    state.locked = true;
    state.info.selector = typography.generateSelector(state.element); // computed once, only when needed
    state.panel.setLocked(true);
    renderPanel();
    updateLayout();
    state.panel.focus();
    startWatching();
  }

  function unlock() {
    if (!state.locked) return;
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
    copyAndReport(state.panel.buttons.copyCss, typography.buildCSS(state.data), 'CSS copied');
  }

  function copyFontInfo() {
    if (!state.data) return;
    copyAndReport(state.panel.buttons.copyInfo, typography.buildInfo(state.data, state.info), 'Font info copied');
  }

  function copySelector() {
    if (!state.info || !state.info.selector) return;
    copyAndReport(state.panel.buttons.copySelector, state.info.selector, 'Selector copied');
  }

  function copyColor(text) {
    if (text) copyAndReport(null, text, 'Color copied');
  }

  function setColorFormat(format) {
    state.colorFormat = format === 'rgb' ? 'rgb' : 'hex';
    if (state.data) renderPanel();
  }

  // ---------------------------------------------------------------------
  // Messages from the background service worker
  // ---------------------------------------------------------------------

  function respondWithStatus(sendResponse) {
    sendResponse({ ok: true, active: state.active });
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
