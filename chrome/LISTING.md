# Chrome Web Store listing: copy and paste

Upload file: `releases/alphafonts-font-inspector-2.5.1-chrome.zip`
(rebuild any time with `node tools/package.js chrome`).

Developer dashboard: https://chrome.google.com/webstore/devconsole
(sign in with a Google account, pay the one-time US$5 registration fee, and verify your email).

## Step by step
1. Open the dashboard and click **Add new item**.
2. Upload the zip above.
3. Fill the tabs in this order: **Store listing**, **Privacy**, **Distribution**, **Test instructions**.
4. Click **Submit for review**. Reviews usually take from a few hours to a few days.

## STORE LISTING tab

### Name (from manifest)
AlphaFonts Font Inspector

### Summary (max 132 characters, from manifest)
Inspect fonts, typography, and CSS styles on any webpage.

### Description
AlphaFonts Font Inspector shows you the typography behind any webpage in seconds. It is a free font finder and CSS inspector for designers, developers and SEO teams.

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
- Choose which properties to show, copy and label. Light and dark themes.
- Right-click menu (can be turned off), keyboard shortcut, and an options page.

PRIVATE BY DESIGN
Everything runs on your computer. The extension collects no data, makes no network requests, has no accounts and no analytics. Your settings (theme and chosen properties) are stored locally in your browser.

GOOD TO KNOW
- It cannot run on Chrome's own pages or the Chrome Web Store (a browser rule for all extensions).
- Only the main page is inspected; text inside iframes is not.

Also available for Firefox, Opera and Edge. Made by AlphaFonts: https://alphafonts.com

### Category
Developer Tools

### Language
English

### Images
| Chrome asks for | File |
| --- | --- |
| Store icon 128x128 | `src/icons/icon128.png` |
| Screenshots 1280x800 (1 to 5) | `screenshots/store/1-inspect-and-copy.png`, `2-label-all-text.png`, `3-edit-contrast-sliders.png`, `4-popup-and-settings.png` |
| Small promo tile 440x280 (required) | `screenshots/store/edge/small-tile-440x280.png` |
| Marquee promo tile 1400x560 (optional) | `screenshots/store/edge/large-tile-1400x560.png` |
| Promo video (optional) | Upload `video/alphafonts-font-inspector-demo.mp4` to YouTube first, then paste its link |

### Official URL / Homepage URL / Support URL
- Homepage: https://alphafonts.com
- Support: https://github.com/tauseeq7/alphafonts-chrome-extension/issues
- Backlink tip: the "Official URL" dropdown only lists sites you have verified in Google Search Console with the same Google account. Verify alphafonts.com there first. Chrome then shows a "Verified" link to your site on the listing.

## PRIVACY tab

### Single purpose
Inspect and show the font, typography and CSS styles of text on the webpage the user is viewing, and let the user copy or try out those styles.

### Permission justifications
- **activeTab**: lets the inspector run on the current tab only after the user clicks the toolbar button, uses the shortcut, or uses the right-click menu. No browsing history is read.
- **scripting**: injects the inspector panel and styles into that tab when the user starts it.
- **contextMenus**: adds the "AlphaFonts > Inspect Font" right-click item (can be turned off in Options).
- **storage**: saves the user's own settings (theme, chosen properties, color format) locally in the browser.
- **Host permissions**: none requested.
- **Remote code**: No. All code is inside the package, with no minification or third-party libraries.

### Data usage (the form's checkboxes)
Leave **every data type unchecked**. The extension collects no user data.
Then tick all three certifications:
- I do not sell or transfer user data to third parties outside approved use cases.
- I do not use or transfer user data for purposes unrelated to the item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending.

### Privacy policy URL
Needs a public link. Best: publish `PRIVACY.md` at https://alphafonts.com/privacy. Otherwise use:
https://github.com/tauseeq7/alphafonts-chrome-extension/blob/claude/amazing-brahmagupta-ovgzln/PRIVACY.md

## DISTRIBUTION tab
- Visibility: **Public**
- Pricing: **Free**
- Regions: all regions

## TEST INSTRUCTIONS tab (paste)
No account or login is needed. Open any normal web page, click the AlphaFonts toolbar button, press "Start Inspecting", hover over text (a highlight and panel appear), click a text to lock it, then try "Copy CSS" and "Edit values". The popup's "Label all text on page" button labels every text element; "Remove layers" clears everything.

## After it is approved (backlinks and installs)
1. Copy the listing URL (https://chromewebstore.google.com/detail/...) and send it to me. I will add it to the README, the video description and the website plan.
2. Ask early users for honest reviews. Ratings drive Chrome's search ranking.
3. Add the link to: GitHub repository "Website" field, YouTube description, Product Hunt, AlternativeTo, Reddit and dev.to posts.
