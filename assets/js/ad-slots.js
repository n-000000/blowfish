/*
  ad-slots.js — rotating content-ad slots with cross-slot coordination.

  The content-ad pool is emitted once per page as
    <script type="application/json" id="mt-content-ad-pool">[{img,href,alt},…]</script>
  (see partials/ad-slots-boot.html). All slots draw from ONE page-load-shuffled queue `q`
  via a shared monotonic cursor `g` advancing by the visible-slot count each tick, so the
  set of slots collectively consumes the next ads from the shuffled stream — giving equal
  *seen* exposure. It needs no knowledge of how many slots exist or when they appear, so it
  survives the homepage's HTMX infinite-scroll grid (slots stream in over time, k → ∞).

  Two-tier anti-adjacency guard on each pick (matters most when few ads, many slots — the
  common case, e.g. 2 ads across 4 visible grid slots):
    tier 1 — skip the candidate while it is already shown by another slot THIS tick
             (spatial) OR equals what this slot currently shows (temporal). Avoids both.
    tier 2 — if tier 1 can't satisfy both (the k=N derangement corner), keep skipping until
             the ad is at least not-used-this-tick, accepting a rare temporal repeat so
             invariant 1 (no two visible slots show the same ad at once) is NEVER broken for
             k<=N. For k>N, duplicates across slots are pigeonhole-unavoidable.
  ponytail: the residual repeat only occurs at exactly k==N with N>=3; if that regime becomes
  common (pool grows to match slots-per-viewport) and looks bad, the next lever is per-slot
  phase offsets — but that reopens the exposure-ordering question, so don't add it preemptively.

  Slots register on load and on htmx:afterSettle (re-queried from document, since e.detail.elt
  is the detached old node after an outerHTML swap). A slot is enhanced (second crossfade layer
  cloned) LAZILY, on first intersection — so display:none responsive twins never become ghost
  slots, and an endless page doesn't clone hundreds of off-screen cells up front. Only slots in
  the viewport rotate (IntersectionObserver → equal *seen* exposure).
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
  var slots = []; // { el, front, back, current(href), visible }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting && !en.target.__adSlot) enhance(en.target); // lazy: only real, visible slots
      if (en.target.__adSlot) en.target.__adSlot.visible = en.isIntersecting;
    });
  }, { rootMargin: '0px' });

  function fill(layer, ad) {
    layer.href = ad.href;
    var img = layer.querySelector('img');
    if (img) { img.src = ad.img; img.alt = ad.alt || ''; }
  }

  // Clone the server-rendered card (frame-0 / no-JS ad) into a second stacked layer.
  function enhance(el) {
    var front = el.querySelector('.mt-ad-card');
    if (!front) return;
    var back = front.cloneNode(true);
    back.classList.add('mt-ad-hidden');
    el.appendChild(back);
    var s = { el: el, front: front, back: back, current: front.getAttribute('href') || '', visible: true };
    el.__adSlot = s;
    slots.push(s);
  }

  function scan() {
    document.querySelectorAll('.mt-ad-slot:not([data-ad-observed])').forEach(function (el) {
      el.dataset.adObserved = '1';
      io.observe(el); // enhancement happens lazily on first intersection
    });
  }

  // Two-tier guard pick from the shared shuffled cursor (see header).
  function pick(current, used) {
    var ad = q[g++ % N];
    if (N > 1) {
      var tries = 0;
      while ((used.has(ad.href) || ad.href === current) && tries < N) { ad = q[g++ % N]; tries++; }
      if (used.has(ad.href)) { var t2 = 0; while (used.has(ad.href) && t2 < N) { ad = q[g++ % N]; t2++; } }
    }
    return ad;
  }

  function tick() {
    if (g >= N) { shuffle(q); g = 0; } // reshuffle each full pass (matters on endless scroll)
    var used = new Set();
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (!s.visible) continue; // frozen off-screen; rejoins next tick when visible
      var ad = pick(s.current, used);
      used.add(ad.href);
      s.current = ad.href;
      fill(s.back, ad);
      s.back.classList.remove('mt-ad-hidden'); // fade incoming in
      s.front.classList.add('mt-ad-hidden');   // fade outgoing out
      var tmp = s.front; s.front = s.back; s.back = tmp;
    }
  }

  scan(); // deferred script → DOM already parsed; observes inline (article + first grid) slots
  document.addEventListener('htmx:afterSettle', scan); // streamed-in grid slots
  if (N > 1) setInterval(tick, 5000); // N===1 → nothing to rotate, static ad stays
})();
