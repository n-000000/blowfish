# SPA App-Shell + Filtering — Design Notes

- **Date:** 2026-06-19
- **Status:** Design locked; implementation **deferred** (sequenced after the article-page rework)
- **Branch:** `musictide-patches`

## Goal

Convert musictide to an **app-shell SPA**. Banner, nav strip, and footer become a
persistent shell; `#main-content` is a single swap region. Browsing by **category**
(and, later, **event**) becomes **in-place filtering of the home feed**, not navigation
to standalone listing pages. There are no standalone category/tag/event "listing page"
designs — those URLs render the home layout in a filtered state.

## Locked decisions

### URL strategy — Option 1: clean paths, pre-rendered filtered home
- Applying a filter updates the URL to a clean path (e.g. `/categories/cultura/`) via
  `pushState`; the grid swaps in place (no reload).
- Opening that path directly — shared link, Google result — loads the **home layout
  already filtered** (hero = latest post in the filter; grid = the filtered set). Hugo
  pre-builds a static page at every such path.
- Preserves shareable/bookmarkable links, working back/forward, and SEO; the in-place
  filtering UX is identical to a query-string approach.
- **Rejected:**
  - *Stay at `/` (pure client state)* — no shareable filtered links, broken back button,
    crawlers see only the unfiltered home.
  - *Query string `/?category=…`* — on a static host there is no file per query combo, so
    the filtered view can't be pre-rendered: crawlers/direct loads get the unfiltered home
    plus a JS flash. Composability was its only edge, and there is one active dimension today.

### Architecture — Approach A: one parameterized feed + dimensions registry
- A single home/feed template renders `/`, `/categories/<x>/`, and (future)
  `/events/<x>/`, each seeded with a *filter context*. One layout to maintain.
- `#main-content` is the universal swap target; banner/nav/footer are the persistent shell.
- In-page clicks reuse the existing htmx grid-swap, plus a small router that `pushState`s
  the clean path and handles back/forward.

### Dimensions registry — single source of truth (e.g. `data/dimensions.yaml`)
- Declares which taxonomies/sections are **active filter dimensions**. The nav, the search
  facets, and which term pages get generated all read from it.
- `categories`: **on** (only supported dimension today)
- `events`: **off** — opt-in, designed-for, flipped on in a later session
- `tags`, `authors`, `series`: **off**
- Events ↔ categories are **orthogonal, many-to-many** (one event has N categories, one
  category has N events, each event is unique → its own clean path). Filter **composition**
  (event AND category) is deferred until events is enabled; the registry and feed-context
  are designed to allow it.

### Cleanup
- Remove `tags`/`authors`/`series` as taxonomies → no generated pages.
- De-link any per-post tag/author links so nothing 404s. "Off" = fully inert: no pages,
  no nav, no search facet, no clickable stragglers.
- Restrict search facets to active dimensions (fixes the search box offering unsupported
  dimensions). Exact Pagefind wire to be pinned during planning.
- Remove dead `background-blur.js` — verified no-op in the active `fixed.html` header
  (script present, but no `#menu-blur` element; `getElementById` returns null → early
  return). Only `fixed-fill-blur.html` / `fixed-gradient.html` render that element, and
  neither header is used.

### Article-swap — DEFERRED out of this spec
- Build the shell so `#main-content` is the universal swap target → article-swap drops in
  later with no architectural rework.
- Wire it **after** the article-page rework (higher priority) and the shell both exist, so
  it is built once against the *final* article (avoids re-doing JS re-init when the gallery
  changes).

### Out of scope
- **Ads** — content-model revision is a later session. The feed layout keeps the existing
  ad-slot grid cell (leaves room) but no ad logic is touched.

## Scroll restoration approach
- Rely on htmx's history snapshot (caches the feed DOM, including the infinite-scrolled
  grid) + the browser HTTP cache (serves images). Back rebuilds the scrolled feed without
  re-fetching.

## Build order
1. **Article-page rework** (structure + gallery) — higher priority; its own spec(s).
2. **SPA filtering** (this design) — shell + registry + clean-path filtering + cleanup.
3. **Events** — flip the registry switch + model event content.
4. **Article-swap** — after (1) and the shell from (2) exist.

## Verified context (2026-06-19)
- Taxonomies in config: tag, category, author, series.
- Content sections: posts, events (e.g. `sonic-blast-2025`), authors.
- Output formats: taxonomy `term` → HTML + fragment + grid-fragment; home → HTML/RSS/JSON.
- The homepage filter already swaps `#mt-article-grid` with a term's `grid-fragment.html`.
- "Agenda" in the nav is a **category** (`/categories/agenda/`), not the events section.

## Open / deferred decisions
- Filter composition semantics (event AND category) — decide when events is enabled.
- Exact search-facet mechanism (Pagefind filters vs. Blowfish defaults) — pin during planning.
