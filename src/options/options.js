/* Options page: every control saves straight away (no Save button). */
(function () {
  const { COMMAND_TOGGLE, DEFAULT_SHORTCUT } = window.AlphaFonts.constants;
  const store = window.AlphaFonts.settings;
  const $ = (id) => document.getElementById(id);

  let settings = store.defaults();

  function render() {
    document.documentElement.setAttribute('data-theme', settings.theme);
    for (const radio of document.querySelectorAll('input[name="theme"]')) radio.checked = radio.value === settings.theme;
    for (const box of $('props').querySelectorAll('input')) box.checked = settings.properties[box.dataset.key];
    for (const box of $('label-props').querySelectorAll('input')) box.checked = settings.labelProperties[box.dataset.key];
    $('showAllOnHover').checked = settings.showAllOnHover;
    $('hex').checked = settings.colorFormat === 'hex';
    $('copyAsRule').checked = settings.copyAsRule;
    $('contextMenu').checked = settings.contextMenu;
  }

  async function update(patch) {
    settings = await store.save(patch);
    render();
  }

  function setAll(field, value) {
    const map = {};
    for (const { key } of store.PROPERTIES) map[key] = value;
    update({ [field]: map });
  }

  /** Builds a grid of checkboxes that edits settings[field] ('properties' or 'labelProperties'). */
  function buildChecks(container, field) {
    for (const { key, label } of store.PROPERTIES) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.key = key;
      box.addEventListener('change', () => update({ [field]: { [key]: box.checked } }));
      const row = document.createElement('label');
      row.append(box, ' ' + label);
      container.append(row);
    }
  }

  async function init() {
    buildChecks($('props'), 'properties');
    buildChecks($('label-props'), 'labelProperties');
    for (const radio of document.querySelectorAll('input[name="theme"]')) {
      radio.addEventListener('change', () => update({ theme: radio.value }));
    }
    $('showAllOnHover').addEventListener('change', (e) => update({ showAllOnHover: e.target.checked }));
    $('hex').addEventListener('change', (e) => update({ colorFormat: e.target.checked ? 'hex' : 'rgb' }));
    $('copyAsRule').addEventListener('change', (e) => update({ copyAsRule: e.target.checked }));
    $('contextMenu').addEventListener('change', (e) => update({ contextMenu: e.target.checked }));
    $('props-all').addEventListener('click', () => setAll('properties', true));
    $('props-none').addEventListener('click', () => setAll('properties', false));
    $('label-props-all').addEventListener('click', () => setAll('labelProperties', true));
    $('label-props-none').addEventListener('click', () => setAll('labelProperties', false));
    $('reset').addEventListener('click', async () => {
      settings = await store.reset();
      render();
    });
    $('change-shortcut').addEventListener('click', () => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' }));
    $('version').textContent = chrome.runtime.getManifest().version;

    try {
      const command = (await chrome.commands.getAll()).find((c) => c.name === COMMAND_TOGGLE);
      $('shortcut').textContent = command && command.shortcut ? command.shortcut.replace(/\+/g, ' + ') : 'not set';
    } catch (e) {
      $('shortcut').textContent = DEFAULT_SHORTCUT;
    }

    settings = await store.load();
    render();
    // Keep this page in sync when the popup or the in-page panel changes a setting.
    chrome.storage.onChanged.addListener((changes, area) => {
      const next = store.fromChange(changes, area);
      if (next) {
        settings = next;
        render();
      }
    });
  }

  init();
})();
