# Layout Architecture Redesign — Design

- **Date:** 2026-06-20
- **Status:** Approved in principle (user delegated engineering detail; will judge the rendered result)
- **Branch:** `musictide-patches`
- **Base:** clean `0489e9f6` (deployed gallery + article structure). The earlier ad-hoc shell/article-width experiment was discarded.
- **Related:** responsive-images/srcset is a **separate** spec; SPA app-shell is `2026-06-19-spa-app-shell-filtering-design-notes.md`.
- **Prompted by:** a code-review pass that confirmed the shell styling is brittle (shell coupled to the grid container → lurches at breakpoints; padding missing + duplicated across 4 files; 3 conflicting breakpoint systems; unlayered CSS silently beats Tailwind).

## Goal

Replace the brittle, magic-number layout with a small **token system** + a clean **container hierarchy**, and **decouple the app shell from the content grid** so the header/footer track the viewport instead of lurching with the stepped grid width.

## Plain-language: what changes for a human

- The **banner logo & footer** stop jumping around when you resize — they sit a steady gutter from the screen edges on every page and every width.
- **Content** (home grid / article) stays centered with consistent breathing room from the edges *and* from the header/footer.
- **Headings** scale smoothly with the screen; **body text** stays a fixed, zoom-safe size (good for reading).
- Under the hood, sizes come from one coherent set of values instead of one arbitrary 292px driving everything — so future tweaks are predictable, not whack-a-mole.
- Nothing about the *content* (the gallery, article order, the homepage grid look) changes; this is the frame around it.

## Scaling model — "C" (hybrid)

- **Body text + small UI:** plain `rem` (fixed per the token scale; respects browser zoom; bulletproof for reading).
- **Display type (article H1, hero title, section headings) + major spacing:** `clamp(min, rem + vw, max)` so they scale fluidly between a floor and ceiling — no snap at breakpoints. The `rem` term keeps zoom working (avoids the pure-`vw` WCAG trap).
- **Grid thumbnails:** stay a fixed cell size; margins absorb viewport changes (unchanged behavior the user already approved).

## Design tokens

Defined once, in Tailwind v4 `@theme` (this fork owns the build), so they are first-class tokens that also generate utilities.

- **Spacing** — base `0.25rem` (4px); steps `--sp-1…--sp-12` = 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96. *All* padding/gap/gutter pull from these.
- **Type** — body `--text-base: 1rem`; modular scale ratio **1.25**: `--text-sm 0.8rem`, `--text-base 1rem`, `--text-lg 1.25rem`, `--text-xl 1.5625rem`, `--text-2xl 1.953rem`. Display sizes are `clamp()`: `--text-display: clamp(1.75rem, 1.3rem + 2.2vw, 3rem)` (article H1 / hero), etc.
- **Gutter** — `--gutter: clamp(1rem, 0.6rem + 1.5vw, 2rem)` (16px phone → ~32px wide). The single edge-breathing-room token, used by **shell and content alike**.
- **Grid cell** — `--cell: 292px` (deliberate on-screen thumbnail size; DPI-handled by the browser). **Breakpoints derive from it**, not vice-versa.

## Breakpoints — one canonical set, derived from the cell

- **phone:** `< 900px` → 1 grid column
- **tablet:** `≥ 900px` → 3 columns (3 cells = 876px content; bp sits just above to dodge scrollbar overflow)
- **desktop:** `≥ 1200px` → 4 columns (4 cells = 1168px)

The old `768/1024` and `640/1024` families are retired; everything responsive uses `{900, 1200}` (type scales fluidly via `clamp`, so it needs no breakpoints of its own).

## Cascade layers / Tailwind integration

Wrap the fork's site CSS in an explicit `@layer` so it no longer silently beats every Tailwind utility regardless of specificity (the footgun the review found). Tokens live in `@theme`; component rules live in a named layer ordered after Tailwind's `utilities` only where an intentional override is needed. This also removes the need for the `!important` hacks in `extend-head.html`'s wide-mode block.

## Container hierarchy (each container = one responsibility)

```
.mt-app           — global frame (body). Owns: min-height, base bg/type. No width logic.
├─ .mt-header     — fixed header band. Owns: fixed position, full bleed, glass.
│   ├─ .mt-banner — banner inner. Owns: full width + var(--gutter) padding-inline; logo/controls layout.
│   └─ .mt-navbar — nav-strip inner. Owns: full width + var(--gutter) padding-inline; menu layout.
├─ .mt-content    — content region (main). Owns: vertical rhythm (gap below header / above footer via spacing tokens); centers its child.
│   ├─ .mt-home-grid — homepage grid. Owns: the fixed-cell grid (1/3/4 × --cell), centered, margins absorb. THE ONLY place cell geometry lives.
│   └─ .mt-article   — article column. Owns: its own readable measure (centered), padding via tokens.
└─ .mt-footer     — fixed footer band. Owns: fixed position, full bleed, glass.
    └─ (footer inner — full width + var(--gutter) padding-inline)
```

