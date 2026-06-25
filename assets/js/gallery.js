// Initialises GLightbox over the article photo grid.
// Re-init-safe: idempotent, also runs on htmx:afterSettle (SPA article swap).
// State lives on `window` so that if htmx re-executes the fragment's <script>,
// every run shares ONE lightbox instance and ONE set of listeners.
(function () {
  function initGallery() {
    if (typeof GLightbox === "undefined") return;
    if (!document.querySelector(".mt-glightbox")) return;
    if (window.__mtLightbox) { window.__mtLightbox.destroy(); }
    window.__mtLightbox = GLightbox({
      selector: ".mt-glightbox",
      touchNavigation: true,
      keyboardNavigation: true,
      loop: false,
    });
  }

  if (!window.__mtGalleryWired) {
    window.__mtGalleryWired = true;
    document.addEventListener("htmx:afterSettle", initGallery);
    // GLightbox appends its overlay to <body>, OUTSIDE the SPA's swapped views,
    // so the router never closes it. On back/forward, tear it down ourselves —
    // otherwise the overlay (and the `glightbox-open` scroll-lock) leak onto
    // the revealed feed, leaving stray gallery images over the homepage.
    // We force-remove rather than call close(): the router's popstate handler
    // runs first and empties #mt-article-view, deleting the source anchors that
    // GLightbox's animated close() needs — so close() alone leaves it stuck.
    window.addEventListener("popstate", function () {
      var c = document.querySelector(".glightbox-container");
      if (!c) return;
      try { if (window.__mtLightbox) window.__mtLightbox.destroy(); } catch (e) {}
      window.__mtLightbox = null;            // initGallery rebuilds on next open
      c.remove();
      document.documentElement.classList.remove("glightbox-open");
      document.body.classList.remove("glightbox-open");
    });
  }

  if (document.readyState !== "loading") { initGallery(); }
  else { document.addEventListener("DOMContentLoaded", initGallery); }
}());
