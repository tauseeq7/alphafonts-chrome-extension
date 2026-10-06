/*
 * User settings, saved with chrome.storage.local (on the user's own computer).
 * Shared by the popup, the options page and the in-page inspector, so a change
 * in one place shows up in the others straight away.
 */
(function () {
  const AF = (globalThis.AlphaFonts = globalThis.AlphaFonts || {});

  const STORAGE_KEY = 'settings';
  const LEGACY_THEME_KEY = 'theme'; // version 2.0 saved only the theme, under this key

  // The properties people can show or hide. Order = order in the panel.
  const PROPERTIES = [
    { key: 'fontFamily', label: 'Font family' },
    { key: 'fontSize', label: 'Font size' },
    { key: 'fontWeight', label: 'Font weight' },
    { key: 'fontStyle', label: 'Font style' },
    { key: 'fontColor', label: 'Font color' },
    { key: 'lineHeight', label: 'Line height' },
    { key: 'letterSpacing', label: 'Letter spacing' },
    { key: 'wordSpacing', label: 'Word spacing' },
    { key: 'textAlign', label: 'Text align' },
    { key: 'textTransform', label: 'Text transform' },
    { key: 'textDecoration', label: 'Text decoration' }
  ];

  function defaults() {
    const properties = {};
    for (const p of PROPERTIES) properties[p.key] = true;
    return { theme: 'dark', colorFormat: 'hex', showAllOnHover: true, copyAsRule: false, properties };
  }

  /** Turns whatever is in storage into a complete, valid settings object. */
  function normalize(raw, legacyTheme) {
    const base = defaults();
    const saved = raw && typeof raw === 'object' ? raw : {};
    const theme = saved.theme === 'light' || saved.theme === 'dark' ? saved.theme : legacyTheme === 'light' ? 'light' : 'dark';
    const properties = {};
    for (const p of PROPERTIES) {
      const value = saved.properties && saved.properties[p.key];
      properties[p.key] = typeof value === 'boolean' ? value : base.properties[p.key];
    }
    return {
      theme,
      colorFormat: saved.colorFormat === 'rgb' ? 'rgb' : 'hex',
      showAllOnHover: saved.showAllOnHover !== false,
      copyAsRule: saved.copyAsRule === true,
      properties
    };
  }

  async function load() {
    try {
      const stored = await chrome.storage.local.get([STORAGE_KEY, LEGACY_THEME_KEY]);
      return normalize(stored[STORAGE_KEY], stored[LEGACY_THEME_KEY]);
    } catch (e) {
      return defaults();
    }
  }

  /** Saves part of the settings, e.g. save({ theme: 'light' }) or save({ properties: { fontSize: false } }). */
  async function save(patch) {
    const current = await load();
    const next = normalize({ ...current, ...patch, properties: { ...current.properties, ...(patch.properties || {}) } });
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: next });
    } catch (e) {
      // Not saved, but the caller still gets the new values to use right now.
    }
    return next;
  }

  async function reset() {
    const fresh = defaults();
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: fresh });
    } catch (e) {
      // Ignore: nothing to keep.
    }
    return fresh;
  }

  /** For chrome.storage.onChanged: returns the new settings, or null if they did not change. */
  function fromChange(changes, area) {
    if (area !== 'local' || !changes[STORAGE_KEY]) return null;
    return normalize(changes[STORAGE_KEY].newValue);
  }

  AF.settings = { PROPERTIES, defaults, normalize, load, save, reset, fromChange };
})();
