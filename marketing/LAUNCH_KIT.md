# AlphaFonts Font Inspector: backlink and launch kit

Replace these placeholders before posting:
- `[CHROME_URL]` your Chrome Web Store link
- `[FIREFOX_URL]`, `[EDGE_URL]`, `[OPERA_URL]` the other store links (leave out any that are not approved yet)
- `[VIDEO_URL]` is already https://youtu.be/B7bScxgkS6s

Golden rules (these protect your account and your links):
1. Post only where you are a real participant. Reply to comments for at least 24 hours.
2. Never ask for upvotes, and never use fake accounts or paid reviews. Reddit, Hacker News and Product Hunt ban for it, and the links get removed.
3. Do not post to every site on the same day. Follow the schedule at the bottom.
4. Every post links to alphafonts.com first, and the store second. Your goal is backlinks to your own domain.

---

## 1. Short descriptions (reuse everywhere)

**One line (under 60 characters):** Find any website's font, size and color in 1 click.

**Tagline (under 100 characters):** Free, private font inspector that copies the CSS, checks contrast and labels every text on a page.

**Two sentences:** AlphaFonts Font Inspector is a free browser extension. Hover over any text on any website to see its font, size, weight, spacing and color, then copy the CSS, try new values live, and check the contrast.

---

## 2. Product Hunt

Launch only after Chrome is approved and at least one other store is live.

- **Name:** AlphaFonts Font Inspector
- **Tagline:** Find any website's font in 1 click (free and private)
- **Topics:** Developer Tools, Design Tools, Chrome Extensions, Typography
- **Links:** alphafonts.com first, then the store links
- **Gallery:** the 4 images in `screenshots/store/` plus the YouTube video
- **Thumbnail:** `src/icons/icon128.png` or `screenshots/logo.png`

**Description (260 characters):**
Hover over any text to see its font, size, weight and color. Click to copy the CSS, try new values with sliders, check WCAG contrast, or label every text on the page. Free, no account, nothing leaves your browser.

**First comment (post it yourself right after launch):**
> Hi Product Hunt! I'm [YOUR NAME], the maker of AlphaFonts Font Inspector.
>
> I built this because finding the font and size of a text on a website took too many steps in the browser tools. With this extension you hover, click, and copy the CSS.
>
> What it does:
> - Shows font family, size, weight, spacing and color of any text
> - Copies CSS, a text summary or the selector
> - Lets you try new sizes, weights and colors live, with sliders and unit converters
> - Checks WCAG contrast and suggests a passing color
> - Labels every text on the page at once
>
> It is free, has no account and no tracking, and everything runs on your computer. It works on Chrome, Firefox, Edge and Opera.
>
> I would love honest feedback: which feature would you use most, and what is missing?

Tips: launch on a Tuesday, Wednesday or Thursday at 12:01 AM Pacific time. Reply to every comment. Do not ask people to upvote.

---

## 3. AlternativeTo (high-authority backlink)

Create an account, click "Add application".
- **Name:** AlphaFonts Font Inspector
- **Website:** https://alphafonts.com
- **Platforms:** Chrome, Firefox, Edge, Opera
- **License:** Free (and Open Source, if your repository is public under the MIT license)
- **Tags:** font, typography, css, web design, developer tools
- **Description:** use the "Two sentences" text above plus the feature list below
- **Mark as alternative to:** WhatFont, Fonts Ninja, CSS Peeper, Font Finder, Fontanello

---

## 4. Show HN (Hacker News)

Title (no hype words, no emoji):
```
Show HN: AlphaFonts Font Inspector – hover over any text to see and copy its CSS
```
URL: your GitHub repository (HN prefers code you can read) or alphafonts.com.

First comment:
> I made a small browser extension for inspecting typography. Hover over text to see its font stack, size, weight, spacing and color; click to lock it and copy the CSS; edit values live; check WCAG contrast; or label every text node on the page.
>
> It is vanilla JavaScript, Manifest V3, no dependencies, no build step. The UI is in a closed shadow root so it does not clash with page styles. It requests only activeTab, scripting, contextMenus and storage, with no host permissions, and it makes no network requests.
>
> Known limits: it does not inspect inside iframes, and the "rendered font" line is a width-comparison guess because browsers do not say which font file was drawn. Feedback on the design and permissions is welcome.

Rules: do not ask for votes, answer every technical question honestly, post once. Best time: weekday morning US Eastern.

---

## 5. Reddit

Read each community's rules first. Many only allow self-promotion in a weekly thread or with a certain account age. When in doubt, message the moderators.

**r/webdev** (use the "Showoff Saturday" thread if rules require it)
> Title: I built a free font inspector extension that copies CSS and checks contrast
>
> I kept opening DevTools just to see which font and size a heading used, so I made an extension for it. Hover for the font, size, weight and color, click to copy the CSS, edit values live with sliders, and check WCAG contrast. It is free, open source and collects no data. Works on Chrome, Firefox, Edge and Opera. I would like feedback on what is missing. [link]

**r/web_design and r/typography**
> Title: Free tool to see the fonts, sizes and colors on any website
>
> Made this for designers who like to study how other sites set their type. Hover to see the font stack, size, line height and spacing, or label every text on the page at once. No account, nothing is tracked. [link]

