# Microsoft Edge Add-ons listing: copy and paste

Upload file: `releases/alphafonts-font-inspector-2.5.1-chrome.zip`
(rebuild it any time with `node tools/package.js chrome`).
Edge is built on Chromium, so it takes the same package as Chrome and Opera.

Submit at: https://partner.microsoft.com/dashboard/microsoftedge/overview
(sign in with a Microsoft account and register as a developer: it is free for extensions).

## Name
AlphaFonts Font Inspector

## Category
Developer Tools

## Description (Edge needs at least 250 characters)
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
- It cannot run on Edge's own pages or the add-ons store (a browser rule for all extensions).
- Only the main page is inspected; text inside iframes is not.

Made by AlphaFonts: https://alphafonts.com

## Search terms (up to 7)
font inspector
font finder
typography
css inspector
text styles
color contrast checker
web design tools

## Images
| Edge asks for | File |
| --- | --- |
| Extension logo (300x300) | `screenshots/store/edge/logo-300x300.png` |
| Screenshots (1280x800, up to 10) | `screenshots/store/1-inspect-and-copy.png`, `2-label-all-text.png`, `3-edit-contrast-sliders.png`, `4-popup-and-settings.png` |
| Small promotional tile (440x280, optional) | `screenshots/store/edge/small-tile-440x280.png` |
| Large promotional tile (1400x560, optional) | `screenshots/store/edge/large-tile-1400x560.png` |

## Website / support
https://alphafonts.com

## Privacy policy link
Edge asks for a public link. The policy text is in `PRIVACY.md`. Best: publish it on your own site (for example alphafonts.com/privacy). Otherwise, if the repository is public, use:
https://github.com/tauseeq7/alphafonts-chrome-extension/blob/claude/amazing-brahmagupta-ovgzln/PRIVACY.md

## Questions the form may ask
- Does the extension collect or transmit personal information or browsing data? **No.**
- Does it use remote code? **No.** All code is in the package.
- Pricing: **Free.**
- Markets: all, unless you want to limit them.
- Visibility: **Public** (or Hidden to share only by link).

## Notes for certification (paste into the notes for testers)
How to test: open any normal web page, click the AlphaFonts toolbar button, press "Start Inspecting", hover over text (a highlight and panel appear), click a text to lock it, then try "Copy CSS" and "Edit values". The popup's "Label all text on page" button labels every text element; "Remove layers" clears everything. No account or login is needed.

Permissions: "activeTab" and "scripting" inject the inspector into the current tab only when the user clicks the button, uses the shortcut, or uses the context menu. "contextMenus" adds the "AlphaFonts > Inspect Font" item. "storage" saves the user's settings locally. No host permissions are requested. No remote code, no minification, no third-party libraries. Source: https://github.com/tauseeq7/alphafonts-chrome-extension
