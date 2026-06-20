# Layout Architecture Redesign — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the app shell from the grid so the banner/footer track the viewport with a steady gutter (no breakpoint lurch, consistent padding), add vertical breathing room, and introduce the gutter/spacing tokens — the visible half of the layout redesign.

**Architecture:** Add a small set of CSS custom-property tokens (`--gutter`, spacing scale). Change `.mt-header-inner`/`.mt-footer-inner` from "centered, sized to the grid's `--container-7xl`" to "full width + `padding-inline: var(--gutter)`" — so the shell tracks the viewport independent of the stepped grid. Remove the now-redundant per-page padding conditionals from the three shell templates. Add content vertical rhythm.

**Tech Stack:** Hugo templates, Tailwind v4 (`npm run build`), Playwright (rendered verification — no unit-test harness).

**Spec:** `docs/superpowers/specs/2026-06-20-layout-architecture-design.md`

**Out of scope (Phase 2, separate):** cascade-layer wrap, full container-hierarchy rename, `@theme` token migration, fluid `clamp()` display type, breakpoint consolidation. This phase keeps the existing breakpoints and class names; it only fixes the shell coupling + padding + rhythm.

---

## Background

- Fork: `/home/n0xx/Code/infra/service/blowfish`. Site: `/home/n0xx/Code/infra/service/musictide` (local module replacement, active with `--environment development`).
- Custom site CSS: `assets/css/musictide.css`.
- **The bug:** `.mt-header-inner`/`.mt-footer-inner` use Tailwind `max-w-7xl` (= `max-width: var(--container-7xl)`) + `mx-auto`. On the homepage `--container-7xl` steps `1168→876→100vw` at 1200/900, so the centered shell margins jump ~146px (the "lurch"). Padding is only applied `{{ if not .IsHome }}`, so home/article have none.

### Reusable commands

**REBUILD:**
```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build 2>&1 | tail -1
rm -rf /home/n0xx/Code/infra/service/musictide/resources
hugo --environment development --ignoreCache -s /home/n0xx/Code/infra/service/musictide 2>&1 | grep -iE "error|^total" | tail -1
( cd /home/n0xx/Code/infra/service/musictide && python3 -m http.server 1314 --directory public >/dev/null 2>&1 & )
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1314/
```
Expected: no `ERROR`; `Total in …`; `200`.

---

## Task 1: Add gutter + spacing tokens

**Files:** Modify `assets/css/musictide.css` (the `:root` block at the top, after `--mt-card-padding-x`).

- [ ] **Step 1: Add the tokens**

In `assets/css/musictide.css`, inside the existing `:root { … }` (after the line `--mt-card-padding-x: 0.75rem;`), add:

```css
  /* ── Layout tokens (Phase 1) ── */
  --gutter: clamp(1rem, 0.6rem + 1.5vw, 2rem);  /* edge breathing room: 16px → ~32px */
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-6: 1.5rem;
  --sp-8: 2rem;
```

- [ ] **Step 2: Build + confirm**

Run **REBUILD**. Then:
```bash
grep -c "\-\-gutter" /home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css
```
Expected: `≥ 1`; build clean.

- [ ] **Step 3: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add assets/css/musictide.css
git commit -m "feat(layout): add gutter + spacing tokens

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Decouple the shell from the grid

**Files:**
- Modify `assets/css/musictide.css` (the phone shell-cap block, currently `@media (max-width: 899px) { .mt-header-inner, .mt-footer-inner { … } }`)
- Modify `layouts/partials/header/banner.html` (inner div, ~line 25)
- Modify `layouts/partials/header/fixed.html` (inner div, ~line 21)
- Modify `layouts/partials/footer.html` (inner div, ~line 9)

- [ ] **Step 1: Replace the phone shell-cap CSS with the decoupled rule**

In `assets/css/musictide.css`, find:
```css
/* ── Phone: align header/footer inner content with the centered grid ── */
/* On phone the grid is capped at --mt-phone-card-w and centered; the   */
/* fixed header/footer must match that same max-width + centering.       */
@media (max-width: 899px) {
  .mt-header-inner,
  .mt-footer-inner {
    max-width: var(--mt-phone-card-w);
    margin-left: auto;
    margin-right: auto;
  }
}
```
Replace it with:
```css
/* ── Shell inner: tracks the viewport with a steady gutter, on every page ──
   Decoupled from --container-7xl (the grid container) so it never lurches
   inward at the grid breakpoints. */
.mt-header-inner,
.mt-footer-inner {
  width: 100%;
  margin-inline: auto;
  padding-inline: var(--gutter);
}
```

- [ ] **Step 2: Update `banner.html`**

Change the inner div (the one with `mt-header-inner`) from:
```
<div class="mt-header-inner mx-auto max-w-7xl{{ if not .IsHome }} px-6 sm:px-14 md:px-24 lg:px-32{{ end }} w-full flex items-center justify-between h-full">
```
to:
```
<div class="mt-header-inner w-full flex items-center justify-between h-full">
```

