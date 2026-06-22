# SPA Shell + Category Filtering — Design Spec

- **Date:** 2026-06-21 (revised 2026-06-22)
- **Status:** Revised — pending re-approval (navigation model materially changed 2026-06-22; see Revision note)
- **Branch:** `musictide-patches`
- **Supersedes:** `2026-06-19-spa-app-shell-filtering-design-notes.md`

---

## Revision note — 2026-06-22

Two iterations refined the navigation model:

**First pass** replaced the original *two-target* swap (an inner `#mt-feed-region`
for filtering, an outer `#main-content` for articles) — whose article-swap
destroyed the inner target and silently broke Back-to-feed — with a single
`#main-content` target plus re-fetch-and-restore on Back.

**Second pass (adopted)** replaced re-fetch-on-Back with **a preserved feed**
("keep the feed alive"). Re-fetching a fresh feed on Back is a dead end: either
the restored feed is *stale*, or — if re-fetched — the clicked card may sit in an
not-yet-loaded infinite-scroll page, so there is nothing to scroll to. The
anchor-restore and fast-forward-load ideas were attempts to paper over that and
are **retired**. Instead, the feed is never destroyed when an article opens: it is
hidden (its DOM, scroll position, loaded cards, and infinite-scroll state intact)
and the article is shown in a sibling region. Back simply re-reveals the feed —
exact, instant, no fetch, no jank. "Stale on Back" is the correct, expected
behavior — the browser's own back-forward cache does the same.

The `#mt-feed-region` wrapper from the original design is dropped. Sections
changed: Architecture, Filter behavior, Back/forward, Render context, Article-swap,
Output formats, Deprecated views, Build order.

---

## Goal

Convert musictide to an app-shell SPA. The app surface is intentionally minimal:
**persistent shell (banner + nav strip + footer), a content grid, article pages,
and a search box** — nothing else. The shell never re-renders.

Two in-place interactions ship in this phase:

1. **Category filtering** — clicking a category nav link replaces the feed in
   place with that category's filtered feed, without a full page load
2. **Article-swap** — clicking an article card opens the article in place, over a
   preserved feed, without a full page load

The article-page rework is complete, so article-swap is built once against the
final article structure.

---

## Architecture

The shell (banner + nav strip + footer + scroll-to-top) is persistent and never
re-renders. Inside it, on **home and category pages**, `<main id="main-content">`
contains **two sibling regions**:

```
body  [layout class: mt-home | mt-article-page]
  ├── header (banner + nav strip)         — persistent shell
  ├── #main-content
  │     ├── #mt-feed-view     — the current feed (home or one category): hero + grid
  │     └── #mt-article-view  — an opened article (empty/hidden until a card click)
  └── footer + scroll-to-top              — persistent shell, OUTSIDE #main-content
```

- **`#mt-feed-view`** holds exactly one feed at a time — the *current feed* (the
  all-posts home feed, or one category). Its content is `.mt-homepage-container >
  .mt-homepage-grid > (hero cell + #mt-article-grid)`, exactly as a home/category
  page renders today.
- **`#mt-article-view`** holds an opened article (`.mt-article-column`).
  Empty/hidden until a grid card is clicked.

Only one region is visible at a time. The pivotal property: **opening an article
never destroys the feed.** `#mt-feed-view` is hidden (`display:none` + `inert`),
`#mt-article-view` is shown — so the feed's DOM, scroll position, loaded cards, and
infinite-scroll sentinel state are all retained. Returning re-reveals it untouched.

Three kinds of in-app transition:
- **Filter** (nav click) re-renders `#mt-feed-view` with a different feed — a
  deliberate new view, rendered fresh at the top.
- **Open article** (card click) renders into `#mt-article-view` and hides
  `#mt-feed-view`.
- **Back / forward** reveals or re-renders per the URL (see *Back / forward*).

