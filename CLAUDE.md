# CLAUDE.md — blowfish (musictide fork)

This is a fork of the [Blowfish Hugo theme](https://github.com/nunocoracao/blowfish) maintained for the **musictide** project. The fork owns the Tailwind CSS build pipeline, allowing arbitrary utility classes in musictide layouts without the silent-drop constraint of the upstream pre-compiled bundle.

**Upstream:** `github.com/nunocoracao/blowfish/v2` (v2.103.0, tag origin point)
**Fork module name:** `github.com/n-000000/blowfish/v2` (set in Task 1 of the plan)
**Fork remote:** `git@github.com:n-000000/blowfish.git`
**Working branch:** `musictide-patches` (created in Task 1; all migration work lives here)

---

## Implementation Plan

`docs/superpowers/plans/2026-06-15-blowfish-fork.md` — 15 tasks, all complete as of 2026-06-16.

- Task 0 (Hugo deprecation fixes): done in musictide repo commit `39d9e87`
- Tasks 1–13: all migration work complete — every musictide layout override and CSS asset is now in this fork
- Task 14 (verification): local verification complete; push to GitHub pending (see note below)

**Pending: push to GitHub.** The `musictide-patches` branch is not yet pushed to `git@github.com:n-000000/blowfish.git`. GitHub is rejecting the push (GH007) because commits use `nluisgoncalves@gmail.com`. To resolve, either:
1. Disable "Block command line pushes that expose my email" at https://github.com/settings/emails (no history rewrite needed), or
2. Rewrite commit history to use `29106114+n-000000@users.noreply.github.com` and force-push.

Once pushed, pin the commit in musictide:
```bash
hugo mod get github.com/n-000000/blowfish/v2@<commit-sha>
hugo mod tidy
```

---

## Commands

```bash
npm install          # install dependencies (first time)
npm run build        # production Tailwind build → assets/css/compiled/main.css
npm run dev          # watch mode Tailwind build
```

After any change to templates or CSS in this fork, run `npm run build` and commit `assets/css/compiled/main.css` before updating musictide's module pin.

---

## How This Connects to musictide

- **Development:** `musictide/config/development/module.yaml` contains a `replacements:` block pointing to `/home/n0xx/Code/infra/service/blowfish`. `yarn watch` in musictide uses this fork directly.
- **Production (Cloudflare Pages):** No replacement — resolves from `github.com/n-000000/blowfish/v2` at the pinned commit in `musictide/go.mod`.
- **Pinning a new commit:** After committing in this fork, run in musictide:
  ```bash
  hugo mod get github.com/n-000000/blowfish/v2@<commit-sha>
  hugo mod tidy
  ```

---

## What Is Being Migrated Into This Fork

All musictide layout overrides from `musictide/layouts/` and custom CSS from `musictide/assets/css/` are being moved here. Each migration is an atomic commit pair: one commit here adding the template/CSS, one commit in musictide deleting the now-redundant local override.

**CSS files:** `musictide.css`, 8 color scheme files (`assets/css/schemes/*.css`)

**Layout overrides:** `single.html`, `index.html`, `partials/footer.html`, `partials/hero/big.html`, `partials/resolve-feature-image.html`, `partials/article-gallery.html`, `partials/category-badge.html`, `partials/ads-data.html`, `partials/ad-slot.html`, `partials/home/hero.html`, `partials/article-link/card.html`, `partials/article-link/simple.html`, `partials/header/basic.html`, `partials/header/components/desktop-menu.html`, `partials/header/components/mobile-menu.html`, `posts/list.html`, `posts/list.fragment.html`, `categories/term.html`, `categories/term.fragment.html`, `tags/term.html`, `tags/term.fragment.html`, `authors/list.html`

Note: `partials/extend-head.html` stays in musictide — it gets trimmed task-by-task as style blocks and scripts are removed, but is never moved to the fork.

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
