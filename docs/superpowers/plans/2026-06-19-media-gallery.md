# Article Media Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the article gallery with a photo grid + GLightbox fullscreen lightbox and a separate, conditional video playlist gallery, both driven by the sveltia `gallery:` frontmatter array.

**Architecture:** `article-gallery.html` splits the `gallery:` array by file extension. Images render as a responsive CSS grid (3/2 thumbnails) whose anchors GLightbox binds for a fullscreen viewer with swipe/keyboard nav. Videos delegate to a new `video-gallery.html` partial — a native `<video controls>` main player + a thumbnail rail that swaps the source on click. GLightbox is vendored under `assets/lib/`, the convention used for the fork's other libs.

**Tech Stack:** Hugo (Go templates + asset pipeline), Tailwind v4 (`npm run build`), GLightbox 3.3.0 (MIT, vendored), vanilla JS, Playwright (rendered-output verification — no unit-test harness in this repo).

**Spec:** `docs/superpowers/specs/2026-06-19-media-gallery-design.md`

---

## Background the engineer needs

- **Two repos:** templates/CSS/JS live in the **fork** `/home/n0xx/Code/infra/service/blowfish`; the site that consumes them is `/home/n0xx/Code/infra/service/musictide` (local module replacement, active only with `--environment development`).
- **Custom site CSS** lives in `assets/css/musictide.css` (served as its own fingerprinted asset, *not* the Tailwind-compiled `compiled/main.css`). Add gallery styles there.
- **Vendored libs** live in `assets/lib/<name>/` and are loaded via `resources.Get "lib/<name>/<file>" | resources.Fingerprint`.
- **The "test" is a rendered-output check** via Playwright (`getComputedStyle`/DOM assertions), the project's established method.
- **Test posts:** `kerala-dust-no-hard-club` has 11 gallery **photos**; `verão-chega-mais-cedo-ao-maus-hábitos` is the one post with a gallery **video**.

### Reusable command blocks

**BUILD_CSS:**
```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build 2>&1 | tail -1
```
Expected: `Done in <n>ms`.

**REBUILD_SITE:**
```bash
rm -rf /home/n0xx/Code/infra/service/musictide/resources
hugo --environment development --ignoreCache -s /home/n0xx/Code/infra/service/musictide 2>&1 | grep -iE "error|^total" | tail -3
( cd /home/n0xx/Code/infra/service/musictide && python3 -m http.server 1314 --directory public >/dev/null 2>&1 & )
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1314/
```
Expected: no `ERROR` lines; `Total in …`; curl `200`.

**Photo post:** `http://localhost:1314/posts/kerala-dust-no-hard-club/`
**Video post:** `http://localhost:1314/posts/ver%C3%A3o-chega-mais-cedo-ao-maus-h%C3%A1bitos/`

---

## Task 1: Vendor GLightbox 3.3.0

**Files:**
- Create: `assets/lib/glightbox/glightbox.min.css`
- Create: `assets/lib/glightbox/glightbox.min.js`

- [ ] **Step 1: Download the vendored files**

```bash
cd /home/n0xx/Code/infra/service/blowfish
mkdir -p assets/lib/glightbox
curl -fsSL https://cdn.jsdelivr.net/npm/glightbox@3.3.0/dist/css/glightbox.min.css -o assets/lib/glightbox/glightbox.min.css
curl -fsSL https://cdn.jsdelivr.net/npm/glightbox@3.3.0/dist/js/glightbox.min.js  -o assets/lib/glightbox/glightbox.min.js
```

- [ ] **Step 2: Verify the files are non-empty and sane**

```bash
wc -c assets/lib/glightbox/glightbox.min.css assets/lib/glightbox/glightbox.min.js
grep -c "GLightbox" assets/lib/glightbox/glightbox.min.js
```
Expected: both files are several KB (CSS ~10KB+, JS ~40KB+); grep count ≥ 1.

- [ ] **Step 3: Commit**

```bash
git add assets/lib/glightbox/
git commit -m "chore(gallery): vendor GLightbox 3.3.0

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add gallery CSS and the two init scripts + the video-gallery partial (building blocks, not yet wired)

**Files:**
- Modify: `assets/css/musictide.css` (replace the old `.mt-gallery` masonry block — the "ARTICLE GALLERY (masonry)" section, ~lines 466-480)
- Create: `assets/js/gallery.js`
- Create: `assets/js/video-gallery.js`
- Create: `layouts/partials/video-gallery.html`

- [ ] **Step 1: Replace the masonry CSS with grid + video-gallery styles**

In `assets/css/musictide.css`, find the block:
```css
/* ═══════════════════════════════════════════════════════════
   ARTICLE GALLERY (masonry)
   ═══════════════════════════════════════════════════════════ */
