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
    $('showAllOnHover').checked = settings.showAllOnHover;
    $('hex').checked = settings.colorFormat === 'hex';
    $('copyAsRule').checked = settings.copyAsRule;
  }

  async function update(patch) {
    settings = await store.save(patch);
    render();
  }

  function setAll(value) {
    const properties = {};
    for (const { key } of store.PROPERTIES) properties[key] = value;
    update({ properties });
  }

  async function init() {
    for (const { key, label } of store.PROPERTIES) {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.dataset.key = key;
      box.addEventListener('change', () => update({ properties: { [key]: box.checked } }));
      const row = document.createElement('label');
      row.append(box, ' ' + label);
      $('props').append(row);
    }
    for (const radio of document.querySelectorAll('input[name="theme"]')) {
      radio.addEventListener('change', () => update({ theme: radio.value }));
    }
    $('showAllOnHover').addEventListener('change', (e) => update({ showAllOnHover: e.target.checked }));
    $('hex').addEventListener('change', (e) => update({ colorFormat: e.target.checked ? 'hex' : 'rgb' }));
    $('copyAsRule').addEventListener('change', (e) => update({ copyAsRule: e.target.checked }));
    $('props-all').addEventListener('click', () => setAll(true));
    $('props-none').addEventListener('click', () => setAll(false));
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