**Key contract change:** the shell inners (`.mt-banner`, `.mt-navbar`, footer inner) are **full width + `padding-inline: var(--gutter)`** — they no longer read `--container-7xl`. They track the viewport with a steady gutter. This single change fixes Symptom 1 (lurch) and Symptom 2 (missing padding), and the padding is defined **once in CSS** so the `{{ if not (or .IsHome .IsPage) }}` conditionals are deleted from all four templates.

## Content containers

- **`.mt-home-grid`** — unchanged behavior: `repeat(N, var(--cell))` at 1/3/4 columns, centered, margins absorb. Cell geometry is scoped *here only* (not a global `--container-7xl`).
- **`.mt-article`** — centered column with a readable `max-width` and `padding-inline: var(--gutter)`. Cover, body, and gallery share the article's measure (the cohesive single-column look the user liked). Default measure ≈ 3 cells (876px); **flagged as a "judge on screen" item** — if reading feels wide, narrow just the text measure (the user will see it and decide).
- **Vertical rhythm:** `.mt-content` adds a spacing-token gap below the header spacer and above the footer reservation (fixes Symptom 3) — applied once, for all page types.

## What's preserved / superseded

- **Preserved:** the homepage grid look, article structure (centered title → credits → 3/2 cover → date → body → gallery), and the media gallery (photo grid + GLightbox + video) — all from `0489e9f6`.
- **Superseded:** the `--container-7xl`-driven shell width, the per-template padding conditionals, `.mt-home` double-duty, and the three breakpoint families.

## Out of scope

- Responsive images / `srcset` for HiDPI sharpness (separate spec — the real "image looks crisp on Retina" fix).
- SPA app-shell + filtering (separate, deferred).
- Events dimension.

## Open / "judge on screen" items

- Article **text measure** (876px 3-cell vs a narrower ~65–70ch reading column) — decide from the rendered result.
- Exact `clamp()` floors/ceilings for display type — tuned visually during implementation.

---

## Update (2026-06-20) — grid foundation, alignment, and phasing

Refined during implementation. **This supersedes the "Breakpoints" and `.mt-home-grid` parts above.**

### Phase 1 — shell (DONE, committed locally this session, NOT deployed)
- Shell inners (`.mt-header-inner`, `.mt-footer-inner`) get their **own fixed frame** `--mt-frame = calc(4*--mt-col-w + 3*--mt-grid-gap)` (the 4-col grid width), centered, `padding-inline: var(--gutter)` — **decoupled from the grid's stepping `--container-7xl`**. Result: no "wrong-jump" at the column breakpoints (verified: logo holds at the gutter across 1201/1199 and 901/899; only the grid re-columns, which is expected). Consistent across home/article.
- Added tokens: `--gutter` (clamp for now → **make fixed in Phase 2** for clean alignment math), spacing scale `--sp-2…--sp-8`.
- Vertical rhythm: `.mt-content-rhythm { padding-block: var(--sp-8) }` on `<main>` (gap off the fixed header/footer).
- Residual at full width: the logo sits ~one gutter *inside* the grid's first column (indented). Made flush in Phase 2 via the gutter-alignment below.

### Phase 2 — grid REBUILD (replace, not patch) + the rest
- **Intrinsic grid** replaces the hand-tuned breakpoints: `grid-template-columns: repeat(auto-fill, var(--cell))`, capped at 4 cells via `max-width`, centered (`justify-content: center` + `margin-inline: auto`), `padding-inline: var(--gutter)`. The column count is self-determined by available space → **eliminates the 900/1200 geometry breakpoints** and the scrollbar-sensitive magic numbers. Adding a gutter just fits one fewer cell.
- **`scrollbar-gutter: stable`** on `html` → kills the "100vw includes the scrollbar → overflow at the boundary" fragility at the source.
- **One** real breakpoint remains: phone vs. not (the hero's 2-column span can't be expressed against a free column count) — and it coincides with the hamburger↔nav switch. So: from a brittle *pair* of geometry breakpoints down to one UX breakpoint + a self-sizing grid.
- **Gutter alignment (user's idea, geometrically correct):** grow the shell frame AND the grid frame by the padding so cells don't shrink and the shell content lines up pixel-for-pixel with the grid's first column. With the intrinsic grid there's no breakpoint arithmetic left to knock over, so it lands cleanly.
- Also Phase 2: full container-hierarchy rename (`.mt-app/.mt-header/.mt-banner/.mt-navbar/.mt-content/.mt-home-grid/.mt-article/.mt-footer`), fluid `clamp()` display type (scaling model C), `@theme` token migration, cascade-layer wrap, and the article **876 "3-cell measure" unified column** (cover+text+gallery — prototyped this session, liked, then discarded for a clean base).
