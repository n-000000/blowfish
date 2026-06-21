# SPA Shell + Category Filtering — Design Spec

- **Date:** 2026-06-21
- **Status:** Approved — ready for implementation planning
- **Branch:** `musictide-patches`
- **Supersedes:** `2026-06-19-spa-app-shell-filtering-design-notes.md`

---

## Goal

Convert musictide to an app-shell SPA. Banner, nav strip, and footer become a persistent shell; `#main-content` is the universal future swap target. In this phase, **category filtering** is the only in-place interaction — clicking a category nav link swaps the article grid without a full page load. Article-swap is deferred to a later phase.

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

`display:contents` nests correctly — grid children at any depth participate in `.mt-homepage-grid` as direct children. `#main-content` is the reserved universal swap target for article-swap (later phase, no rework needed when it lands).

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

`feed-fragment` returns: hero cell HTML + new `#mt-article-grid` div (with htmx attrs intact) + first page of grid items. HTMX re-processes the returned HTML automatically, so the new `#mt-article-grid`'s `hx-*` attributes are live immediately after swap.

---

## Build order

1. `data/dimensions.yaml` + color scheme update (Palette B)
2. `#mt-feed-region` wrapper + `feed-fragment` output format + templates
3. Category filter JS rewrite (target `#mt-feed-region`, pushState, toggle, active class)
4. `categories/term.html` → filtered home layout
5. Taxonomy cleanup (hugo.yaml + template de-linking)
6. Dead JS removal (`background-blur.js`)
7. Verification: filter, back/forward, direct loads, dark+light mode

---

## Out of scope

- Article-swap (deferred: build after article-page rework)
- Events dimension (deferred: flip registry switch + model content)
- Filter composition (event AND category) — deferred until events enabled
- Ads content model
