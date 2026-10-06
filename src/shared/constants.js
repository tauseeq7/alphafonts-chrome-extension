/*
 * Shared constants.
 *
 * This file is loaded by the popup, the background service worker and the
 * content script, so everything hangs off one global namespace: AlphaFonts.
 */
(function () {
  const root = globalThis;
  root.AlphaFonts = root.AlphaFonts || {};

  root.AlphaFonts.constants = {
    WEBSITE_URL: 'https://alphafonts.com',
    COMMAND_TOGGLE: 'toggle-inspector',
    DEFAULT_SHORTCUT: 'Alt + Shift + F',
    UNAVAILABLE: 'Unavailable',

    // Messages sent between popup, background and content script.
    MESSAGES: {
      // Requests (popup -> background -> content script)
      START_INSPECTOR: 'START_INSPECTOR',
      STOP_INSPECTOR: 'STOP_INSPECTOR',
      TOGGLE_INSPECTOR: 'TOGGLE_INSPECTOR',
      REMOVE_LAYERS: 'REMOVE_LAYERS',
      GET_STATUS: 'GET_STATUS',
      // Notifications (content script -> background)
      INSPECTOR_STARTED: 'INSPECTOR_STARTED',
      INSPECTOR_STOPPED: 'INSPECTOR_STOPPED',
      // Content script asks the background for the panel's stylesheet text.
      GET_PANEL_STYLES: 'GET_PANEL_STYLES'
    },

    // Error codes returned in { ok: false, error }.
    ERRORS: {
      RESTRICTED_PAGE: 'RESTRICTED_PAGE',
      START_FAILED: 'START_FAILED'
    },

    // Text shown to people when something goes wrong.
    ERROR_TEXT: {
      RESTRICTED_PAGE: "Font inspection isn't available on this page.",
      START_FAILED: 'Unable to start inspector on this page.'
    }
  };
})();