- [ ] **Step 3: Update `fixed.html`**

Change the inner div (the one with `mt-header-inner`) from:
```
<div class="mt-header-inner relative m-auto w-full leading-7 max-w-7xl{{ if not .IsHome }} px-6 sm:px-14 md:px-24 lg:px-32{{ end }}">
```
to:
```
<div class="mt-header-inner relative w-full leading-7">
```

- [ ] **Step 4: Update `footer.html`**

Change the inner div (the one with `mt-footer-inner`) from:
```
<div class="mt-footer-inner mx-auto max-w-7xl{{ if not .IsHome }} px-6 sm:px-14 md:px-24 lg:px-32{{ end }} w-full flex items-center justify-between h-full">
```
to:
```
<div class="mt-footer-inner w-full flex items-center justify-between h-full">
```

- [ ] **Step 5: Rebuild**

Run **REBUILD**. Expected: no `ERROR`; `200`.

- [ ] **Step 6: Verify no lurch — sweep breakpoints on the homepage (Playwright)**

For each width in {1280, 1201, 1199, 1000, 901, 899, 600}, resize, navigate to `http://localhost:1314/`, and evaluate:
```js
() => {
  const inner = document.querySelector('.mt-header-inner');
  const r = inner.getBoundingClientRect();
  return { vp: window.innerWidth, logoGapLeft: Math.round(r.left), gapRight: Math.round(window.innerWidth - r.right) };
}
```
Expected: `logoGapLeft` stays small and roughly constant (≈ the gutter, 16–32px, scaling slightly), with **no ~146px jump** between 1201 and 1199, or between 901 and 899. (Right gap may differ by the scrollbar width — that's fine.)

- [ ] **Step 7: Verify the shell matches between home and article**

At 1280px, record `.mt-header-inner` `left` on `http://localhost:1314/` and on `http://localhost:1314/posts/kerala-dust-no-hard-club/`. Expected: equal (±2px).

- [ ] **Step 8: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add assets/css/musictide.css layouts/partials/header/banner.html layouts/partials/header/fixed.html layouts/partials/footer.html
git commit -m "fix(layout): decouple shell inners from the grid container

Shell inners are now full-width + padding-inline: var(--gutter), tracking the
viewport with a steady gutter on every page. Removes the --container-7xl
coupling (the breakpoint lurch) and the per-page padding conditionals.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Vertical breathing room (content off the header/footer)

**Files:**
- Modify `layouts/_default/baseof.html` (the `<main id="main-content" class="grow">`)
- Modify `assets/css/musictide.css` (append a rule)

- [ ] **Step 1: Add a rhythm class to main**

In `baseof.html`, change:
```
<main id="main-content" class="grow">
```
to:
```
<main id="main-content" class="grow mt-content-rhythm">
```

- [ ] **Step 2: Add the CSS**

Append to `assets/css/musictide.css`:
```css
/* ── Content vertical rhythm — gap below the fixed header / above the fixed footer ── */
.mt-content-rhythm {
  padding-block: var(--sp-8);
}
```

- [ ] **Step 3: Rebuild**

Run **REBUILD**.

- [ ] **Step 4: Verify**

Navigate to `http://localhost:1314/` at 1280px, evaluate:
```js
() => getComputedStyle(document.querySelector('#main-content')).paddingTop
```
Expected: `32px`.

- [ ] **Step 5: Screenshots for the human**

At 1280px: full-page screenshot of `http://localhost:1314/` (`layout-home.png`) and `http://localhost:1314/posts/kerala-dust-no-hard-club/` (`layout-article.png`). At 1000px and 600px: viewport screenshots of the homepage (`layout-tablet.png`, `layout-mobile.png`). Send all four with `SendUserFile`.

- [ ] **Step 6: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add layouts/_default/baseof.html assets/css/musictide.css
git commit -m "feat(layout): vertical rhythm — content gutter off the fixed header/footer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (Phase 1 subset):** gutter token → Task 1; shell decoupled from `--container-7xl` + single padding rule + conditionals removed → Task 2; vertical rhythm → Task 3. Deferred-to-Phase-2 items (cascade layers, container rename, fluid type, `@theme`, breakpoint consolidation) are explicitly out of scope above. ✓

**Placeholder scan:** none — every step has exact code/commands/expected values.

**Type/name consistency:** `--gutter`, `--sp-8`, `.mt-header-inner`, `.mt-footer-inner`, `.mt-content-rhythm` are defined and referenced identically across tasks. ✓

**Note:** The shell now sits at `var(--gutter)` from the viewport edge while the homepage grid stays centered at its fixed width — so on wide screens the logo will be further left than the grid's left edge. This is the intended "full-width header" behavior (confirmed with the user); judge it on the screenshots.
