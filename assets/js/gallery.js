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
