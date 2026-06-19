# Article Media Gallery — Design (Spec B)

- **Date:** 2026-06-19
- **Status:** Approved (design + GLightbox confirmed); ready for implementation plan
- **Branch:** `musictide-patches`
- **Related:** article structure is `2026-06-19-article-structure-design.md` (Spec A, shipped); SPA app-shell is `2026-06-19-spa-app-shell-filtering-design-notes.md`

## Goal

Replace the article gallery with two purpose-built components: a clean **photo grid + fullscreen lightbox**, and a **dedicated video gallery** (playlist-style). Both are driven by the existing sveltia `gallery:` frontmatter array — no CMS change.

## Data source

The sveltia "Galeria" field is a `file` widget with `multiple: true`, accepting `image/*` **and** `video/mp4,video/webm,video/quicktime`. It writes a **flat `gallery:` array** of media URLs (R2 CDN) into the post's frontmatter — images and videos comingled.

At render time, **split the array by file extension**:
- video (`.mp4`, `.webm`, `.mov`) → **video gallery**
- everything else → **photo gallery**

Each sub-gallery renders **only if it has ≥1 item**.

## Component 1 — Photo gallery (images)

- **On the page:** a responsive **CSS grid** of uniform thumbnails — aspect **3/2**, `object-fit: cover`, **2 columns on phone → 3–4 on desktop**. This **replaces the CSS-columns masonry**, whose top-to-bottom column fill is the cause of the first-column ordering/alignment bug. The grid reads left-to-right in rows and matches the homepage grid language.
- **On click:** a **fullscreen lightbox** via **GLightbox**. Each thumbnail is wrapped in an anchor GLightbox binds to; clicking opens the **full, uncropped** image fullscreen, with **touch-swipe** and **arrow-key / Esc** navigation across the article's photo set (one GLightbox group per article).
- **"Zoom" = fullscreen display** (the agreed requirement). Pinch-zoom-into-pixels is out of scope.
- **Re-init-safe:** initialize idempotently on `DOMContentLoaded` **and** `htmx:afterSettle`, so it survives the future SPA article-swap.

## Component 2 — Video gallery (dedicated, conditional)

- A **separate section**, rendered **only if the article has ≥1 video**.
- **Layout:** a **main `<video controls>` player** + a **thumbnail rail** of the article's videos — each thumbnail a first-frame poster with a ▶ overlay. Clicking a thumbnail loads that video into the main player. The first video is loaded by default.
- **Native HTML5 controls** (full playback for free). A few lines of vanilla JS swap the active video on thumbnail click. **No library.**

## Library handling (GLightbox)

- **Vendor** `glightbox.min.js` + `glightbox.min.css` into the fork's `assets/`, served via Hugo's asset pipeline (minify + fingerprint) — **not a CDN** (reliability + offline dev).
- Loaded on article pages **that have a photo gallery** (skip the weight when there's no gallery).

## Out of scope

- **YouTube / Vimeo** embeds — future; the current field stores uploaded files, so it'd need a separate field or URL-aware handling.
- Pinch-zoom-into-detail.
- Ads.
- The SPA article-swap itself (this component only needs to stay re-init-safe for when it lands).

## Anticipated files

- Modify `layouts/partials/article-gallery.html` — split the array; render the photo grid; delegate videos.
- Create `layouts/partials/video-gallery.html` (+ small init JS) — the playlist-player.
- Modify `assets/css/musictide.css` — photo-grid + video-gallery styles; remove the old `.mt-gallery` columns masonry.
- Add vendored GLightbox assets + a small init script wired into the article layout.

## Verification

Wire on real posts and screenshot:
- `kerala-dust-no-hard-club` (11 photos) — grid reads left-to-right; lightbox opens fullscreen; arrow-keys/swipe move between photos; Esc closes.
- `verão-chega-mais-cedo-ao-maus-hábitos` (the one video post) — video section renders, thumbnail rail swaps the main player, native controls work.
- A photo-only post — no video section. A no-gallery post — neither section, no GLightbox weight.