A **directly-loaded article URL** (`/posts/{slug}/`) is a standalone page rendered
by `single.html` — it has *no* feed region (the visitor deep-linked straight to
the article). The two-region experience applies to in-app navigation from a feed;
a deep-linked article is a leaf entry point whose nav links navigate normally
(full load) until the visitor lands on a feed page and the two-region shell
renders.

**Nothing persistent may live inside the swapped regions.** `scroll-to-top.html`
currently sits inside `<main>` (after `{{ block "main" }}`); it must move out into
the persistent shell (or be a sibling of the two regions that is never
hidden/replaced), since both regions are hidden/re-rendered during navigation.
(`search.html` is already outside `#main-content` — unaffected.)

Infinite scroll is unchanged and internal to `#mt-article-grid` (the existing
`grid-fragment` sentinel appends pages at the bottom — see *Infinite scroll*).
Because the feed is preserved across an article excursion, its sentinel state
survives, so scrolling continues seamlessly after Back.

---

## Hero behavior

The 2×2 hero always displays the **overall latest post**, regardless of the active
filter. This is the fixed, non-negotiable behavior for this phase.

**Hero is excluded from the grid it sits above.** The grid beneath the hero must
not re-list the hero post. On the home feed the all-posts grid omits the
overall-latest post; on a category feed, if the overall-latest post belongs to
that category it is omitted from that category's grid too — otherwise it appears
twice (hero + first card). Every feed computes its grid as *(its posts) minus (the
hero post)*.

**`heroFollowsFilter` toggle** in `data/dimensions.yaml` (default: `false`). When
`true`, the category feed uses the category-latest post as hero instead of the
overall-latest. Template conditional only — no JS change. The hero-exclusion rule
applies identically in both modes. Shipping `false`; infrastructure in place.

---

## Filter behavior

### Activate

Click a category nav link → JS re-renders `#mt-feed-view` with that category's feed
fragment, `pushState` to `/categories/{term}/`, applies the active nav class,
scrolls to top. (Switching filters is a deliberate new view — rendered fresh at
the top, not a restore.) If an article was open, this also hides `#mt-article-view`
and reveals `#mt-feed-view`.

### Clear

Click the **active** category again → re-render `#mt-feed-view` with the home feed
fragment, `pushState` to `/`, remove the active class, scroll to top.

Logo and Home link navigate normally to `/` — a standard page load always clears
filter state.

---

## Article-swap

### Behavior

Click a card in `#mt-feed-view` → JS:
1. Saves `window.scrollY` (for the eventual Back).
2. Fetches `/posts/{slug}/fragment.html` into `#mt-article-view`.
3. Hides `#mt-feed-view` (marks it `inert`); shows `#mt-article-view`.
4. Sets body layout class to `mt-article-page` (surgically — see *Render context*).
5. `pushState` to the article URL; updates `document.title`; scrolls to top.

In-article links to other posts are intercepted the same way (render into
`#mt-article-view`).

### Re-init of article JS

Article-specific JS (image gallery, video gallery, lightbox) already listens for
`htmx:afterSettle` in addition to `DOMContentLoaded`, and is idempotent, so it
re-runs after a swap. **Verify only — no work required.**

### Back

Handled by the popstate rule below: Back from an article reveals the preserved
`#mt-feed-view` at its saved scroll position — exact and instant.

### Direct loads & parity

`single.html` renders the standalone article at every `/posts/{slug}/` URL — direct
loads, search results, Google results, refreshes all work as before. Because the
router sets the body layout class on swap, an article opened in-app is visually
identical to a directly-loaded one. The fragment URL (`/posts/{slug}/fragment.html`)
is consumed only by the router.

### Article fragment

`layouts/_default/single.fragment.html` returns the content of `{{ define "main" }}`
only (the `.mt-article-column` and everything inside it). No `<html>`, no shell.
HTMX re-processes returned HTML, so any `hx-*` in the article body (gallery
sentinels) are live immediately.

---

## Back / forward

A `popstate` listener resolves the target URL against what is currently loaded:

