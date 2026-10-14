# Firefox Add-ons (AMO) listing: copy and paste

Upload file: `releases/alphafonts-font-inspector-2.5.1-firefox.zip`
(rebuild it any time with `node tools/package.js firefox`).

## Name
AlphaFonts Font Inspector

## Add-on URL (slug)
alphafonts-font-inspector

## Summary (max 250 characters)
Inspect fonts, typography and colors on any webpage. Hover to see the details, click to lock, copy the CSS, edit values live, check contrast, and label every text element at once. Runs locally. No account, no tracking.

## Description
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
- Right-click menu, keyboard shortcut, and an options page.

PRIVATE BY DESIGN
Everything runs on your computer. The extension collects no data, makes no network requests, has no accounts and no analytics. Your settings (theme and chosen properties) are stored locally in your browser. Source code is plain, readable JavaScript.

NOTES
- It cannot run on Firefox's own pages or on addons.mozilla.org (a Firefox rule for all extensions).
- Only the main page is inspected; text inside iframes is not.

Made by AlphaFonts: https://alphafonts.com

## Categories (pick up to 3)
- Web Development
- Appearance (optional)

## Tags (optional)
fonts, typography, css, font inspector, designer, developer tools, color, contrast

## Support site
https://alphafonts.com

## Support email
(use your own address: AMO shows it publicly)

## License
MIT License (the file is in the repository: LICENSE)

## Privacy policy (paste into the privacy policy box)
AlphaFonts Font Inspector does not collect, store or transmit any personal data or browsing data. All inspection happens locally in your browser, only after you start it, and only on the page you chose. The only information the extension saves is your own settings (theme, chosen properties and switches), stored locally with the browser's extension storage. Nothing is sent to AlphaFonts or to any third party. The extension makes no network requests of its own.

## Notes to reviewer (paste into "Notes to Reviewer")
How to test: open any normal web page, click the AlphaFonts toolbar button, press "Start Inspecting", hover over text (a highlight and panel appear), click a text to lock it, then try "Copy CSS", "Edit values" and "Copy changes". The popup's "Label all text on page" button labels every text element; "Remove layers" clears everything.

Permissions: "activeTab" and "scripting" are used to inject the inspector into the current tab only when the user clicks the button, uses the shortcut, or uses the context menu. "contextMenus" adds the "AlphaFonts > Inspect Font" item. "storage" saves the user's settings locally. No host permissions are requested.

There is no remote code, no minification, no obfuscation, no build step, and no third-party libraries. The submitted files are exactly the source files in the repository (https://github.com/tauseeq7/alphafonts-chrome-extension). The only difference from the Chrome version is manifest.json (background scripts instead of a service worker, plus browser_specific_settings), produced by firefox/package.js.

The panel is rendered inside a closed Shadow DOM so page styles cannot affect it. All page text is written with textContent, never innerHTML.

## Screenshots to upload (from the screenshots folder)
1. popup.png
2. inspector-locked.png
3. inspector-edit.png
4. page-labels.png

## Version release notes
First release on Firefox: hover inspection, click to lock, copy CSS/info/selector, page-wide labels, live editing with sliders and unit converters, contrast checker, light and dark themes.
