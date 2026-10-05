/*
 * AlphaFonts Font Inspector - background service worker.
 *
 * Responsibilities:
 *  - create the right-click menu
 *  - handle the keyboard shortcut
 *  - inject the inspector into a tab only when the user asks for it
 *  - relay popup requests to the page and report problems clearly
 *  - show a small "ON" badge while the inspector is running
 */
importScripts('../shared/constants.js', '../shared/utils.js');

const { MESSAGES, ERRORS, COMMAND_TOGGLE } = self.AlphaFonts.constants;
const { isRestrictedUrl } = self.AlphaFonts.utils;

const MENU_PARENT_ID = 'alphafonts';
const MENU_INSPECT_ID = 'alphafonts-inspect';
const PANEL_CSS_PATH = 'src/content/inspector.css';
const CONTENT_FILES = [
  'src/shared/constants.js',
  'src/shared/utils.js',
  'src/content/typography.js',
  'src/content/panel.js',
  'src/content/content.js'
];

// ---------------------------------------------------------------------
// Right-click menu:  AlphaFonts > Inspect Font
// ---------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_PARENT_ID, title: 'AlphaFonts', contexts: ['all'] });
    chrome.contextMenus.create({
      id: MENU_INSPECT_ID,
      parentId: MENU_PARENT_ID,
      title: 'Inspect Font',
      contexts: ['all']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_INSPECT_ID && tab) {
    runOnTab(tab, MESSAGES.START_INSPECTOR);
  }
});

// ---------------------------------------------------------------------
// Keyboard shortcut (Alt + Shift + F by default)
// ---------------------------------------------------------------------

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === COMMAND_TOGGLE && tab) {
    runOnTab(tab, MESSAGES.TOGGLE_INSPECTOR);
  }
});

// ---------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message.type !== 'string') return false;

  switch (message.type) {
    // From the popup: { type, tabId }
    case MESSAGES.START_INSPECTOR:
    case MESSAGES.STOP_INSPECTOR:
    case MESSAGES.TOGGLE_INSPECTOR:
    case MESSAGES.GET_STATUS:
      handlePopupRequest(message).then(sendResponse);
      return true;

    // From the content script
    case MESSAGES.INSPECTOR_STARTED:
      if (sender.tab) setBadge(sender.tab.id, true);
      return false;
    case MESSAGES.INSPECTOR_STOPPED:
      if (sender.tab) setBadge(sender.tab.id, false);
      return false;
    case MESSAGES.GET_PANEL_STYLES:
      readPanelStyles().then(sendResponse);
      return true;

    default:
      return false;
  }
});

async function readPanelStyles() {
  try {
    const response = await fetch(chrome.runtime.getURL(PANEL_CSS_PATH));
    return { ok: true, css: await response.text() };
  } catch (e) {
    return { ok: false };
  }
}

async function handlePopupRequest(message) {
  try {
    const tab = await chrome.tabs.get(message.tabId);
    if (message.type === MESSAGES.GET_STATUS) return await getStatus(tab);
    return await sendToTab(tab, message.type);
  } catch (e) {
    return { ok: false, error: ERRORS.START_FAILED };
  }
}

// ---------------------------------------------------------------------
// Talking to a tab
// ---------------------------------------------------------------------

/** Is the inspector loaded in this tab, and is it running? Never injects anything. */
async function getStatus(tab) {
  if (isRestrictedUrl(tab.url)) return { ok: false, error: ERRORS.RESTRICTED_PAGE };
  try {
    const reply = await chrome.tabs.sendMessage(tab.id, { type: MESSAGES.GET_STATUS });
    return { ok: true, active: !!(reply && reply.active) };
  } catch (e) {
    // Not injected yet: that is normal. But Chrome hides the URL of some pages
    // (e.g. chrome://), so if we cannot read it, check that scripts are allowed here.
    if (!tab.url && !(await canRunScripts(tab.id))) return { ok: false, error: ERRORS.RESTRICTED_PAGE };
    return { ok: true, active: false };
  }
}

/** Runs a do-nothing script to find out whether Chrome allows extensions on this tab. */
async function canRunScripts(tabId) {
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: () => true });
    return true;
  } catch (e) {
    return false;
  }
}

/** Sends a command to the page, injecting the inspector first if it is not there yet. */
async function sendToTab(tab, type) {
  if (isRestrictedUrl(tab.url)) return { ok: false, error: ERRORS.RESTRICTED_PAGE };

  try {
    return await chrome.tabs.sendMessage(tab.id, { type });
  } catch (e) {
    // No inspector in the page yet: inject it below.
  }

  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES });
  } catch (e) {
    return { ok: false, error: classifyInjectionError(e) };
  }

  try {
    const reply = await chrome.tabs.sendMessage(tab.id, { type });
    return reply || { ok: false, error: ERRORS.START_FAILED };
  } catch (e) {
    return { ok: false, error: ERRORS.START_FAILED };
  }
}

/** Chrome refuses to inject into some pages; those errors mean "restricted", not "broken". */
function classifyInjectionError(error) {
  const text = String((error && error.message) || error);
  const restricted = /cannot access|extensions gallery|cannot be scripted|chrome:\/\/|chrome-extension:\/\//i.test(text);
  return restricted ? ERRORS.RESTRICTED_PAGE : ERRORS.START_FAILED;
}

/** Used by the shortcut and right-click menu, which have no popup to show errors in. */
async function runOnTab(tab, type) {
  const result = await sendToTab(tab, type);
  if (!result.ok) flashErrorBadge(tab.id, result.error);
}

// ---------------------------------------------------------------------
// Toolbar badge
// ---------------------------------------------------------------------

function setBadge(tabId, on) {
  chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' }).catch(() => {});
  if (on) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#3DD6B0' }).catch(() => {});
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color: '#0D1117' }).catch(() => {});
  }
}

/** A short "!" on the toolbar icon tells the user the shortcut/menu could not run here. */
function flashErrorBadge(tabId, errorCode) {
  const text = self.AlphaFonts.constants.ERROR_TEXT[errorCode] || '';
  chrome.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#F85149' }).catch(() => {});
  chrome.action.setTitle({ tabId, title: text }).catch(() => {});
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'AlphaFonts Font Inspector' }).catch(() => {});
  }, 3000);
}
