# Article Page Structure — Design (Spec A)

- **Date:** 2026-06-19
- **Status:** Approved (structure + both assumptions confirmed); ready for implementation plan
- **Branch:** `musictide-patches`
- **Related:** media gallery is a separate spec (Spec B, spike-driven); SPA app-shell is `2026-06-19-spa-app-shell-filtering-design-notes.md`

## Goal

Restructure the article (post) page so the title leads, attribution and date frame the
cover, and the cover stops cropping. This is purely an article-page template + CSS change
— no routing, registry, or homepage impact.

## New structure (top of the article)

| # | Element | Detail |
|---|---------|--------|
| 1 | **Title** | Centered, at the very top. (Today: left-aligned, *below* the hero/cover.) |
| 2 | **Credits ("authors")** | `Texto: … · Fotos: … · Vídeo: …` (whichever are present), directly under the title. This is the site's real attribution — 78 posts use `credit_*`; the `authors` taxonomy is unused (0 posts). |
| 3 | **Cover** | The post's feature image (same source as the grid thumbnail, via `resolve-feature-image.html`), rendered as a plain `<img>` at **aspect-ratio 3/2**, `object-fit: cover`, **content/text-column width**, centered. No gradient overlay, no overlaid title. Shown whenever a feature image exists; **omitted entirely** (no placeholder) when none. |
| 4 | **Date** | Publish date only (e.g. "24 Nov 2020") — no reading time or other meta. Sits under the cover. |
| 5 | **Body text** | `.Content`, unchanged. |
| 6 | **Gallery** | Unchanged position; its rework is Spec B. |

## Changes from today

- **Cover aspect ratio: 16/9 → 3/2.** The current article cover/hero treatment uses a 16/9
  aspect ratio (which crops). The new cover is a distinct, simpler element — a plain 3/2
  image with the title *above* it, not the overlay-style hero. The exact partial + CSS
  location is pinned in the implementation plan.
- **Cover always shown** (when a feature image exists), rather than gated behind the
  optional hero.
- **Title moves above the cover** and is centered.
- **Credits and date are split** to straddle the cover (credits above, date below).

## Removed

- The unused **`authors`-taxonomy rendering** on the article (author card / `SingleAuthor`
  template). It renders nothing (no `authors:` frontmatter, no `data/authors`) and is being
  retired anyway. Removing it here keeps the header clean; the taxonomy-level removal is
  handled by the SPA cleanup spec.

## Out of scope (leave exactly as-is)

- Table of contents (off by default), sharing links (off; possible later toggle), related
  posts (off), comments (no storage backend on a static site), the prev/next article
  navigator (disliked, but separate).
- Media gallery internals (Spec B), and all homepage/SPA work.

## Confirmed assumptions

- Cover width matches the text column (not full-bleed/wide).
- Date shows the date only.
