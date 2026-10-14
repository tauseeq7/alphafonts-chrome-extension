# Opera Add-ons listing: copy and paste

Upload file: `releases/alphafonts-font-inspector-2.5.1-chrome.zip`
(rebuild it any time with `node tools/package.js chrome`).
Opera is built on Chromium, so it takes the same package as the Chrome Web Store.

Submit at: https://addons.opera.com/developer/ (sign in with your Opera account).

## Name
AlphaFonts Font Inspector

## Short description / summary
Inspect fonts, typography and colors on any webpage. Hover to see the details, click to lock, copy the CSS, edit values live, check contrast, and label every text element at once. Runs locally. No account, no tracking.

## Long description
AlphaFonts Font Inspector shows you the typography behind any webpage in seconds.

HOW IT WORKS
1. Click the AlphaFonts button (or press Alt+Shift+F) and choose "Start Inspecting".
2. Hover over any text to see its font, size, weight, line height, letter spacing and color.
3. Click to lock the panel, then copy the CSS, a plain-text summary, or the element's selector.

WHAT YOU GET
- Font family stack, size, weight, style, line height, letter and word spacing, alignment, transform, decoration and color (HEX or RGB, transparency kept).
- "Label all text on page": a small label above every text element showing the properties you choose.
- Live editing: try a new size, weight, color and more on the page, with sliders and px / rem / em / unitless converters.
- Contrast checker with WCAG AA and AAA results and a one-click suggested passing color.
- "Copy changes" copies only what you edited. Every edited field has its own undo.
- Choose which properties to show, copy, and label. Light and dark themes.
- Right-click menu (can be turned off), keyboard shortcut, and an options page.

PRIVATE BY DESIGN
Everything runs on your computer. The extension collects no data, makes no network requests, has no accounts and no analytics. Your settings (theme and chosen properties) are stored locally in your browser.

NOTES
- It cannot run on Opera's own pages or the add-ons store (a browser rule for all extensions).
- Only the main page is inspected; text inside iframes is not.

Made by AlphaFonts: https://alphafonts.com

## Category
Pick the closest one offered, for example Developer Tools (or Productivity).

## Icon
`src/icons/icon128.png` (128x128), or `screenshots/logo.png` (512x512) if a larger icon is accepted.

## Screenshots (1280x800, from `screenshots/store/`)
1. `1-inspect-and-copy.png`
2. `2-label-all-text.png`
3. `3-edit-contrast-sliders.png`
4. `4-popup-and-settings.png`

## Website / support
https://alphafonts.com

## Privacy policy link
The policy text is in `PRIVACY.md`. Use a public link to it, for example the file on GitHub:
https://github.com/tauseeq7/alphafonts-chrome-extension/blob/claude/amazing-brahmagupta-ovgzln/PRIVACY.md
(better: publish the same text on your own site, for example alphafonts.com/privacy, and use that link)

## Notes for moderators (if the form has a notes field)
How to test: open any normal web page, click the AlphaFonts toolbar button, press "Start Inspecting", hover over text (a highlight and panel appear), click a text to lock it, then try "Copy CSS" and "Edit values". The popup's "Label all text on page" button labels every text element; "Remove layers" clears everything.

Permissions: "activeTab" and "scripting" inject the inspector into the current tab only when the user clicks the button, uses the shortcut, or uses the context menu. "contextMenus" adds the "AlphaFonts > Inspect Font" item. "storage" saves the user's settings locally. No host permissions are requested. No remote code, no minification, no third-party libraries. Source: https://github.com/tauseeq7/alphafonts-chrome-extension
