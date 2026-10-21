# alphafonts.com install page: ready-to-paste text

Suggested address: `https://alphafonts.com/font-inspector-extension/`
Add it to your main menu and footer, and link to it from every tool page and blog post that talks about fonts. Internal links help it rank, and every store listing should link to this page.

## SEO settings (paste into Yoast, Rank Math or your page settings)

| Field | Text |
| --- | --- |
| SEO title (under 60 characters) | Free Font Inspector Extension: Find Any Website Font |
| Meta description (under 155 characters) | Find the font, size, color and CSS of any text on any website in one click. Free browser extension for Chrome, Firefox and Edge. No account. |
| Focus keyword | font inspector extension |
| Other keywords to use naturally | font finder, what font is this website using, find website font, css font inspector, copy css |
| Image alt text, screenshot 1 | AlphaFonts Font Inspector showing a font, size and color panel over a webpage |
| Image alt text, screenshot 2 | Every text on a webpage labelled with its font and size |
| Image alt text, screenshot 3 | Live editing sliders and the color contrast checker |
| Image alt text, screenshot 4 | AlphaFonts Font Inspector popup with settings |

Images to upload: `screenshots/store/1-inspect-and-copy.png` to `4-popup-and-settings.png`. Embed the YouTube video `https://youtu.be/B7bScxgkS6s` (paste the link on its own line in WordPress and it embeds itself).

---

## PAGE TEXT

### H1 (one per page)
Free Font Inspector Extension: Find Any Website's Font in 1 Click

### Intro
Ever looked at a website and wondered, "What font is that?" AlphaFonts Font Inspector is a free browser extension that tells you. Hover over any text to see its font, size, weight, line height, letter spacing and color. Click it to copy the CSS and use it in your own project.

It is free, needs no account, and everything runs on your computer. Nothing is collected or sent anywhere.

### Install buttons (put these right under the intro)
- **Add to Chrome** → https://chromewebstore.google.com/detail/dajhgllngjmdpnceaankfkpmgnkaddbl
- **Add to Firefox** → https://addons.mozilla.org/en-US/firefox/addon/alphafonts-font-inspector/
- **Add to Edge** → https://microsoftedge.microsoft.com/addons/detail/alphafonts-font-inspector/phemihbipbdjbjdfbmanhbikllpbeblj
- Opera: add a fourth button when the Opera listing is approved.

Small text under the buttons: "Also works in Brave, Vivaldi and other Chromium browsers (install from the Chrome button)."

### Video (embed here)
Heading: **Watch it in 1 minute**

### H2: What you can do with it
- **See any font instantly.** Hover over text to see the font family, size, weight and style.
- **Copy the CSS.** Click to lock the panel, then copy clean CSS, a plain-text summary or the element's selector.
- **Label every text on a page.** One click puts a small label above each text with its font and size, so you can study a whole design at once.
- **Try changes live.** Use sliders and unit converters (px, rem, em) to test a new size, weight or color on the page. One click undoes it.
- **Check color contrast.** See the WCAG AA and AAA result against the real background, and get a suggested color that passes.
- **Copy only your changes.** The extension copies just the values you edited, and each one has its own undo.
- **Your way.** Choose which properties to show, switch HEX and RGB, pick light or dark mode, and use the keyboard shortcut Alt+Shift+F.

### H2: How to find the font of any website (3 steps)
1. **Install the extension** from the button above, then pin it to your toolbar.
2. **Click the AlphaFonts icon** and press "Start Inspecting" (or press Alt+Shift+F).
3. **Hover over any text** to see its font. Click it to lock the panel and copy the CSS.

### H2: Who it's for
- **Designers** who want to match or study a font, size and spacing on a site they admire.
- **Web developers** who need the exact CSS without opening the browser's developer tools.
- **SEO and accessibility teams** who check that text is readable and passes contrast rules.
- **Students and writers** who just want to know what font a page uses.

### H2: Private by design
- No account, no sign-up, no tracking.
- It makes no network requests and collects no data.
- It asks for only the permissions it needs: it runs on a tab only when you click it, it adds a right-click menu item, and it stores your settings on your own computer.
- The code is open and the privacy policy is short and plain: [link to your privacy page].

### H2: Frequently asked questions

**Is AlphaFonts Font Inspector really free?**
Yes. It is free to install and use, with no account or hidden limits.

**Which browsers does it work in?**
Chrome, Firefox and Edge today, plus other Chromium browsers such as Brave and Vivaldi.

**Can it tell me which font file the page loaded?**
It shows the font family names the page asks for, and a "likely rendered" guess by comparing text widths. Browsers do not say which font file was actually drawn, so the guess can be wrong with per-letter fallbacks.

**Does it work on every website?**
It works on normal web pages. Browsers do not let any extension run on their own pages (such as chrome:// pages), on the extension stores, or inside the built-in PDF viewer. It inspects the main page, not text inside iframes.

**Does it collect or sell my data?**
No. It collects nothing and has no analytics. Everything runs on your computer.

**Do my edits change the real website?**
No. Edits only change what you see in your own browser, and they disappear when you reload the page.

**How do I change the keyboard shortcut?**
Open your browser's extension shortcuts page. In Chrome and Edge, go to the extensions page and choose Keyboard shortcuts. In Firefox, use the gear icon in the Add-ons Manager and choose Manage Extension Shortcuts.

**Where can I report a problem or suggest a feature?**
Use the contact page on alphafonts.com or open an issue on GitHub (add the link once the repository is public).

### Closing call to action
Ready to find your next font? **Add AlphaFonts Font Inspector to your browser** (repeat the install buttons here) and explore more free font tools at AlphaFonts.

---

## Structured data for Google (paste into a "Custom HTML" block or your SEO plugin's schema field)

It tells Google this page is about a free software extension and lets it show richer results. I left out star ratings on purpose: add them only after real users review it, because fake ratings can get your site penalized.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "AlphaFonts Font Inspector",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "Chrome, Firefox, Edge",
  "description": "Free browser extension that shows the font, size, weight, spacing and color of any text on any webpage, copies the CSS, and checks color contrast.",
  "url": "https://alphafonts.com/font-inspector-extension/",
  "softwareVersion": "2.5.1",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
  "publisher": { "@type": "Organization", "name": "AlphaFonts", "url": "https://alphafonts.com" },
  "downloadUrl": "https://chromewebstore.google.com/detail/dajhgllngjmdpnceaankfkpmgnkaddbl"
}
</script>
```

For the FAQ rich result, add the FAQ block of your SEO plugin (Yoast and Rank Math both have one) and paste the questions and answers above.

---

## After publishing, in this order
1. Test the page: open it in a private window, check all three buttons, and check it on a phone.
2. In Google Search Console, use "URL inspection", paste the page address, and click "Request indexing".
3. Add the page link to: the Homepage and Support fields on the Chrome listing, the Firefox and Edge listings (website field), the YouTube video description, the GitHub repository website field, and every launch post in `marketing/LAUNCH_KIT.md`.
4. Add a "Font Inspector" link to your site's main menu and footer, and a link from each related blog post or tool page.
5. Keep the three store buttons in sync as new stores are approved.