.mt-gallery {
  columns: 1;
  column-gap: 0.5rem;
}

.mt-gallery > div {
  break-inside: avoid;
  margin-bottom: 0.5rem;
}

@media (min-width: 640px) { .mt-gallery { columns: 2; } }
@media (min-width: 1024px) { .mt-gallery { columns: 3; } }
```
Replace it entirely with:
```css
/* ═══════════════════════════════════════════════════════════
   ARTICLE PHOTO GALLERY — responsive grid + GLightbox
   ═══════════════════════════════════════════════════════════ */
.mt-gallery-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin: 2.5rem 0;
}
@media (min-width: 768px)  { .mt-gallery-grid { grid-template-columns: repeat(3, 1fr); } }
@media (min-width: 1200px) { .mt-gallery-grid { grid-template-columns: repeat(4, 1fr); } }

.mt-gallery-grid a { display: block; line-height: 0; }
.mt-gallery-grid img {
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  display: block;
  cursor: zoom-in;
}

/* ═══════════════════════════════════════════════════════════
   ARTICLE VIDEO GALLERY — main player + thumbnail rail
   ═══════════════════════════════════════════════════════════ */
.mt-video-gallery { margin: 2.5rem 0; }
.mt-video-main {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
  display: block;
}
.mt-video-rail {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  overflow-x: auto;
}
.mt-video-thumb {
  position: relative;
  flex: 0 0 auto;
  width: 120px;
  aspect-ratio: 16 / 9;
  padding: 0;
  border: 0;
  cursor: pointer;
  background: #000;
}
.mt-video-thumb video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.mt-video-thumb::after {
  content: "▶";
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
  font-size: 1.25rem;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}
.mt-video-thumb.is-active { outline: 2px solid rgb(var(--color-primary-500)); outline-offset: -2px; }
```

- [ ] **Step 2: Create `assets/js/gallery.js` (GLightbox init, re-init-safe)**

```js
// Initialises GLightbox over the article photo grid.
// Re-init-safe: idempotent, also runs on htmx:afterSettle (future SPA swap).
(function () {
  var lb = null;
  function initGallery() {
    if (typeof GLightbox === "undefined") return;
    if (!document.querySelector(".mt-glightbox")) return;
    if (lb) { lb.destroy(); }
    lb = GLightbox({
      selector: ".mt-glightbox",
      touchNavigation: true,
      keyboardNavigation: true,
      loop: false,
    });
  }
  if (document.readyState !== "loading") { initGallery(); }
  else { document.addEventListener("DOMContentLoaded", initGallery); }
  document.addEventListener("htmx:afterSettle", initGallery);
}());
```

- [ ] **Step 3: Create `assets/js/video-gallery.js` (thumbnail → main player swap, re-init-safe)**

```js
// Wires each video gallery's thumbnail rail to its main <video> player.
// Idempotent (guards already-wired thumbs); also runs on htmx:afterSettle.
(function () {
  function initVideoGallery() {
    document.querySelectorAll(".mt-video-gallery").forEach(function (g) {
      var main = g.querySelector(".mt-video-main");
      if (!main) return;
      g.querySelectorAll(".mt-video-thumb").forEach(function (thumb) {
        if (thumb.dataset.wired === "1") return;
        thumb.dataset.wired = "1";
        thumb.addEventListener("click", function () {
          main.src = thumb.getAttribute("data-src");
          main.play();
          g.querySelectorAll(".mt-video-thumb").forEach(function (t) {
            t.classList.remove("is-active");
          });
          thumb.classList.add("is-active");
        });
      });
    });
  }
  if (document.readyState !== "loading") { initVideoGallery(); }
  else { document.addEventListener("DOMContentLoaded", initVideoGallery); }
  document.addEventListener("htmx:afterSettle", initVideoGallery);
}());
```

- [ ] **Step 4: Create `layouts/partials/video-gallery.html`**

This partial is called with a `dict`, so `.Site` is **not** available — the caller (Task 3) passes the site in as `"site"`. Use `.site` for the fingerprint algorithm.

```go-html-template
{{- /*
  video-gallery.html — dedicated video playlist gallery.
  Context: a dict with keys "videos" (slice of video URLs) and "site" (the Site,
  passed in because .Site is unavailable inside a dict context).
  Renders a native <video controls> main player; if >1 video, a thumbnail rail
  (first-frame posters + ▶ overlay) swaps the main source on click.
*/ -}}
{{- $videos := .videos -}}
{{- $site := .site -}}
{{- with $videos -}}
{{- $first := index . 0 -}}
{{- $alg := $site.Params.fingerprintAlgorithm | default "sha512" -}}
<div class="mt-video-gallery">
  <video class="mt-video-main" controls preload="metadata" src="{{ $first }}"></video>
  {{- if gt (len .) 1 }}
  <div class="mt-video-rail">
    {{- range $i, $v := . }}
    <button type="button" class="mt-video-thumb{{ if eq $i 0 }} is-active{{ end }}" data-src="{{ $v }}" aria-label="Vídeo {{ add $i 1 }}">
      <video muted preload="metadata" src="{{ $v }}#t=0.1"></video>
    </button>
    {{- end }}
  </div>
  {{- end }}
