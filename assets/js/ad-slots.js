/*
  ad-slots.js — rotating content-ad slots with cross-slot coordination.

  The content-ad pool is emitted once per page as
    <script type="application/json" id="mt-content-ad-pool">[{img,href,alt},…]</script>
  (see partials/ad-slots-boot.html). Every ad *display* — a slot's first tick and
  each 5s tick after — pulls the next entry from ONE page-load-shuffled queue via a
  monotonic cursor `g`: display = q[g++ % N]. That single shared cursor gives:
    • equal *seen* exposure   — the cursor sweeps the whole shuffled queue evenly;
    • no two visible slots on the same ad — a tick assigns consecutive cursor values
      to the visible slots, distinct up to N.
  It needs no knowledge of how many slots exist or when they appear, so it survives
  the homepage's HTMX infinite-scroll grid (slots stream in over time, k → ∞).

  Slots are registered on load AND on htmx:afterSettle (the event every musictide
  module keys off; after an outerHTML swap e.detail.elt is the *detached old* node,
  so we re-query from document, never from the event target). Only slots currently
  in the viewport rotate (IntersectionObserver) — off-screen impressions nobody
  sees don't "spend" exposure, and an endless page doesn't animate hundreds of cells.
*/
(function () {
  var poolEl = document.getElementById('mt-content-ad-pool');
  if (!poolEl) return;
  var pool;
  try { pool = JSON.parse(poolEl.textContent); } catch (e) { return; }
  if (!Array.isArray(pool) || pool.length === 0) return;
  var N = pool.length;

  // Fisher–Yates. Unseeded → fresh order per page load (per-visitor equal exposure).
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  var q = shuffle(pool.slice());
  var g = 0;
  var slots = []; // { el, front, back, visible }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.target.__adSlot) en.target.__adSlot.visible = en.isIntersecting;
    });
  }, { rootMargin: '0px' });

  function fill(layer, ad) {
    layer.href = ad.href;
    var img = layer.querySelector('img');
    if (img) { img.src = ad.img; img.alt = ad.alt || ''; }
  }

  // A slot enters as one server-rendered .mt-ad-card (frame-0, also the no-JS ad).
  // We clone it into a second stacked layer and crossfade between the two.
  function register(el) {
    if (el.dataset.adObserved) return;
    el.dataset.adObserved = '1';
    var front = el.querySelector('.mt-ad-card');
    if (!front) return;
    var back = front.cloneNode(true);
    back.classList.add('mt-ad-hidden'); // front (server card) stays visible → no-JS-safe
    el.appendChild(back);
    var s = { el: el, front: front, back: back, visible: false };
    el.__adSlot = s;
    slots.push(s);
    io.observe(el);
  }

  function scan() {
    document.querySelectorAll('.mt-ad-slot:not([data-ad-observed])').forEach(register);
  }

  function tick() {
    if (g >= N) { shuffle(q); g = 0; } // reshuffle each full pass (matters on endless scroll)
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (!s.visible) continue; // frozen off-screen; rejoins next tick when visible
      fill(s.back, q[g++ % N]); // % N only bites when >N slots visible at once (pigeonhole)
      s.back.classList.remove('mt-ad-hidden');  // fade incoming in
      s.front.classList.add('mt-ad-hidden');    // fade outgoing out
      var tmp = s.front; s.front = s.back; s.back = tmp;
    }
  }

  scan(); // deferred script → DOM already parsed; catches inline (frame-1 grid + article) slots
  document.addEventListener('htmx:afterSettle', scan); // streamed-in grid slots
  if (N > 1) setInterval(tick, 5000); // N===1 → nothing to rotate, static ad stays
})();
