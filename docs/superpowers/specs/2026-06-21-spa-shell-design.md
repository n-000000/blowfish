# SPA Shell + Category Filtering — Design Spec

- **Date:** 2026-06-21
- **Status:** Approved — ready for implementation planning
- **Branch:** `musictide-patches`
- **Supersedes:** `2026-06-19-spa-app-shell-filtering-design-notes.md`

---

## Goal

Convert musictide to an app-shell SPA. Banner, nav strip, and footer become a persistent shell; `#main-content` is the universal swap target. Two in-place interactions ship in this phase:

1. **Category filtering** — clicking a category nav link swaps the article feed without a full page load
2. **Article-swap** — clicking an article card loads the article into `#main-content` without a full page load

The article-page rework is complete, so article-swap is built once against the final article structure.

---

## Architecture

A new `#mt-feed-region` wrapper (`display:contents`) wraps the hero cell and `#mt-article-grid` inside `.mt-homepage-grid`. HTMX swaps `#mt-feed-region`'s innerHTML on every filter action — one request, one swap, no timing complexity.

```
body
  ├── header (banner + nav strip) — persistent shell, never re-renders
  └── #main-content
       └── .mt-homepage-grid
            └── #mt-feed-region  [display:contents — new]
                 ├── .mt-hero-cell  (always: overall latest post)
                 └── #mt-article-grid  [display:contents — existing]
                      └── .mt-grid-item × N
```

`display:contents` nests correctly — grid children at any depth participate in `.mt-homepage-grid` as direct children. `#main-content` is the swap target for article-swap; category filtering swaps the inner `#mt-feed-region` only. Both coexist without conflict — one is a subset of the other.

---

## Hero behavior

The 2×2 hero always displays the **overall latest post**, regardless of the active filter. This is the fixed, non-negotiable behavior for this phase.

**`heroFollowsFilter` toggle** in `data/dimensions.yaml` (default: `false`). When `true`, the `feed-fragment` template uses the category-latest post as hero instead. The toggle requires no JS changes — it is a Hugo template conditional only. Shipping `false`; infrastructure is in place to flip it.

---

## Filter behavior

### Activate

Click a category nav link → JS:
1. Fetches `/categories/{term}/feed-fragment.html`
2. Swaps `#mt-feed-region` innerHTML (htmx, `transition:true`)
3. `pushState` to `/categories/{term}/`
4. Applies active CSS class to the clicked nav item

### Clear

Click the **active** category nav link again → JS:
1. Fetches `/posts/feed-fragment.html`
2. Swaps `#mt-feed-region` innerHTML
3. `pushState` to `/`
4. Removes active class

Logo and Home nav link navigate normally to `/` — standard page load always clears filter state.

### Back / forward

htmx history snapshot (`hx-history-elt`) caches the `#mt-feed-region` DOM (including any infinitely-scrolled content). Browser back/forward restores from snapshot. No re-fetch on back.

---

## Category term pages (direct loads)

`/categories/{term}/` renders the **home layout in filtered state**:
- Hero: overall latest (same as homepage — consistent with in-place filter UX)
- Grid: articles in that category only, paginated

`categories/term.html` is replaced by a template that mirrors `index.html` seeded with the category filter context. Shared links and direct loads produce a page visually identical to what in-place filtering shows.

---

## `data/dimensions.yaml` — dimensions registry

Single source of truth for active filter dimensions. Nav generation, term page output, and Pagefind facets all read from this file.

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

A dimension being `enabled: false` means: no generated listing pages, no nav item, no search facet, no clickable links anywhere on the site.

---

## Nav active state

### Visual treatment

- **Idle**: all category links use muted text (`text-neutral-500 dark:text-neutral-400`) — works in both light and dark mode without hardcoded rgba values
- **Active**: text returns to full contrast (`text-neutral-900 dark:text-neutral-100`) + **3px colored underline bar** in the category's color
- No ✕, no pill, no colored text — the underline bar is the sole color signal
- Matches the visual language of the original espinhomagazine.pt nav

### Color palette (Palette B — Tailwind 500/600 range)

| Category | Token | Hex |
|---|---|---|
| Espinho | blue-500 | `#3b82f6` |
| Nacional | cyan-600 | `#0891b2` |
| Cultura | amber-600 | `#d97706` |
| Desporto | green-600 | `#16a34a` |
| Lifestyle | purple-600 | `#9333ea` |
| Agenda | red-600 | `#dc2626` |

