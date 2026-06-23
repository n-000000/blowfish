(function () {
  'use strict';

  // Keep-the-feed-alive SPA router.
  //   #mt-feed-view    — the current feed (home or one category); hidden, never
  //                      destroyed, while an article is open.
  //   #mt-article-view — an opened article; emptied when the feed is revealed.
  // Only present on feed pages (home / category). On a directly-loaded article
  // page neither exists, so the router degrades to normal navigation.

  if (typeof htmx === 'undefined') return;
  history.scrollRestoration = 'manual';

  var loadedFeedUrl = null;     // '/' or '/categories/{slug}/' currently in #mt-feed-view
  var loadedArticlePath = null; // path currently in #mt-article-view
  var currentView = 'feed';     // 'feed' | 'article'
  var feedScrollY = 0;

  function feedView()    { return document.getElementById('mt-feed-view'); }
  function articleView() { return document.getElementById('mt-article-view'); }

  // --- URL helpers ---
  function catSlug(path) { var m = (path || '').match(/^\/categories\/([^/]+)\/?$/); return m ? m[1] : null; }
  function isArticle(p)  { return /^\/posts\/[^/]+\/?$/.test(p); }
  function feedUrlFor(p) { var s = catSlug(p); return s ? '/categories/' + s + '/' : (p === '/' || p === '' ? '/' : null); }
  function feedFragUrl(u){ return u === '/' ? '/posts/feed-fragment.html' : u + 'feed-fragment.html'; }
  function artFragUrl(p) { return p.replace(/\/?$/, '/') + 'fragment.html'; }
  function hrefPath(a)   { try { return new URL(a.href, location.origin).pathname; } catch (e) { return a.getAttribute('href') || ''; } }
  function feedTitle(feedUrl) {
    var slug = catSlug(feedUrl || '');
    if (!slug) return window.__mtSite || document.title;
    var link = null;
    document.querySelectorAll('[data-category-link]').forEach(function (a) { if (catSlug(hrefPath(a)) === slug) link = a; });
    return (link ? link.textContent.trim() : slug) + ' · ' + (window.__mtSite || '');
  }

  // --- View toggles ---
  function setLayout(w) { var b = document.body.classList; b.toggle('mt-home', w === 'home'); b.toggle('mt-article-page', w === 'article'); }
  function closeMenu()  { var t = document.getElementById('mobile-menu-toggle'); if (t) t.checked = false; }

  function showFeed() {
    var f = feedView(), a = articleView();
    if (a) { a.hidden = true; a.setAttribute('inert', ''); a.innerHTML = ''; }
    if (f) { f.hidden = false; f.removeAttribute('inert'); }
    currentView = 'feed';
    loadedArticlePath = null;
    setLayout('home');
  }
  function showArticle() {
    var f = feedView(), a = articleView();
    if (f) { f.hidden = true; f.setAttribute('inert', ''); }
    if (a) { a.hidden = false; a.removeAttribute('inert'); }
    currentView = 'article';
    setLayout('article');
  }

  function applyNavActive(feedUrl) {
    var active = catSlug(feedUrl || '');
    document.querySelectorAll('[data-category-link]').forEach(function (l) {
      var s = catSlug(hrefPath(l));
      l.classList.toggle('mt-nav-active', s !== null && s === active);
    });
  }

  // --- Navigation actions ---
  function renderFeed(feedUrl, push) {
    if (!feedView()) { location.href = feedUrl; return; }
    htmx.ajax('GET', feedFragUrl(feedUrl), { target: '#mt-feed-view', swap: 'innerHTML' });
    loadedFeedUrl = feedUrl;
    showFeed();
    applyNavActive(feedUrl);
    document.title = feedTitle(feedUrl);
    closeMenu();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (push) history.pushState({ view: 'feed', feedUrl: feedUrl }, '', feedUrl);
  }

  function openArticle(path, push) {
    if (!articleView()) { location.href = path; return; }
    if (push) {
      feedScrollY = window.scrollY;
      history.replaceState({ view: 'feed', feedUrl: loadedFeedUrl, scrollY: feedScrollY }, '', location.pathname + location.search);
    }
    htmx.ajax('GET', artFragUrl(path), { target: '#mt-article-view', swap: 'innerHTML' });
    loadedArticlePath = path.replace(/\/?$/, '/');
    showArticle();
    applyNavActive(null);
    closeMenu();
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (push) history.pushState({ view: 'article', path: path }, '', path);
  }

  // --- Back / forward ---
  window.addEventListener('popstate', function (e) {
    var path = location.pathname;
    if (isArticle(path)) {
      var norm = path.replace(/\/?$/, '/');
      if (loadedArticlePath !== norm || !articleView() || !articleView().innerHTML.trim()) {
        openArticle(path, false);
      } else {
        showArticle();
        applyNavActive(null);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
      return;
    }
    var feedUrl = feedUrlFor(path) || '/';
    if (feedUrl === loadedFeedUrl && feedView()) {
      // article-excursion back: reveal the preserved feed, restore scroll
      showFeed();
      applyNavActive(feedUrl);
      document.title = feedTitle(feedUrl);
      window.scrollTo({ top: (e.state && e.state.scrollY) || 0, left: 0, behavior: 'instant' });
    } else {
      renderFeed(feedUrl, false);
    }
  });

  // --- Wiring (idempotent) ---
  function wireNav() {
    document.querySelectorAll('[data-category-link]').forEach(function (l) {
      if (l._spaWired) return; l._spaWired = true;
      l.addEventListener('click', function (e) {
        if (!feedView()) return;            // not an app page → navigate normally
        var slug = catSlug(hrefPath(l));
        if (!slug) return;
        e.preventDefault();
        var catUrl = '/categories/' + slug + '/';
        if (currentView === 'feed' && catUrl === loadedFeedUrl) {
          renderFeed('/', true);            // toggle off → home
        } else {
          renderFeed(catUrl, true);
        }
      });
    });
  }

  function wireCards() {
    document.querySelectorAll('.mt-grid-item a').forEach(function (l) {
      if (l._spaWired) return; l._spaWired = true;
      l.addEventListener('click', function (e) {
        if (!articleView()) return;
        var p = hrefPath(l);
        if (!isArticle(p)) return;          // ads / non-article links navigate normally
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openArticle(p, true);
      });
    });
  }

  function wireBack() {
    document.querySelectorAll('[data-back-to-feed]').forEach(function (l) {
      if (l._spaWired) return; l._spaWired = true;
      l.addEventListener('click', function (e) {
        if (!feedView()) return;          // cold-loaded article → real link to "/"
        e.preventDefault();
        history.back();                   // popstate reveals feed + restores scrollY
      });
    });
  }

  // --- Post-swap: rewire new content + update title ---
  document.addEventListener('htmx:afterSettle', function (e) {
    wireNav();
    wireCards();
    wireBack();
    if (e.detail && e.detail.target && e.detail.target.id === 'mt-article-view') {
      var h1 = document.querySelector('#mt-article-view h1');
      if (h1) document.title = h1.textContent.trim();
    }
  });

  // --- Init ---
  function init() {
    var path = location.pathname;
    loadedFeedUrl = feedUrlFor(path);
    if (isArticle(path)) {
      currentView = 'article';
      loadedArticlePath = path.replace(/\/?$/, '/');
    } else {
      currentView = 'feed';
      applyNavActive(loadedFeedUrl || '/');
    }
    history.replaceState({ view: currentView, feedUrl: loadedFeedUrl, path: path }, '', path + location.search);
    wireNav();
    wireCards();
    wireBack();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