**r/chrome_extensions**
> Title: AlphaFonts Font Inspector: find any website's font in 1 click
> (Short description + `[CHROME_URL]`. Ask what feature they would add.)

**r/Frontend, r/css:** use the r/webdev text, shortened. Post on different days.

---

## 6. dev.to / Hashnode / Medium article (strong backlink)

Title ideas (pick one):
1. How to Find the Font Any Website Is Using (3 Ways)
2. How I Built a Font Inspector Extension with Manifest V3 and Vanilla JS
3. How to Check Text Contrast on Any Website and Fix It in One Click

Outline for idea 1 (about 800 words, with screenshots from `screenshots/`):
1. Why you need to know a site's font (design inspiration, matching a brand, debugging)
2. Way 1: Browser DevTools, step by step (Inspect, Computed, Rendered Fonts)
3. Way 2: A font finder extension (introduce AlphaFonts Font Inspector, with the video `[VIDEO_URL]`)
4. Way 3: Identify a font from an image (mention tools honestly)
5. Copying the CSS and checking contrast
6. Get it: link to alphafonts.com and the stores

Set the "canonical URL" to a post on alphafonts.com if you publish it there first. Add 3 tags: `webdev`, `css`, `typography`.

---

## 7. GitHub and GitLab

Repository settings (if the repository is public):
- **Description:** Free browser extension to inspect fonts, copy CSS and check contrast on any website
- **Website:** https://alphafonts.com
- **Topics:** `font-inspector`, `chrome-extension`, `firefox-addon`, `typography`, `css`, `web-design`, `wcag`, `manifest-v3`, `browser-extension`, `developer-tools`
- Create a **Release** `v2.5.1` and attach `releases/alphafonts-font-inspector-2.5.1-chrome.zip` and the Firefox zip.
- Add store badges to the README once links exist.
- Create a GitLab project, set "Mirroring" to push from GitHub, and put the same description and topics.

**Awesome lists** (pull request with one line each; read each list's contributing rules):
- Search GitHub for `awesome-chrome-extensions`, `awesome-web-typography`, `awesome-design-tools`, `awesome-developer-tools`.
- Line to add: `- [AlphaFonts Font Inspector](https://alphafonts.com) - Hover over any text to see its font, size and color, copy CSS, and check contrast.`

---

## 8. Other directories (free, do 2 per day)

| Site | What to submit |
| --- | --- |
| SourceForge | Project with a link to the downloads |
| Softpedia, MajorGeeks | Software submission form (they review manually) |
| BetaList, Uneed, Peerlist | Launch page, same text as Product Hunt |
| Indie Hackers | "Show IH" post about building and publishing to 4 stores |
| Slant, Stackshare | Add it to "best font tools" lists |
| Crunchbase, LinkedIn page | Company or product profile with the website link |
| Dribbble, Behance | Post the 4 store images as a case study |

---

## 9. Social posts

**LinkedIn** (post from your page, tag it #webdesign #typography):
> Ever wondered what font a website uses? 
> I built AlphaFonts Font Inspector: hover over any text to see its font, size and color, then copy the CSS in one click. It can also check contrast and label every text on a page.
> Free. No account. Nothing leaves your browser.
> Demo video: [VIDEO_URL]
> Get it: https://alphafonts.com

**X (Twitter) thread**
1. > Find any website's font in 1 click. I made a free extension for it. [VIDEO_URL]
2. > Hover for font, size, weight and color. Click to copy the CSS.
3. > Try new sizes live with sliders. Check WCAG contrast and get a passing color in one click.
4. > Free, private, no account. Chrome, Firefox, Edge and Opera: https://alphafonts.com

**Pinterest:** make pins from the 4 store screenshots. Title "How to find any website's font", link to alphafonts.com.

---

## 10. Answers that bring long-term traffic

Search Google and Reddit for these questions and write helpful, complete answers. Mention the extension only as one option, after explaining DevTools:
- "what font is this website using"
- "how to find font of a website"
- "chrome extension to see fonts on a page"
- "how to check text contrast on a website"

Sites: Stack Overflow, Stack Exchange (Graphic Design, Webmasters), Quora, Reddit. A link in a useful answer lasts for years; a bare link gets deleted.

---

## 11. Three-week schedule

| Day | Do this |
| --- | --- |
| Before launch | Verify alphafonts.com in Search Console. Publish the privacy page. Make the GitHub repository public. |
| Day 1 | Chrome approved: add the link everywhere (README, YouTube descriptions, GitHub). Post on LinkedIn and X. |
| Day 2 | AlternativeTo and SourceForge |
| Day 3 | dev.to or Hashnode article (idea 1) |
| Day 4 | Product Hunt launch (Tuesday to Thursday) |
| Day 5 | Reply to everyone. Post on r/chrome_extensions. |
| Day 7 | r/webdev (Showoff Saturday if required) |
| Day 8 | Show HN |
| Day 9 to 12 | Softpedia, MajorGeeks, BetaList, Uneed, Indie Hackers |
| Day 13 to 16 | r/web_design, r/typography, awesome-list pull requests |
| Day 17 to 21 | Write 5 helpful answers (section 10). Upload the Short. Ask early users for an honest review. |

## 12. Tracker (fill in as you go)

| Site | Posted on | Link | Backlink to alphafonts.com? |
| --- | --- | --- | --- |
| | | | |
