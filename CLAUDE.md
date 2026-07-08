# CLAUDE.md — blowfish (musictide fork)

This is a fork of the [Blowfish Hugo theme](https://github.com/nunocoracao/blowfish) maintained for the **musictide** project. The fork owns the Tailwind CSS build pipeline, allowing arbitrary utility classes in musictide layouts without the silent-drop constraint of the upstream pre-compiled bundle. All musictide layout overrides and custom CSS assets live here — not in the musictide repo.

**Upstream:** `github.com/nunocoracao/blowfish/v2` (v2.103.0, tag origin point)
**Fork module name:** `github.com/n-000000/blowfish/v2`
**Fork remote:** `git@github.com:n-000000/blowfish.git`
**Canonical branch:** `musictide-patches` — always fast-forwarded to the current working branch. `footer-ad-multicreative` is the current working branch and is at the same commit as `musictide-patches`.

---

## Commands

```bash
npm install          # install dependencies (first time, per-clone)
npm run build        # production Tailwind build → assets/css/compiled/main.css
npm run dev          # watch mode Tailwind build
```

After any change to templates or CSS in this fork, run `npm run build` and commit `assets/css/compiled/main.css` before updating musictide's module pin.

---

## How This Connects to musictide

- **Development:** `musictide/config/development/module.yaml` has a `replacements:` block pointing to `/home/n0xx/Code/infra/service/blowfish`. Running `run` (hugo server) in musictide uses this fork directly via the local path replacement.
- **Production (Cloudflare Pages):** No replacement — resolves `github.com/n-000000/blowfish/v2` at the pinned commit in `musictide/go.mod`.
- **Current pin:** `eae962eabab6` (pseudo-version `v2.103.1-0.20260703173540-eae962eabab6`)
- **Pinning a new commit:** After committing in this fork, run in musictide:
  ```bash
  hugo mod get github.com/n-000000/blowfish/v2@<commit-sha>
  hugo mod tidy
  ```

---

## What Lives in This Fork

All musictide layout overrides and custom CSS were migrated here from `musictide/layouts/` and `musictide/assets/css/` (migration complete as of 2026-06-16). The only file that stays in musictide is `layouts/partials/extend-head.html` — it's a Blowfish hook that reads `data/style.yaml` at build time.

**CSS:** `assets/css/musictide.css`, `assets/css/schemes/*.css` (8 custom + all Blowfish built-in schemes)

**Layouts:** `single.html`, `index.html`, `partials/footer.html`, `partials/hero/big.html`, `partials/resolve-feature-image.html`, `partials/article-gallery.html`, `partials/category-badge.html`, `partials/ads.html`, `partials/home/hero.html`, `partials/article-link/card.html`, `partials/article-link/simple.html`, `partials/header/basic.html`, `partials/header/components/desktop-menu.html`, `partials/header/components/mobile-menu.html`, `posts/list.html`, `posts/list.fragment.html`, `categories/term.html`, `categories/term.fragment.html`, `tags/term.html`, `tags/term.fragment.html`, `authors/list.html`

---

## Build Verification

After any change:

```bash
npm run build 2>&1
```

Expected: zero errors. Then verify musictide builds cleanly:

```bash
hugo -s /home/n0xx/Code/infra/service/musictide 2>&1 | grep ERROR
```

Expected: empty.

---

## musictide Context

Full project context lives in `/home/n0xx/Code/infra/service/musictide/CLAUDE.md`. Read it if you need to understand the CMS, deployment pipeline, or content model.
