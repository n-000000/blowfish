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
