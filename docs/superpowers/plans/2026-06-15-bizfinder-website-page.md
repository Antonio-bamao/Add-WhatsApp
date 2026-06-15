# BizFinder Website Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a polished bright `/bizfinder` marketing page and a discoverable BizFinder entry to the existing Add WhatsApp website.

**Architecture:** Keep the page inside the existing Next.js App Router website. Use a server page for metadata and a focused presentational component for the long landing page, with all page styles namespaced under `bizfinder-` and project assets stored below `website/public/bizfinder/`.

**Tech Stack:** Next.js 14 App Router, React 18, Lucide React, static CSS, Node test runner, Codex in-app Browser.

---

### Task 1: Lock The Public Website Contract

**Files:**
- Modify: `website/tests/website-structure.test.mjs`

- [ ] **Step 1: Write the failing route and navigation assertions**

Add assertions that:

```js
const bizFinderPage = readText("app/bizfinder/page.js");
const bizFinderExperience = readText("components/BizFinderPage.js");

assert.match(landingExperience, /href="\/bizfinder"/);
assert.match(bizFinderPage, /BizFinderPage/);
assert.match(bizFinderPage, /metadata/);
assert.match(bizFinderExperience, /从地图上，找到下一批海外客户/);
assert.match(bizFinderExperience, /立即下载/);
assert.match(bizFinderExperience, /bizfinder-logo-transparent\.png/);
assert.match(bizFinderExperience, /真实软件界面/);
```

- [ ] **Step 2: Run the structure test and verify RED**

Run: `npm test --prefix website`

Expected: FAIL because `app/bizfinder/page.js`, `components/BizFinderPage.js`, and the homepage navigation link do not exist.

- [ ] **Step 3: Keep the failing assertions focused**

Confirm the failure is caused by missing BizFinder files or missing route markup, not by syntax errors in the test.

### Task 2: Add Brand Assets And Page Structure

**Files:**
- Create: `website/app/bizfinder/page.js`
- Create: `website/components/BizFinderPage.js`
- Modify: `website/components/LandingExperience.js`
- Create: `website/public/bizfinder/bizfinder-logo-transparent.png`
- Create: `website/public/bizfinder/icon-512.png`
- Create: `website/public/bizfinder/bizfinder-app.png`

- [ ] **Step 1: Copy approved brand assets**

Copy the existing BizFinder horizontal logo and square transparent application icon from `H:\项目\BizFinder\src-tauri\icons\`.

- [ ] **Step 2: Capture or create the real application screenshot**

Use the current BizFinder application UI as the source. Save a clean image as `website/public/bizfinder/bizfinder-app.png`. Do not use the polished hero mockup as the “real software” image.

- [ ] **Step 3: Add the App Router page**

Create a server page that exports:

```js
export const metadata = {
  title: "BizFinder - Google 地图外贸获客工具",
  description:
    "BizFinder 帮助外贸销售团队从 Google Maps 搜索商家，整理公开电话、网站、地址与位置，并导出为可继续跟进的销售名单。"
};
```

Render `<BizFinderPage />`.

- [ ] **Step 4: Build the landing-page component**

Implement:

- Header with BizFinder logo, anchors, Add WhatsApp return link, and placeholder download button.
- Hero with the approved headline, value copy, and code-native polished map/results product mockup.
- Manual-work pain section.
- Search and collection workflow.
- Captured-field strip.
- Map/table linked-results section.
- Spain football-shop scenario.
- Pause, CAPTCHA, resume, deduplication, and logs section.
- CSV/Excel export and local-data section.
- Real application screenshot section.
- Closing CTA.

The placeholder download control must be a `<button type="button">`, not a broken file link.

- [ ] **Step 5: Add the homepage navigation entry**

Add:

```jsx
<Link href="/bizfinder">BizFinder</Link>
```

to the cinematic homepage navigation.

- [ ] **Step 6: Run the structure test and verify GREEN**

Run: `npm test --prefix website`

Expected: PASS.

### Task 3: Implement The Bright Map-Led Visual System

**Files:**
- Modify: `website/public/site.css`

- [ ] **Step 1: Add namespaced design tokens**

Define `.bizfinder-page` tokens for true white, pale blue, teal, cyan, amber, deep charcoal, borders, shadows, radii, and motion.

- [ ] **Step 2: Style the hero and product mockup**

Implement the approved A direction:

- White and pale-blue background.
- Teal brand accent derived from the existing BizFinder logo.
- Large concise Chinese headline.
- One primary CTA.
- A map-led product composition with markers, search controls, result rows, and progress.

- [ ] **Step 3: Style downstream sections with varied rhythm**

Use open sections, a horizontal field band, a split map/table area, a step timeline, and one framed real screenshot. Avoid repeating identical card grids.

- [ ] **Step 4: Add responsive behavior**

Verify layout rules at 1100px, 760px, and 520px. Keep body text at 16px or more on mobile, controls at least 44px high, and prevent horizontal overflow.

- [ ] **Step 5: Add accessibility and reduced-motion states**

Provide visible `:focus-visible`, hover/pressed states, adequate contrast, and `prefers-reduced-motion` overrides.

- [ ] **Step 6: Run tests and production build**

Run:

```powershell
npm test --prefix website
npm run build --prefix website
```

Expected: all tests pass and Next.js creates `/bizfinder`.

### Task 4: Browser Visual And Interaction Verification

**Files:**
- Modify as required by observed defects:
  - `website/components/BizFinderPage.js`
  - `website/public/site.css`

- [ ] **Step 1: Start the website**

Run: `npm run dev --prefix website -- -p 3100`

- [ ] **Step 2: Verify homepage entry**

Open `http://localhost:3100`, confirm `BizFinder` is visible in desktop navigation, and navigate to `/bizfinder`.

- [ ] **Step 3: Verify desktop page**

At the normal 1280x720 viewport:

- Logo is crisp and correctly proportioned.
- First viewport communicates the product without scrolling.
- Hero product mockup is readable.
- CTA is visible.
- Next section is partially visible.
- No console errors.

- [ ] **Step 4: Verify the full long page**

Scroll through every section and confirm:

- Section order matches the approved design.
- Spain scenario is clear and does not invent metrics.
- Real application screenshot loads.
- Download placeholder does not navigate or request a missing file.

- [ ] **Step 5: Verify mobile**

Set viewport to 390x844 and confirm:

- No horizontal overflow.
- Header remains usable.
- Hero stacks in the correct order.
- CTA controls are at least 44px high.
- Mockup labels and screenshot remain legible.

- [ ] **Step 6: Compare screenshots against the accepted concept**

Capture desktop and mobile screenshots. Inspect the accepted A concept and latest browser screenshot with `view_image`. Fix any material mismatch in palette, hierarchy, spacing, logo treatment, map emphasis, or responsive collapse.

- [ ] **Step 7: Run final verification**

Run:

```powershell
npm test --prefix website
npm run build --prefix website
git diff --check
```

Expected: all commands pass without errors.