- **Article URL** → show `#mt-article-view` (rendering the article into it if it is
  not already there), hide `#mt-feed-view`, set body `mt-article-page`.
- **Feed URL matching the feed currently loaded in `#mt-feed-view`** → the
  *article-excursion Back*: hide `#mt-article-view`, reveal `#mt-feed-view` as-is,
  restore the saved scroll offset, set body `mt-home`. **Exact restore** — the feed
  never changed, so its DOM and the saved pixel offset are still valid.
- **Feed URL differing from the loaded feed** (e.g. backing across a filter switch)
  → re-render that feed into `#mt-feed-view` at the top, reveal it.

Scroll handling: `history.scrollRestoration = 'manual'`; the router saves
`window.scrollY` before opening an article and restores it on the
article-excursion Back. Reliable — unlike the retired re-fetch model — because the
feed DOM is unchanged: no reflow, no missing-card, **no deep-scroll edge case**. A
feed scrolled deep is preserved in full, sentinel state and all.

"Stale on Back" is intended and correct: Back shows the feed as you left it (as the
browser's native back-forward cache would); newly published articles appear on the
next full load, never injected mid-scroll.

> **Rejected alternatives** (recorded so they are not re-proposed):
> (a) htmx history *snapshotting* (`hx-history-elt`) — caches rendered DOM in
> browser storage; rejected as more frontend machinery, finicky with the CSS grid +
> `display:contents`.
> (b) *Single-document* model — every article inlined as a section of one page so
> Back is native hash navigation (literal Wikipedia `#section`); rejected because
> inlining every article body does not scale for a feed.
> (c) Re-fetch on Back + anchor restore + fast-forward page-loading; rejected — see
> the *Revision note* (stale, or scroll-to-an-unloaded-card). The preserved-feed
> model adopted above borrows the *scroll-to-a-known-position* intent without any
> re-fetch.

---

## Render context (body class)

`<body>` carries a layout class — `mt-home` for feeds, `mt-article-page` for an
article (full-viewport body within which the 876px `.mt-article-column` centers).
Because the shell — and `<body>` — is never swapped, the router **toggles this
class to match the visible region on every transition and on Back/forward**, so an
in-app article matches a directly-loaded one.

The toggle must be **surgical** — flip only the layout token (`mt-home` ↔
`mt-article-page`), never replace the whole `class` attribute, or it clobbers the
other body classes baseof sets (`bg-neutral`, `text-lg`, `min-h-screen`,
`bf-scrollbar`, etc.). The hidden region's styling is irrelevant while it is
`display:none`, so the two regions never need conflicting body classes at once.

This also closes the existing cross-page shell-consistency gap: direct-load and
in-app load of the same URL share one render context.

---

## Infinite scroll (unchanged — reference)

Within a feed, `#mt-article-grid` ends with a sentinel:
```html
<div data-sentinel hx-get="…/page/N/grid-fragment.html"
     hx-trigger="preempt" hx-target="this" hx-swap="outerHTML"></div>
```
An IntersectionObserver (wired in `extend-head.html`) dispatches the custom
`preempt` event as the sentinel nears the viewport, firing the `hx-get`. The
returned page is *more cards + a fresh sentinel*; `outerHTML` swap replaces the
sentinel in place, so new cards append at the bottom and a new sentinel advances to
the next page — until the last page returns no sentinel. Content only ever appends
below the viewport, so scrolling never jolts. The preserved feed retains this
sentinel state, so Back-then-scroll resumes loading seamlessly.

---

## Category term pages (direct loads)

`/categories/{term}/` renders the **home layout in filtered state** — a full,
server-rendered page (with shell, two regions, feed visible) whose `#mt-feed-view`
is byte-for-byte the category feed fragment:
- Hero: overall latest (same as homepage), excluded from the grid per the hero rule
- Grid: articles in that category only, paginated

`categories/term.html` is rewritten to render this filtered home-grid layout.
Shared links, search results, and direct loads produce a page visually identical to
in-place filtering.

---

## Nav active state

### Visual treatment

- **Idle**: muted text (`text-neutral-500 dark:text-neutral-400`) — works in both
  modes without hardcoded rgba
- **Active**: full contrast (`text-neutral-900 dark:text-neutral-100`) + **3px
  colored underline bar** in the category's color
- No ✕, no pill, no colored text — the underline bar is the sole color signal
- Matches the original espinhomagazine.pt nav

### Color palette (Palette B — Tailwind 500/600 range)

| Category | Token | Hex |
|---|---|---|
| Espinho | blue-500 | `#3b82f6` |
| Nacional | cyan-600 | `#0891b2` |
| Cultura | amber-600 | `#d97706` |
| Desporto | green-600 | `#16a34a` |
| Lifestyle | purple-600 | `#9333ea` |
| Agenda | red-600 | `#dc2626` |

Applied to the nav underline bar and card category badges. The rainbow nav (all
items colored all the time) is eliminated — color only appears on the active item.

### CSS approach

Each category color lives as a CSS custom property (`--cat-color`) on the nav
`<a>`, set from the category page's `color:` frontmatter param — updated to the
Palette B **hex** value (old `primary-500`-style *token* values replaced). The
active class applies a 3px underline using `var(--cat-color)`.

Card category badges switch from token-keyed classes (`cat-bg--primary-500`) to
**slug-keyed** classes (`cat-bg--espinho`), defined with fixed hex in
`musictide.css` so badge color is theme-independent. The badge no longer reads the
`color` param, so changing it to hex does not affect badges.

---

## Output formats required

Two delivery layers: **feed/article fragments** for in-app rendering, and the
existing **grid-fragment** for infinite scroll inside a feed.

| Fragment | URL pattern | Page kind | Wired in | Rendered into |
|---|---|---|---|---|
| Home feed | `/posts/{name}.html` | section | `content/posts/_index.md` outputs | `#mt-feed-view` (clear / back-to-home) |
| Category feed | `/categories/{term}/{name}.html` | term | `hugo.yaml` `outputs.term` | `#mt-feed-view` (filter / back-to-category) |
| Article | `/posts/{slug}/fragment.html` | page | `hugo.yaml` `outputs.page` | `#mt-article-view` (card click) |
| grid-fragment (existing) | `/posts/grid-fragment.html`, `/categories/{term}/grid-fragment.html` | section, term | already wired | inside `#mt-article-grid` (infinite scroll) |

**Output-format wiring is per page-kind and is easy to under-specify** — call it
out explicitly in the plan:

- **Section** (the `posts` list page) takes output formats from
  `content/posts/_index.md` front matter, **not** from `hugo.yaml`'s `outputs`
  block. The home feed fragment format must be added *there*.
- **Term** pages take output formats from `hugo.yaml` `outputs.term`. The category
  feed fragment format is added there.
- **Page** (singles) take output formats from `hugo.yaml` `outputs.page`, currently
  **unset** → singles default to `[HTML]` only. Add `outputs.page: [HTML, fragment]`
  or single fragments are never generated and article-swap 404s.

A feed fragment returns the full `#mt-feed-view` inner HTML (hero cell +
`#mt-article-grid` with first page of cards + infinite-scroll sentinel), wrapped in
`.mt-homepage-container > .mt-homepage-grid`. HTMX re-processes returned HTML, so
`hx-*` attributes are live immediately.

**Direct-load / fragment parity invariant (critical).** The home page `/` is
rendered by `index.html` (home kind), but the home *feed fragment* is emitted as a
shell-less output (table lists it on the `posts` section for pagination
convenience). These are two templates that must produce **byte-identical**
`#mt-feed-view` HTML, or a direct `/` load and an in-app render drift. Enforce it
the way the codebase already shares hero markup: **both render from one shared
partial** (`home/hero.html` today), never divergent copies. Same rule binds
`categories/term.html` (direct) and the category feed fragment. As part of this,
`home/hero.html` is reduced to *pure structure* (container → grid → hero cell →
`#mt-article-grid` + sentinel); router, prefetch hints, and scripts move out so the
one partial serves both the direct page and the fragment.

---

## Deprecated views removed

The app surface is *shell, grid, article, search* only. Removed in this phase:

- **`/posts/` chronological list page** (`list.html`) — deprecated; deleted. The
  homepage grid is the canonical feed. The `posts` *section* is retained only as
  the source of the feed/grid fragments the shell consumes; its human-facing HTML
  list page goes away.
- **Legacy list fragments** (`list.fragment.html`, `term.fragment.html`, size-5
  month-grouped card lists) — no longer consumed once the grid feed is the only
  feed; removed.
- This makes the Palette-B migration of the legacy list-card templates
  (`article-link/card.html`, `article-link/simple.html`) **unnecessary** — they are
  only used by the removed list views. (Confirm no other consumer before deleting;
  if a consumer remains, leave the file but drop its category-tint class so it
  cannot emit an invalid `cat-bg--{hex}` class.)

---

## Taxonomy cleanup

- Remove `tags`, `authors`, `series` from `taxonomies:` in `hugo.yaml` — no
  generated pages for these
- Trim `related.indices` to `categories` + `date`
- Audit `single.html` / `article-body.html` and `article-meta/` partials; strip any
  rendered tag/author/series links so nothing 404s (repo-wide grep for `/tags/`,
  `/authors/`, `/series/` and the `.Params.*` link usages, excluding `schema.html`
  which uses `.Params.tags` only for JSON-LD)
- Remove dead `background-blur.js` (verified no-op: no `#menu-blur` in `fixed.html`)
- Pagefind search facets restricted to `categories` only

---

## `data/dimensions.yaml` — dimensions registry

Single source of truth for active filter dimensions, read via `hugo.Data.dimensions`
(the accessor existing templates already use for `hugo.Data.style`, confirmed to
read `data/*.yaml`).

```yaml
heroFollowsFilter: false

dimensions:
  categories:
    enabled: true
  events:
    enabled: false   # flip on when events content model is ready
  tags:
    enabled: false
  authors:
    enabled: false
```

A dimension `enabled: false` means: no generated listing pages, no nav item, no
search facet, no clickable links anywhere.

---

## Build order

1. `data/dimensions.yaml` + Palette B (category frontmatter → hex + slug-keyed
   badge CSS + nav active-state CSS)
2. Output-format wiring: home-feed format on `content/posts/_index.md`,
   category-feed on `outputs.term`, `fragment` on `outputs.page`
3. Two-region structure: `#mt-feed-view` + `#mt-article-view` in `baseof.html`
   (home/category pages); `home/hero.html` reduced to pure shared structure;
   feed-fragment templates (home, category); article `single.fragment.html`;
   `term.html` rewrite as filtered home grid; `scroll-to-top` moved to shell
4. `spa-router.js` — keep-feed-alive: filter (re-render `#mt-feed-view`), open
   article (render `#mt-article-view`, hide feed, save scroll), popstate (reveal vs
   re-render per URL, restore scroll), body-class toggle, nav active class
5. Remove deprecated views (`/posts/` list + legacy list fragments); confirm
   `article-link/card.html` / `simple.html` unreferenced (or de-tinted)
6. Taxonomy cleanup (`hugo.yaml` + template de-linking) + dead `background-blur.js`
   removal
7. Verification: filter, article-swap, back/forward (esp. scroll feed → open
   article → Back = exact restore; filter A → article → Back → Back), direct loads,
   body-class parity, dark + light mode

---

## Out of scope

- Events dimension (deferred: flip registry switch + model content)
- Filter composition (event AND category) — deferred until events enabled
- Ads content model
- Image `srcset` / HiDPI optimisation
