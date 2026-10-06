/*
 * Popup logic: starts/stops the inspector for the current tab and edits the
 * user's settings. The popup never touches the page directly; it asks the
 * background service worker, which injects the inspector when needed.
 */
(function () {
  const { MESSAGES, ERRORS, ERROR_TEXT, COMMAND_TOGGLE, DEFAULT_SHORTCUT } = window.AlphaFonts.constants;
  const { isRestrictedUrl } = window.AlphaFonts.utils;
  const store = window.AlphaFonts.settings;

  const $ = (id) => document.getElementById(id);
  const toggleButton = $('toggle');
  const helper = $('helper');
  const errorBox = $('error');
  const status = $('status');
  const statusText = $('status-text');
  const shortcutKeys = $('shortcut-keys');
  const shortcutNote = $('shortcut-note');
  const themeToggle = $('theme-toggle');
  const chipsBox = $('chips');
  const removeButton = $('remove-layers');
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let currentTab = null;
  let inspecting = false;
  let settings = store.defaults();

  // ----- Theme -----

  function themeIcon(theme) {
    const icon = document.createElementNS(SVG_NS, 'svg');
    const set = (el, attrs) => Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    set(icon, {
      viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2,
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'
    });
    const add = (tag, attrs) => {
      const el = document.createElementNS(SVG_NS, tag);
      set(el, attrs);
      icon.append(el);
    };
    if (theme === 'dark') {
      // Dark now: show a sun, because the button switches to light.
      add('circle', { cx: 12, cy: 12, r: 4 });
      add('path', { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' });
    } else {
      add('path', { d: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z' });
    }
    return icon;
  }

  // ----- Settings UI -----

  function renderSettings() {
    const light = settings.theme === 'light';
    document.documentElement.setAttribute('data-theme', light ? 'light' : 'dark');
    const label = light ? 'Switch to dark mode' : 'Switch to light mode';
    themeToggle.setAttribute('aria-label', label);
    themeToggle.title = label;
    themeToggle.replaceChildren(themeIcon(light ? 'light' : 'dark'));

    for (const chip of chipsBox.children) {
      chip.setAttribute('aria-pressed', String(settings.properties[chip.dataset.key]));
    }
    $('sw-showall').setAttribute('aria-checked', String(settings.showAllOnHover));
    $('sw-hex').setAttribute('aria-checked', String(settings.colorFormat === 'hex'));
  }

  function buildChips() {
    for (const { key, label } of store.PROPERTIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.dataset.key = key;
      const box = document.createElement('span');
      box.className = 'chip-box';
      box.setAttribute('aria-hidden', 'true');
      chip.append(box, label);
      chip.addEventListener('click', () => update({ properties: { [key]: !settings.properties[key] } }));
      chipsBox.append(chip);
    }
  }

  function setAllProperties(value) {
    const properties = {};
    for (const { key } of store.PROPERTIES) properties[key] = value;
    update({ properties });
  }

  /** Shows the change right away, then saves it (the in-page panel updates from storage). */
  async function update(patch) {
    settings = store.normalize({ ...settings, ...patch, properties: { ...settings.properties, ...(patch.properties || {}) } });
    renderSettings();
    settings = await store.save(patch);
    renderSettings();
  }

  // ----- Status rendering -----

  function setStatus(state, label) {
    status.setAttribute('data-state', state);
    statusText.textContent = label;
  }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
  }

  function renderState({ active, edited }) {
    inspecting = !!active;
    setStatus('ready', active ? 'Inspecting' : 'Ready');
    toggleButton.disabled = false;
    toggleButton.textContent = active ? 'Stop Inspecting' : 'Start Inspecting';
    if (active) toggleButton.setAttribute('data-mode', 'stop');
    else toggleButton.removeAttribute('data-mode');
    helper.hidden = false;
    removeButton.disabled = !(active || edited);
  }

  function renderUnavailable(errorCode) {
    inspecting = false;
    setStatus('unavailable', 'Unavailable');
    toggleButton.disabled = true;
    toggleButton.textContent = 'Start Inspecting';
    removeButton.disabled = true;
    helper.hidden = true;
    showError(ERROR_TEXT[errorCode] || ERROR_TEXT[ERRORS.RESTRICTED_PAGE]);
  }

  // ----- Shortcut display -----

  /** Shows the shortcut Chrome actually has assigned (the user may have changed it). */
  async function renderShortcut() {
    let shortcut = DEFAULT_SHORTCUT;
    try {
      const commands = await chrome.commands.getAll();
      const command = commands.find((c) => c.name === COMMAND_TOGGLE);
      if (command) shortcut = command.shortcut;
    } catch (e) {
      // Keep the default text.
    }

    shortcutKeys.replaceChildren();
    shortcutNote.replaceChildren();
    if (shortcut) {
      // Windows/Linux look like "Alt+Shift+F"; macOS uses one symbol per key.
      const parts = shortcut.includes('+') ? shortcut.split('+') : Array.from(shortcut);
      for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
        const key = document.createElement('kbd');
        key.textContent = part;
        shortcutKeys.append(key);
      }
      shortcutNote.append(shortcut.replace(/\+/g, ' + ') + '. ');
    } else {
      shortcutKeys.append('no shortcut set');
      shortcutNote.append('Not set. ');
    }
    const link = document.createElement('a');
    link.href = '#';
    link.textContent = 'Change shortcut';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
    shortcutNote.append(link);
  }

  // ----- Talking to the background -----

  async function request(type) {
    try {
      const reply = await chrome.runtime.sendMessage({ type, tabId: currentTab.id });
      return reply || { ok: false, error: ERRORS.START_FAILED };
    } catch (e) {
      return { ok: false, error: ERRORS.START_FAILED };
    }
  }

  async function onToggleClick() {
    showError('');
    toggleButton.disabled = true;
    const reply = await request(inspecting ? MESSAGES.STOP_INSPECTOR : MESSAGES.START_INSPECTOR);
    if (!reply.ok) {
      if (reply.error === ERRORS.RESTRICTED_PAGE) return renderUnavailable(reply.error);
      renderState({ active: false });
      return showError(ERROR_TEXT[reply.error] || ERROR_TEXT[ERRORS.START_FAILED]);
    }
    if (reply.active) {
      window.close(); // get out of the way so the person can start hovering
    } else {
      renderState(reply);
    }
  }

  async function onRemoveLayers() {
    removeButton.disabled = true;
    const reply = await request(MESSAGES.REMOVE_LAYERS);
    renderState(reply.ok ? reply : { active: false });
  }

  async function init() {
    buildChips();
    settings = await store.load();
    renderSettings();
    renderShortcut();
    $('version').textContent = chrome.runtime.getManifest().version;

    themeToggle.addEventListener('click', () => update({ theme: settings.theme === 'light' ? 'dark' : 'light' }));
    $('props-all').addEventListener('click', () => setAllProperties(true));
    $('props-none').addEventListener('click', () => setAllProperties(false));
    $('sw-showall').addEventListener('click', () => update({ showAllOnHover: !settings.showAllOnHover }));
    $('sw-hex').addEventListener('click', () => update({ colorFormat: settings.colorFormat === 'hex' ? 'rgb' : 'hex' }));
    $('open-options').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
      window.close();
    });
    $('info-toggle').addEventListener('click', () => {
      const info = $('info');
      info.hidden = !info.hidden;
      $('info-toggle').setAttribute('aria-expanded', String(!info.hidden));
    });
    toggleButton.addEventListener('click', onToggleClick);
    removeButton.addEventListener('click', onRemoveLayers);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    if (!tab || isRestrictedUrl(tab.url)) return renderUnavailable(ERRORS.RESTRICTED_PAGE);

    const reply = await request(MESSAGES.GET_STATUS);
    if (!reply.ok) return renderUnavailable(reply.error);
    renderState(reply);
  }

  init();
})();