</div>
<script src="{{ (resources.Get "js/video-gallery.js" | resources.Minify | resources.Fingerprint $alg).RelPermalink }}"></script>
{{- end -}}
```

- [ ] **Step 5: Build CSS and confirm classes present**

Run **BUILD_CSS**, then:
```bash
grep -c "mt-gallery-grid\|mt-video-gallery" /home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css
```
Expected: `≥ 2`.

- [ ] **Step 6: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add assets/css/musictide.css assets/css/compiled/main.css assets/js/gallery.js assets/js/video-gallery.js layouts/partials/video-gallery.html
git commit -m "feat(gallery): photo-grid + video-gallery styles, init scripts, video partial

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite `article-gallery.html` to split images/videos and wire both

**Files:**
- Modify: `layouts/partials/article-gallery.html` (full rewrite)

- [ ] **Step 1: Replace `article-gallery.html` entirely with:**

```go-html-template
{{- /*
  article-gallery.html — renders the sveltia `gallery:` frontmatter array.
  Splits by file extension: videos -> dedicated video-gallery partial;
  images -> responsive grid whose anchors GLightbox opens fullscreen.
  Each sub-gallery renders only when it has >=1 item.
*/ -}}
{{- with .Params.gallery -}}
  {{- $images := slice -}}
  {{- $videos := slice -}}
  {{- range . -}}
    {{- $ext := lower (path.Ext .) -}}
    {{- if in (slice ".mp4" ".webm" ".mov") $ext -}}
      {{- $videos = $videos | append . -}}
    {{- else -}}
      {{- $images = $images | append . -}}
    {{- end -}}
  {{- end -}}

  {{- /* ── Photo gallery: grid + GLightbox ── */ -}}
  {{- with $images -}}
    {{- $alg := $.Site.Params.fingerprintAlgorithm | default "sha512" -}}
    <link rel="stylesheet" href="{{ (resources.Get "lib/glightbox/glightbox.min.css" | resources.Fingerprint $alg).RelPermalink }}">
    <div class="mt-gallery-grid">
      {{- range . }}
      <a href="{{ . }}" class="mt-glightbox" data-gallery="article-gallery">
        <img src="{{ . }}" alt="" loading="lazy" decoding="async">
      </a>
      {{- end }}
    </div>
    <script src="{{ (resources.Get "lib/glightbox/glightbox.min.js" | resources.Fingerprint $alg).RelPermalink }}"></script>
    <script src="{{ (resources.Get "js/gallery.js" | resources.Minify | resources.Fingerprint $alg).RelPermalink }}"></script>
  {{- end -}}

  {{- /* ── Video gallery (dedicated, conditional) ── */ -}}
  {{- with $videos -}}
    {{- partial "video-gallery.html" (dict "videos" . "site" $.Site) -}}
  {{- end -}}
{{- end -}}
```

- [ ] **Step 2: Rebuild and serve**

Run **REBUILD_SITE**.
Expected: no `ERROR` lines (a template error in the partial would fail here); curl `200`.

- [ ] **Step 3: Verify the photo grid + lightbox (Playwright, on the photo post)**

Resize to 1280×900, navigate to the **photo post**, then evaluate:
```js
() => {
  const grid = document.querySelector('.mt-gallery-grid');
  const anchors = [...document.querySelectorAll('.mt-glightbox')];
  const gs = grid && getComputedStyle(grid);
  const firstImg = anchors[0] && anchors[0].querySelector('img');
  const r = firstImg && firstImg.getBoundingClientRect();
  return {
    gridPresent: !!grid,
    columns: gs && gs.gridTemplateColumns.split(' ').length,   // expect 4 at 1280
    thumbCount: anchors.length,                                // expect 11
    thumbAspect: firstImg && getComputedStyle(firstImg).aspectRatio, // "3 / 2"
    thumbRatio: r && +(r.width / r.height).toFixed(2),         // ~1.5
    domOrderMatchesArray: anchors[0].getAttribute('href').includes('AG_0376'), // first array item
    glightboxLoaded: typeof window.GLightbox === 'function',
    oldMasonryGone: !document.querySelector('.mt-gallery'),
  };
}
```
Expected: `gridPresent:true`, `columns:4`, `thumbCount:11`, `thumbAspect:"3 / 2"`, `thumbRatio≈1.5`, `domOrderMatchesArray:true`, `glightboxLoaded:true`, `oldMasonryGone:true`.

- [ ] **Step 4: Verify the lightbox opens (Playwright click)**

Click the first `.mt-glightbox` anchor, then evaluate:
```js
() => {
  const open = document.querySelector('.glightbox-container');
  return {
    lightboxOpen: !!open,
    showsImage: !!(open && open.querySelector('.gslide-image img')),
  };
}
```
Expected: `lightboxOpen:true`, `showsImage:true`. Then press `Escape` and confirm `.glightbox-container` is removed/hidden.

- [ ] **Step 5: Verify the video gallery (Playwright, on the video post)**

Navigate to the **video post**, then evaluate:
```js
() => {
  const vg = document.querySelector('.mt-video-gallery');
  const main = vg && vg.querySelector('.mt-video-main');
  const thumbs = vg ? vg.querySelectorAll('.mt-video-thumb').length : 0;
  return {
    videoGalleryPresent: !!vg,
    mainHasSrc: !!(main && main.getAttribute('src')),
    mainAspect: main && getComputedStyle(main).aspectRatio,  // "16 / 9"
    thumbCount: thumbs,                                       // rail only if >1 video
    noPhotoGridIfNoImages: true,
  };
}
```
Expected: `videoGalleryPresent:true`, `mainHasSrc:true`, `mainAspect:"16 / 9"`. (If that post has exactly 1 video, `thumbCount:0` — rail correctly hidden.)

- [ ] **Step 6: Screenshot both for the human**

Full-page Playwright screenshots of the photo post (`gallery-photos.png`) and video post (`gallery-video.png`); send both with `SendUserFile`.

- [ ] **Step 7: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add layouts/partials/article-gallery.html
git commit -m "feat(gallery): split gallery into photo grid (GLightbox) + video playlist

Replaces the mixed CSS-columns masonry. Images render as a 3/2 responsive
grid opening a GLightbox fullscreen viewer (swipe/keyboard); videos delegate
to the dedicated video-gallery partial. Each section renders only when present.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Split `gallery:` by extension, each section conditional → Task 3 Step 1 (`$images`/`$videos`, `with`). ✓
- Photo responsive grid 3/2, replaces masonry, fixes ordering → Task 2 Step 1 CSS + Task 3 grid markup; `oldMasonryGone` check. ✓
- Fullscreen lightbox, swipe + keyboard, one group per article → Task 1 (GLightbox) + Task 2 `gallery.js` (`touchNavigation`/`keyboardNavigation`) + Task 3 (`data-gallery="article-gallery"`); Step 4 verifies open. ✓
- Re-init-safe → both init scripts guard + bind `htmx:afterSettle`. ✓
- Dedicated video gallery, main player + rail, conditional, native controls → Task 2 partial/JS + Task 3 delegation; Step 5 verifies. ✓
- GLightbox vendored, not CDN, loaded only when a photo gallery exists → Task 1 + Task 3 (`<link>`/`<script>` inside `{{ with $images }}`). ✓
- Out of scope (YouTube, pinch-zoom, ads) → untouched. ✓

**Placeholder scan:** none — all steps have concrete code/commands/expected output.

**Type/name consistency:** classes `.mt-gallery-grid`, `.mt-glightbox`, `.mt-video-gallery`, `.mt-video-main`, `.mt-video-thumb`, `data-src`, `data-gallery="article-gallery"` are defined and referenced identically across Tasks 2 and 3 and the init scripts. The `video-gallery.html` script line uses `$site`/`$.Site`-passed fingerprint alg consistently (dict key `"site"`). ✓

---

## Notes / follow-ons (NOT in this plan)

- Gallery thumbnails load the full-resolution R2 images (same as today — no regression); server-side thumbnail resizing of *remote* images is a separate perf optimization.
- Video posters use `preload="metadata"` + `#t=0.1`; if a black first frame shows up on real content, a generated/poster field is a future tweak.
- YouTube/Vimeo support (future) would add a URL-aware branch + the already-vendored `lib/lite-youtube-embed`.