Applied to: nav underline bar, card category badges, per-category accents. The rainbow nav (all items colored all the time) is eliminated — color only appears on the active filter item.

### CSS approach

Each category color lives as a CSS custom property on the `<a>` element, set via Hugo template from the category page's `color:` frontmatter param — the same param the card badge templates already read. **Palette B values must be written into each category's `_index.md` frontmatter** as part of the color scheme update task. The active class applies `border-bottom: 3px solid var(--cat-color)`.

---

## Article-swap

### Behavior

Click any article card in the grid → JS:
1. Intercepts the `<a>` click on `.mt-grid-item a` (and in-article links to other posts)
2. Fetches `/posts/{slug}/fragment.html`
3. Swaps `#main-content` innerHTML (htmx, `transition:true`)
4. `pushState` to the article URL
5. Updates `document.title` to the article title
6. Scrolls `#main-content` to top

### Back / forward

`hx-history-elt="#main-content"` is set on `<main>` (or its container). htmx history snapshots the entire `#main-content` state — both the homepage feed and article views are captured. Back restores the previous `#main-content` from snapshot; no re-fetch.

### Article fragment

`layouts/_default/single.fragment.html` — returns the content of `{{ define "main" }}` only (the `.mt-article-column` div and everything inside it). No `<html>`, no shell. HTMX re-processes the returned HTML, so any `hx-*` attributes in the article body (e.g., gallery sentinels) are live immediately.

Article-specific JS (gallery, lightbox) that currently initialises on `DOMContentLoaded` must also listen for `htmx:afterSettle` so it re-runs after a swap.

### Direct loads

Full `single.html` continues to render at all article URLs. Direct loads, Google results, and refreshes all work as before. The fragment URL (`/posts/{slug}/fragment.html`) is only consumed by the JS router.

---

## Taxonomy cleanup

- Remove `tags`, `authors`, `series` from `taxonomies:` in musictide's `hugo.yaml` — no generated pages for these
- Audit `single.html` and `article-meta/` partials; strip any rendered tag/author links so nothing 404s after removal
- Remove dead `background-blur.js` (verified no-op: no `#menu-blur` element in `fixed.html`)
- Pagefind search facets restricted to `categories` only (tags/authors removed from facet config)

---

## Output formats required

| Format | URL pattern | Consumed by |
|---|---|---|
| `feed-fragment` (new) | `/posts/feed-fragment.html` | JS on category clear |
| `feed-fragment` (new) | `/categories/{term}/feed-fragment.html` | JS on category activate |
| `grid-fragment` (existing) | `/posts/grid-fragment.html` | Infinite scroll sentinels |
| `grid-fragment` (existing) | `/categories/{term}/grid-fragment.html` | Infinite scroll sentinels within filtered feed |
| `fragment` (new for singles) | `/posts/{slug}/fragment.html` | JS on article card click |

`feed-fragment` returns: hero cell HTML + new `#mt-article-grid` div (with htmx attrs intact) + first page of grid items. HTMX re-processes returned HTML automatically, so `hx-*` attributes are live immediately after swap.

`fragment` for singles returns: the `.mt-article-column` content only (the `{{ define "main" }}` block). No shell markup.

---

## Build order

1. `data/dimensions.yaml` + color scheme update (Palette B — category frontmatter + CSS)
2. `#mt-feed-region` wrapper + `feed-fragment` output format + templates
3. Category filter JS rewrite (target `#mt-feed-region`, pushState, toggle, active class)
4. `categories/term.html` → filtered home layout
5. Article-swap: `fragment` output format for singles + `single.fragment.html` template
6. Article-swap JS router (intercept grid card clicks, `#main-content` swap, pushState, title update, scroll-to-top)
7. `htmx:afterSettle` re-init for article-specific JS (gallery, lightbox)
8. Taxonomy cleanup (hugo.yaml + template de-linking)
9. Dead JS removal (`background-blur.js`)
10. Verification: filter, article-swap, back/forward, direct loads, dark+light mode

---

## Out of scope

- Events dimension (deferred: flip registry switch + model content)
- Filter composition (event AND category) — deferred until events enabled
- Ads content model
- Image `srcset` / HiDPI optimisation
