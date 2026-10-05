/*
 * Popup logic: shows the inspector's state for the current tab and starts or
 * stops it. The popup never touches the page directly; it asks the
 * background service worker, which injects the inspector when needed.
 */
(function () {
  const { MESSAGES, ERRORS, ERROR_TEXT, COMMAND_TOGGLE, DEFAULT_SHORTCUT } = window.AlphaFonts.constants;
  const { isRestrictedUrl } = window.AlphaFonts.utils;

  const toggleButton = document.getElementById('toggle');
  const helper = document.getElementById('helper');
  const errorBox = document.getElementById('error');
  const status = document.getElementById('status');
  const statusText = document.getElementById('status-text');
  const shortcutKeys = document.getElementById('shortcut-keys');
  const shortcutNote = document.getElementById('shortcut-note');

  let currentTab = null;
  let inspecting = false;

  // ----- Rendering -----

  function setStatus(state, label) {
    status.setAttribute('data-state', state);
    statusText.textContent = label;
  }

  function showError(text) {
    errorBox.textContent = text;
    errorBox.hidden = !text;
  }

  function renderReady() {
    inspecting = false;
    setStatus('ready', 'Ready');
    toggleButton.disabled = false;
    toggleButton.textContent = 'Start Inspecting';
    toggleButton.removeAttribute('data-mode');
    helper.hidden = false;
  }

  function renderInspecting() {
    inspecting = true;
    setStatus('ready', 'Inspecting');
    toggleButton.disabled = false;
    toggleButton.textContent = 'Stop Inspecting';
    toggleButton.setAttribute('data-mode', 'stop');
    helper.hidden = false;
  }

  function renderUnavailable(errorCode) {
    inspecting = false;
    setStatus('unavailable', 'Unavailable');
    toggleButton.disabled = true;
    toggleButton.textContent = 'Start Inspecting';
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

    if (!shortcut) {
      shortcutKeys.replaceChildren();
      shortcutNote.textContent = 'Not set. ';
      const link = document.createElement('a');
      link.href = '#';
      link.textContent = 'Choose a shortcut';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
      });
      shortcutNote.append(link);
      return;
    }

    shortcutKeys.replaceChildren();
    // Windows/Linux look like "Alt+Shift+F"; macOS uses one symbol per key.
    const parts = shortcut.includes('+') ? shortcut.split('+') : Array.from(shortcut);
    for (const part of parts.map((p) => p.trim()).filter(Boolean)) {
      const key = document.createElement('kbd');
      key.textContent = part;
      shortcutKeys.append(key);
    }
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
      renderReady();
      return showError(ERROR_TEXT[reply.error] || ERROR_TEXT[ERRORS.START_FAILED]);
    }
    if (reply.active) {
      window.close(); // get out of the way so the person can start hovering
    } else {
      renderReady();
    }
  }

  async function init() {
    renderShortcut();
    toggleButton.addEventListener('click', onToggleClick);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    if (!tab || isRestrictedUrl(tab.url)) return renderUnavailable(ERRORS.RESTRICTED_PAGE);

    const reply = await request(MESSAGES.GET_STATUS);
    if (!reply.ok) return renderUnavailable(reply.error);
    if (reply.active) renderInspecting();
    else renderReady();
  }

  init();
})();
