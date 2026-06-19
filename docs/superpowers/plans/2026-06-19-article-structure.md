# Article Page Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the article (post) page to title-centered → credits byline → 3/2 cover → date → body → gallery, and stop the cover from cropping.

**Architecture:** Pure Hugo template + Tailwind-CSS change in the blowfish fork. We rewrite the `main` block of `layouts/_default/single.html` so the title leads and the feature image becomes a plain 3/2 cover (`<img class="mt-article-cover">`) rendered *between* the credits and the date, replacing the old top-of-page `hero/big.html` (16/9, title-less). The unused `authors`-taxonomy rendering is deleted. A handful of new classes go in `assets/css/musictide.css`. No routing, registry, JS, or homepage impact.

**Tech Stack:** Hugo (Go templates), Tailwind CSS v4 (`npm run build`), Playwright (rendered-output verification — this repo has no unit-test harness, so each change is verified against the live-rendered page via `getComputedStyle`/DOM checks, the project's established validation method).

**Spec:** `docs/superpowers/specs/2026-06-19-article-structure-design.md`

---

## Background the engineer needs

- **Two repos:** templates/CSS live in the **fork** at `/home/n0xx/Code/infra/service/blowfish`. The **site** that consumes them is `/home/n0xx/Code/infra/service/musictide`, which references the fork via a local module replacement that is only active with `--environment development`.
- **Why the long build/serve dance:** the musictide dev server caches module-sourced CSS, so to see fork changes you must clear `musictide/resources`, rebuild with `--environment development --ignoreCache`, and serve the static `public/` directory. Playwright then inspects that.
- **The "test" is a rendered-output check.** There is no `pytest`/`jest` here. Each verification step navigates Playwright to a real post and asserts computed styles / DOM order with explicit expected values.

### Reusable command blocks (referenced by tasks below)

**BUILD_CSS** — compile Tailwind in the fork:
```bash
cd /home/n0xx/Code/infra/service/blowfish && npm run build 2>&1 | tail -2
```
Expected: ends with `Done in <n>ms` and no error lines.

**REBUILD_SITE** — rebuild musictide against the fork and (re)serve it:
```bash
rm -rf /home/n0xx/Code/infra/service/musictide/resources
hugo --environment development --ignoreCache -s /home/n0xx/Code/infra/service/musictide 2>&1 | tail -3
# serve (only needed once; ignore "Address already in use" if already running):
( cd /home/n0xx/Code/infra/service/musictide && python3 -m http.server 1314 --directory public >/dev/null 2>&1 & )
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:1314/
```
Expected: hugo build shows a totals table with **no `ERROR` lines**; curl prints `200`.

**TEST_POST_URL** — a post that has both a feature image and a credit byline:
`http://localhost:1314/posts/imaginarios/` (the current homepage hero → has a feature image).

---

## Task 1: Add article-header CSS

**Files:**
- Modify: `/home/n0xx/Code/infra/service/blowfish/assets/css/musictide.css` (append a new section near the other article rules, e.g. after the `ARTICLE HERO` block around line 409)

- [ ] **Step 1: Add the new classes**

Append this block to `assets/css/musictide.css`:

```css
/* ═══════════════════════════════════════════════════════════
   ARTICLE HEADER (single post) — centered title/byline, 3/2 cover
   ═══════════════════════════════════════════════════════════ */
.mt-article-header {
  text-align: center;
}

/* Feature image as a plain cover (was the 16/9 zoomable hero) */
.mt-article-cover {
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
  margin: 0.5rem 0 1rem;
}

/* article-meta/basic renders the date inside a flex row; center it */
.mt-article-date {
  display: flex;
  justify-content: center;
}
```

- [ ] **Step 2: Build the CSS**

Run **BUILD_CSS**.
Expected: `Done in <n>ms`, no errors.

- [ ] **Step 3: Confirm the class reached the compiled bundle**

Run:
```bash
grep -c "mt-article-cover" /home/n0xx/Code/infra/service/blowfish/assets/css/compiled/main.css
```
Expected: `1` (or greater).

- [ ] **Step 4: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add assets/css/musictide.css assets/css/compiled/main.css
git commit -m "feat(article): add centered-header + 3/2 cover styles

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Restructure `single.html` (reorder + 3/2 cover + drop dead author rendering)

**Files:**
- Modify: `/home/n0xx/Code/infra/service/blowfish/layouts/_default/single.html` (replace the entire `{{ define "main" }}…{{ end }}` block, and delete the `{{ define "SingleAuthor" }}…{{ end }}` block)

What this changes vs. today:
- **Removes** the top `{{ if .Params.showHero }} … {{ end }}` hero block (the 16/9 `hero/big.html`).
- **Title** moves to the top of `<header>` and is centered (via `.mt-article-header`).
- **Credits** move directly under the title (was below the meta line).
- **Cover** is a new plain `<img class="mt-article-cover">` (3/2), rendered after the credits, **omitted when the post has no feature image**.
- **Date** (`article-meta/basic.html`, already date-only under current config) moves below the cover.
- **Removes** both `{{ template "SingleAuthor" . }}` calls and the `SingleAuthor` definition (unused: 0 posts use `authors:`, no `data/authors`).
- Body, gallery, sharing/related, footer/pagination, comments: unchanged.

- [ ] **Step 1: Replace the `main` block**

Replace everything from `{{ define "main" }}` (line 1) through the closing `{{ end }}` of `SingleAuthor` (line 151) with exactly this:

```go-html-template
{{ define "main" }}
  {{ .Scratch.Set "scope" "single" }}
  <article>

    {{/* ── Header: title (centered) → credits → 3/2 cover → date ── */}}
    <header id="single_header" class="mt-article-header mt-5">
      {{ if .Params.showBreadcrumbs | default (site.Params.article.showBreadcrumbs | default false) }}
        {{ partial "breadcrumbs.html" . }}
      {{ end }}

      <h1 class="mt-0 text-4xl font-extrabold text-neutral-900 dark:text-neutral">
        {{ .Title | emojify }}
      </h1>

      {{/* Credits = the site's real attribution byline */}}
      {{- $ct := .Params.credit_texto -}}
      {{- $cf := .Params.credit_fotos -}}
      {{- $cv := .Params.credit_video -}}
      {{- if or $ct $cf $cv }}
        <p class="mt-1 mb-4 text-sm text-neutral-500 dark:text-neutral-400 print:hidden">
          {{- if $ct }}Texto: {{ $ct }}{{ end -}}
          {{- if and $ct (or $cf $cv) }} · {{ end -}}
          {{- if $cf }}Fotos: {{ $cf }}{{ end -}}
          {{- if and $cf $cv }} · {{ end -}}
          {{- if $cv }}Vídeo: {{ $cv }}{{ end -}}
        </p>
      {{- end }}

      {{/* Cover: feature image at 3/2, content width; omitted when none */}}
      {{- with partial "resolve-feature-image.html" (dict "Page" . "Globs" (slice "*feature*" "*cover*" "*thumbnail*")) }}
        {{- with .URL }}
          <img
            src="{{ . }}"
            alt="{{ $.Title }}"
            class="mt-article-cover nozoom"
            loading="eager"
            decoding="async">
        {{- end }}
      {{- end }}

      {{/* Date only (showReadingTime is off in config) */}}
      <div class="mt-article-date mb-6 text-base text-neutral-500 dark:text-neutral-400 print:hidden">
        {{ partial "article-meta/basic.html" (dict "context" . "scope" "single") }}
      </div>
    </header>

    {{/* ── Body ── */}}
    <section class="flex flex-col max-w-full mt-0 prose dark:prose-invert lg:flex-row">
      {{ $enableToc := site.Params.article.showTableOfContents | default false }}
      {{ $enableToc = .Params.showTableOfContents | default $enableToc }}
      {{ $showToc := and $enableToc (in .TableOfContents "<ul") }}
      {{ $topClass := cond (hasPrefix site.Params.header.layout "fixed") "lg:top-[140px]" "lg:top-10" }}
      {{ if $showToc }}
        <div class="order-first lg:ms-auto px-0 lg:order-last lg:ps-8 lg:max-w-2xs">
          <div class="toc ps-5 print:hidden lg:sticky {{ $topClass }}">
            {{ partial "toc.html" . }}
          </div>
        </div>
      {{ end }}

      <div class="min-w-0 min-h-0">
        {{ partial "series/series.html" . }}
        <div class="article-content mb-8">
          {{ .Content }}
          {{ $defaultReplyByEmail := site.Params.replyByEmail }}
          {{ $replyByEmail := default $defaultReplyByEmail .Params.replyByEmail }}
          {{ if $replyByEmail }}
            <strong class="block mt-8">
              <a
                class="email-link m-1 rounded bg-neutral-300 p-1.5 text-neutral-700 hover:bg-primary-500 hover:text-neutral dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-primary-400 dark:hover:text-neutral-800"
                href="#"
                data-email="{{ site.Params.Author.email | base64Encode }}"
                data-subject="{{ replace (printf "Reply to %s" .Title) "\"" "'" }}">
                {{ i18n "article.reply_by_email" | default "Reply by Email" }}
              </a>
              <noscript>
                <span
                  class="m-1 rounded bg-neutral-300 p-1.5 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300">
                  {{ i18n "article.reply_by_email" | default "Reply by Email" }} (require JavaScript)
                </span>
              </noscript>
            </strong>
          {{ end }}
        </div>
        {{ partial "article-gallery.html" . }}
        {{ partial "series/series-closed.html" . }}
        {{ partial "sharing-links.html" . }}
        {{ partial "related.html" . }}
      </div>
    </section>

    {{/* ── Footer ── */}}
    <footer class="pt-8 print:hidden">
      {{ partial "article-pagination.html" . }}
      {{ if .Params.showComments | default (site.Params.article.showComments | default false) }}
        {{ if templates.Exists "partials/comments.html" }}
          <div class="pt-3">
            <hr class="border-dotted border-neutral-300 dark:border-neutral-600" />
            <div class="pt-3">
              {{ partial "comments.html" . }}
            </div>
          </div>
        {{ else }}
          {{ warnf "[BLOWFISH] Comments are enabled for %s but no comments partial exists." .File.Path }}
        {{ end }}
      {{ end }}
    </footer>
  </article>
{{ end }}
```

(Note: the `SingleAuthor` define is intentionally gone — the file now ends at the `main` block's `{{ end }}`.)

- [ ] **Step 2: Rebuild the site and serve**

Run **REBUILD_SITE**.
Expected: no `ERROR` lines from hugo; curl prints `200`.

- [ ] **Step 3: Verify structure + cover on a real post (Playwright)**

Navigate Playwright to **TEST_POST_URL** at a desktop size (resize 1280×900), then evaluate:

```js
() => {
  const header = document.querySelector('#single_header');
  const kids = [...header.children].map(el => el.tagName.toLowerCase() + (el.className ? '.' + el.className.split(' ')[0] : ''));
  const cover = document.querySelector('.mt-article-cover');
  const r = cover && cover.getBoundingClientRect();
  return {
    headerOrder: kids,                                            // expect: h1, p(credits), img.mt-article-cover, div.mt-article-date
    headerTextAlign: getComputedStyle(header).textAlign,         // expect: "center"
    coverPresent: !!cover,                                        // expect: true
    coverAspect: cover && getComputedStyle(cover).aspectRatio,   // expect: "3 / 2"
    coverRatio: r && +(r.width / r.height).toFixed(2),           // expect: ~1.5
    oldHeroGone: !document.querySelector('.mt-hero-article, .mt-hero-figure'), // expect: true
    coverBeforeContent: !!(cover && document.querySelector('.article-content') &&
      (cover.compareDocumentPosition(document.querySelector('.article-content')) & Node.DOCUMENT_POSITION_FOLLOWING)), // expect: true
  };
}
```
Expected: `headerOrder` is `["h1","p.mt-1","img.mt-article-cover","div.mt-article-date"]` (class prefixes may differ slightly; the important thing is **h1 → p → img → div** order), `headerTextAlign: "center"`, `coverPresent: true`, `coverAspect: "3 / 2"`, `coverRatio` ≈ `1.5`, `oldHeroGone: true`, `coverBeforeContent: true`.

- [ ] **Step 4: Screenshot for the human**

Take a full-page Playwright screenshot of **TEST_POST_URL** (filename `article-structure-after.png`) and send it to the user with `SendUserFile`.

- [ ] **Step 5: Verify the no-image case is safe**

The cover is wrapped in `{{ with … }}{{ with .URL }}…{{ end }}{{ end }}`, so a post without a feature image renders no `<img class="mt-article-cover">` and cannot error. Confirm the build in Step 2 had no errors (a nil-deref would have failed the build). No separate action needed unless Step 2 errored.

- [ ] **Step 6: Commit**

```bash
cd /home/n0xx/Code/infra/service/blowfish
git add layouts/_default/single.html
git commit -m "feat(article): reorder to centered title -> credits -> 3/2 cover -> date

Title leads (centered); credits become the attribution byline; feature
image renders as a plain 3/2 cover (was a 16/9 zoomable hero, which cropped);
date moves below the cover. Removes the unused authors-taxonomy rendering.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Title centered above cover → Task 2 (`.mt-article-header` text-align center; title first in header). ✓
- Credits as "authors field text" under title → Task 2 (credits block directly after h1). ✓
- Cover 3/2, content-width, always-shown-when-present, omitted otherwise → Task 1 (`.mt-article-cover`) + Task 2 (`with .URL` guard). ✓
- Date below cover, date-only → Task 2 (`article-meta/basic` already date-only via config). ✓
- Body text then gallery, unchanged → Task 2 (section/body untouched). ✓
- Remove unused authors taxonomy rendering → Task 2 (drops both `SingleAuthor` calls + definition). ✓
- Out of scope (TOC/sharing/related/comments/navigator) left intact → Task 2 keeps them verbatim. ✓

**Placeholder scan:** none — every step has exact code/commands/expected output.

**Type/name consistency:** `.mt-article-header`, `.mt-article-cover`, `.mt-article-date` are defined in Task 1 and used in Task 2 with identical names. ✓

---

## Notes / follow-ons (NOT part of this plan)

- `layouts/partials/hero/big.html` becomes unused once the hero call is removed; leaving it in place is harmless. Don't delete it in this plan.
- The cover is intentionally **not** click-to-zoom (spec says plain image). Zoom belongs to the media-gallery spec (Spec B).
- Credits byline currently shows the full `Texto/Fotos/Vídeo` line; if only the text author is wanted there later, it's a one-line template tweak.
