/* ============================================================
   Alien Arrangement Table — pan/zoom canvas with grid-snapping,
   stacking cards. Touch-first (iPad). No answer key.
   ============================================================ */
(function () {
  "use strict";

  // ---- geometry ----
  const CELL = 240;          // grid cell size (world px)
  const CARD_W = 196, CARD_H = 216;
  const STACK_OFF = 8;       // per-card offset in a stack (world px)
  const MAX_FAN = 8;         // cap the visible fan so big piles read as a compact stack
  const MIN_SCALE = 0.16, MAX_SCALE = 3.4;
  const DRAG_THRESHOLD = 6;  // screen px before a touch becomes a drag

  const root = document.documentElement;
  root.style.setProperty("--cell", CELL + "px");
  root.style.setProperty("--cw", CARD_W + "px");
  root.style.setProperty("--ch", CARD_H + "px");

  // ---- DOM ----
  const $ = (s) => document.querySelector(s);
  const startScreen = $("#start");
  const app = $("#app");
  const viewport = $("#viewport");
  const world = $("#world");
  const cardsLayer = $("#cards");
  const cellHint = $("#cell-hint");
  // ---- state ----
  const SPREAD_COLS = 10;    // width of the tidy starting block (not the answer!)
  let cards = [];            // {id,img,col,row,order,el}
  let orderCounter = 1;
  const view = { x: 0, y: 0, scale: 1 };

  /* ============================================================
     View transform helpers
     ============================================================ */
  function applyTransform() {
    world.style.transform =
      "translate(" + view.x + "px," + view.y + "px) scale(" + view.scale + ")";
  }
  function screenToWorld(sx, sy) {
    return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
  }
  function clampScale(s) { return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s)); }

  /* ============================================================
     Cards: build, render, stacking
     ============================================================ */
  function makeCardEl(card) {
    const el = document.createElement("div");
    el.className = "card";
    el.dataset.id = card.id;
    const img = document.createElement("img");
    img.src = card.img;
    img.alt = "alien";
    img.draggable = false;
    el.appendChild(img);
    cardsLayer.appendChild(el);
    card.el = el;
  }

  function buildCards(list) {
    cardsLayer.innerHTML = "";
    cards = list;
    orderCounter = 1;
    cards.forEach((c) => {
      makeCardEl(c);
      if (c.order >= orderCounter) orderCounter = c.order + 1;
    });
    renderStacks();
  }

  function cellKey(c) { return c.col + "," + c.row; }

  // lay out every card according to its cell + stack position
  function renderStacks(exclude) {
    const groups = new Map();
    cards.forEach((c) => {
      if (c === exclude || c.col === null || c.col === undefined) return;
      const k = cellKey(c);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    });
    groups.forEach((group) => {
      group.sort((a, b) => a.order - b.order);
      group.forEach((c, k) => {
        const off = Math.min(k, MAX_FAN) * STACK_OFF; // capped so big piles stay compact
        const cellY = c.row * CELL + (CELL - CARD_H) / 2;
        const baseX = c.col * CELL + (CELL - CARD_W) / 2 + off; // lean right
        const baseY = cellY - off;                              // lean up (upper-right)
        c.el.style.left = baseX + "px";
        c.el.style.top = baseY + "px";
        // Depth like a painter's algorithm, keyed to the card's cell row (not its
        // fanned position, so the lean direction can't flip it): lower rows render
        // in front. Within a cell, higher stack index wins, so the top of a pile
        // stays on top and a lone neighbour (index 0) sits behind an adjacent stack.
        c.el.style.zIndex = String((Math.round(cellY) + 100000) * 64 + Math.min(k, 63));
        setBadge(c, k === group.length - 1 && group.length > 1 ? group.length : 0);
      });
    });
  }

  function setBadge(card, n) {
    let b = card.el.querySelector(".count");
    if (n > 0) {
      if (!b) { b = document.createElement("div"); b.className = "count"; card.el.appendChild(b); }
      b.textContent = "×" + n;
    } else if (b) {
      b.remove();
    }
  }

  /* ============================================================
     Layout presets
     ============================================================ */
  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // default: all 40 aliens, shuffled, in a tidy block near the origin
  function defaultLayout() {
    const src = shuffled(ALIENS);
    return src.map((item, i) => ({
      id: item.id, img: item.img,
      col: i % SPREAD_COLS, row: Math.floor(i / SPREAD_COLS), order: i + 1,
    }));
  }

  // spread every card into its own cell (unstacks everything)
  function spreadOut() {
    const list = cards.slice();
    list.forEach((c, i) => { c.col = i % SPREAD_COLS; c.row = Math.floor(i / SPREAD_COLS); c.order = i + 1; });
    orderCounter = list.length + 1;
    renderStacks();
    save();
    fitAll(true);
  }

  // stack every card into one cell (a deck)
  function stackAll() {
    const center = viewCenterCell();
    cards.forEach((c, i) => { c.col = center.col; c.row = center.row; c.order = i + 1; });
    orderCounter = cards.length + 1;
    renderStacks();
    save();
    animateView(cellToCenteredView(center.col, center.row, 1.1), 350);
  }

  /* ============================================================
     Fit / zoom-to helpers
     ============================================================ */
  function contentBBox() {
    let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
    cards.forEach((c) => {
      if (c.col === null) return;
      minC = Math.min(minC, c.col); maxC = Math.max(maxC, c.col);
      minR = Math.min(minR, c.row); maxR = Math.max(maxR, c.row);
    });
    if (!isFinite(minC)) { minC = 0; maxC = 4; minR = 0; maxR = 3; }
    return {
      x: minC * CELL, y: minR * CELL,
      w: (maxC - minC + 1) * CELL, h: (maxR - minR + 1) * CELL,
    };
  }

  function fitAll(animate) {
    const b = contentBBox();
    const pad = 60;
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const topInset = 74, botInset = 74; // leave room for toolbars
    const availH = vh - topInset - botInset;
    const s = clampScale(Math.min((vw - pad * 2) / b.w, (availH - pad * 2) / b.h));
    const target = {
      scale: s,
      x: (vw - b.w * s) / 2 - b.x * s,
      y: topInset + (availH - b.h * s) / 2 - b.y * s,
    };
    if (animate) animateView(target, 380); else { Object.assign(view, target); applyTransform(); }
  }

  function zoomToCard(card) {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const s = clampScale(0.62 * Math.min(vw, vh) / CARD_W);
    const cx = card.col * CELL + CELL / 2, cy = card.row * CELL + CELL / 2;
    animateView({ scale: s, x: vw / 2 - cx * s, y: vh / 2 - cy * s }, 340);
  }

  function cellToCenteredView(col, row, scale) {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const cx = col * CELL + CELL / 2, cy = row * CELL + CELL / 2;
    const s = clampScale(scale != null ? scale : view.scale);
    return { scale: s, x: vw / 2 - cx * s, y: vh / 2 - cy * s };
  }

  function viewCenterCell() {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const w = screenToWorld(vw / 2, vh / 2);
    return { col: Math.floor(w.x / CELL), row: Math.floor(w.y / CELL) };
  }

  function zoomBy(factor) {
    const vw = viewport.clientWidth, vh = viewport.clientHeight;
    const w = screenToWorld(vw / 2, vh / 2);
    const s = clampScale(view.scale * factor);
    animateView({ scale: s, x: vw / 2 - w.x * s, y: vh / 2 - w.y * s }, 200);
  }

  // animate the view to a target {x,y,scale}
  let animRAF = null;
  function animateView(target, dur) {
    cancelAnimationFrame(animRAF);
    const from = { x: view.x, y: view.y, scale: view.scale };
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      view.x = from.x + (target.x - from.x) * e;
      view.y = from.y + (target.y - from.y) * e;
      view.scale = from.scale + (target.scale - from.scale) * e;
      applyTransform();
      if (t < 1) animRAF = requestAnimationFrame(step);
    }
    animRAF = requestAnimationFrame(step);
  }

  /* ============================================================
     Gesture handling (pan / pinch / card drag)
     ============================================================ */
  const pointers = new Map();
  let gesture = null; // 'pan' | 'card' | 'pinch'
  let pan = null, pinch = null, drag = null;
  let lastTap = { t: 0, x: 0, y: 0, card: null };

  function cardFromEvent(e) {
    const el = e.target.closest ? e.target.closest(".card") : null;
    if (!el) return null;
    return cards.find((c) => c.el === el) || null;
  }

  viewport.addEventListener("pointerdown", (e) => {
    viewport.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 2) { startPinch(); return; }
    if (pointers.size > 2) return;

    const card = cardFromEvent(e);
    if (card) {
      // capture the grab offset at touch-down (robust to fast/teleporting moves)
      const w = screenToWorld(e.clientX, e.clientY);
      const curLeft = parseFloat(card.el.style.left) || 0;
      const curTop = parseFloat(card.el.style.top) || 0;
      drag = {
        id: e.pointerId, card, moved: false,
        startX: e.clientX, startY: e.clientY,
        grabX: w.x - curLeft, grabY: w.y - curTop,
      };
      gesture = "card";
    } else {
      pan = { id: e.pointerId, startX: e.clientX, startY: e.clientY, vx: view.x, vy: view.y, moved: false };
      gesture = "pan";
      viewport.classList.add("panning");
    }
  });

  viewport.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture === "pinch") { updatePinch(); return; }

    if (gesture === "card" && drag && e.pointerId === drag.id) {
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < DRAG_THRESHOLD) return;
        beginCardDrag(e);
      }
      updateCardDrag(e);
      return;
    }

    if (gesture === "pan" && pan && e.pointerId === pan.id) {
      view.x = pan.vx + (e.clientX - pan.startX);
      view.y = pan.vy + (e.clientY - pan.startY);
      if (Math.hypot(e.clientX - pan.startX, e.clientY - pan.startY) > DRAG_THRESHOLD) pan.moved = true;
      applyTransform();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const wasPinch = gesture === "pinch";
    pointers.delete(e.pointerId);

    if (wasPinch) {
      // fall back to panning with whichever finger remains
      if (pointers.size === 1) {
        const [id, p] = pointers.entries().next().value;
        pan = { id, startX: p.x, startY: p.y, vx: view.x, vy: view.y, moved: true };
        gesture = "pan";
      } else {
        gesture = null;
      }
      return;
    }

    if (gesture === "card" && drag && e.pointerId === drag.id) { endCardDrag(e); return; }

    if (gesture === "pan" && pan && e.pointerId === pan.id) {
      viewport.classList.remove("panning");
      if (!pan.moved) handleTap(e, null);
      pan = null; gesture = pointers.size ? gesture : null;
    }
  }
  viewport.addEventListener("pointerup", endPointer);
  viewport.addEventListener("pointercancel", endPointer);

  // ---- pinch ----
  function startPinch() {
    const pts = [...pointers.values()];
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    if (gesture === "card" && drag) { if (drag.moved) endCardDragSilent(); drag = null; }
    pan = null;
    viewport.classList.remove("panning");
    pinch = { dist0: dist, world0: screenToWorld(mid.x, mid.y), scale0: view.scale };
    gesture = "pinch";
  }
  function updatePinch() {
    const pts = [...pointers.values()];
    if (pts.length < 2) return;
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const s = clampScale(pinch.scale0 * (dist / pinch.dist0));
    view.scale = s;
    view.x = mid.x - pinch.world0.x * s;
    view.y = mid.y - pinch.world0.y * s;
    applyTransform();
  }

  // ---- card drag ----
  function beginCardDrag(e) {
    drag.moved = true;
    const card = drag.card;
    card.el.classList.add("dragging");
    card.el.style.zIndex = "99999999"; // above any depth-based z while lifted
    // lift out of its cell so the old stack updates immediately
    drag.fromCol = card.col; drag.fromRow = card.row;
    card.col = null; card.row = null;
    renderStacks();
    cellHint.hidden = false;
  }

  function updateCardDrag(e) {
    const card = drag.card;
    const w = screenToWorld(e.clientX, e.clientY);
    const left = w.x - drag.grabX, top = w.y - drag.grabY;
    card.el.style.left = left + "px";
    card.el.style.top = top + "px";
    const centerX = left + CARD_W / 2, centerY = top + CARD_H / 2;
    const col = Math.floor(centerX / CELL), row = Math.floor(centerY / CELL);
    drag.targetCol = col; drag.targetRow = row;
    showHint(col, row);
  }

  function showHint(col, row) {
    const inset = 5;
    cellHint.style.left = col * CELL + inset + "px";
    cellHint.style.top = row * CELL + inset + "px";
    cellHint.style.width = CELL - inset * 2 + "px";
    cellHint.style.height = CELL - inset * 2 + "px";
    const occupied = cards.some((c) => c !== drag.card && c.col === col && c.row === row);
    cellHint.classList.toggle("stack", occupied);
  }

  function dropCard() {
    const card = drag.card;
    card.el.classList.remove("dragging");
    cellHint.hidden = true;
    card.col = drag.targetCol; card.row = drag.targetRow;
    // If dropped onto a cell that already holds cards, tuck it to the BACK of the
    // stack (rendered behind) so returning a card to a pile reveals the next one —
    // like flipping the top card to the bottom of a deck. Empty cell: place on top.
    const others = cards.filter((c) => c !== card && c.col === card.col && c.row === card.row);
    if (others.length) {
      card.order = Math.min.apply(null, others.map((c) => c.order)) - 1;
    } else {
      card.order = orderCounter++;
    }
    renderStacks();
    flashSnap(card);
    save();
  }
  function endCardDrag(e) {
    if (drag.moved) { dropCard(); }
    else { handleTap(e, drag.card); }
    drag = null; gesture = pointers.size ? gesture : null;
  }
  function endCardDragSilent() {
    // used when a pinch interrupts a drag: settle the card where it is
    if (!drag) return;
    if (drag.targetCol === undefined) { drag.targetCol = drag.fromCol; drag.targetRow = drag.fromRow; }
    dropCard();
  }

  function flashSnap(card) {
    card.el.classList.remove("snapped");
    void card.el.offsetWidth;
    card.el.classList.add("snapped");
  }

  /* ============================================================
     Taps / double-tap
     ============================================================ */
  function handleTap(e, card) {
    const now = performance.now();
    const isDouble =
      now - lastTap.t < 320 &&
      Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40 &&
      lastTap.card === card;
    if (isDouble) {
      lastTap.t = 0;
      if (card) zoomToCard(card);
      else zoomBy(1.8);
      return;
    }
    lastTap = { t: now, x: e.clientX, y: e.clientY, card };
  }

  /* ============================================================
     Persistence
     ============================================================ */
  const STORE_KEY = "aliens-table";
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const data = {
          cards: cards.map((c) => ({ id: c.id, img: c.img, col: c.col, row: c.row, order: c.order })),
          view: { x: view.x, y: view.y, scale: view.scale },
        };
        localStorage.setItem(STORE_KEY, JSON.stringify(data));
      } catch (err) { /* private mode: ignore */ }
    }, 250);
  }

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.cards) || !data.cards.length) return null;
      return data;
    } catch (err) { return null; }
  }

  /* ============================================================
     Set loading / start flow
     ============================================================ */
  function openTable() {
    startScreen.hidden = true;
    app.hidden = false; // reveal first so the viewport has a measurable size
    const saved = loadSaved();
    if (saved) {
      buildCards(saved.cards.map((c) => ({ ...c, el: null })));
      Object.assign(view, saved.view);
      applyTransform();
    } else {
      buildCards(defaultLayout());
      requestAnimationFrame(() => { fitAll(false); save(); });
    }
  }

  function resetTable() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
    buildCards(defaultLayout());
    fitAll(true);
    save();
  }

  /* ============================================================
     UI wiring
     ============================================================ */
  $("#start-btn").addEventListener("click", openTable);

  $("#fit-btn").addEventListener("click", () => fitAll(true));
  $("#zoom-in").addEventListener("click", () => zoomBy(1.4));
  $("#zoom-out").addEventListener("click", () => zoomBy(1 / 1.4));
  $("#spread-btn").addEventListener("click", spreadOut);
  $("#stack-btn").addEventListener("click", stackAll);

  const menu = $("#menu"), help = $("#help");
  $("#menu-btn").addEventListener("click", () => { menu.hidden = false; });
  $("#menu-close").addEventListener("click", () => { menu.hidden = true; });
  $("#help-btn").addEventListener("click", () => { help.hidden = false; });
  $("#help-close").addEventListener("click", () => { help.hidden = true; });
  $("#reset-btn").addEventListener("click", () => {
    menu.hidden = true;
    if (confirm("Return all 40 cards to a fresh, shuffled layout? Your current arrangement will be cleared.")) resetTable();
  });
  [menu, help].forEach((ov) =>
    ov.addEventListener("click", (e) => { if (e.target === ov) ov.hidden = true; }));

  window.addEventListener("resize", () => applyTransform());
})();
