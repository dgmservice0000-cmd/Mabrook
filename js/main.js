/* ==========================================================================
   Wahat Al Mabrook — storefront logic
   ========================================================================== */

/* ---- Store settings: fill these in -------------------------------------- */
const STORE = {
  whatsapp: '971556334248',     // international format, digits only
  phone: '+971 6 702 1443',     // shown as written
  mobile: '+971 55 633 4248',
  address: 'Buteena, Sharjah, United Arab Emirates',
  hours: 'Open daily · 8:30 AM – 12:00 midnight',
  mapsUrl: 'https://maps.app.goo.gl/KT7xtUJnxKexeEZL9',
  instagram: '',
  facebook: '',
};
/* ------------------------------------------------------------------------- */

const DEFAULT_SIZES = [100, 250, 500, 1000];
const STEP = 50;
const MIN_GRAMS = 50;
const CART_KEY = 'mabrook-cart-v2';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const products = window.PRODUCTS || [];
const categories = window.CATEGORIES || [];
const catName = (id) => categories.find((c) => c.id === id)?.name || '';
const findProduct = (id) => products.find((p) => p.id === id);

// Units: 'g' (grams), 'ml' (millilitres) or 'pcs' (pieces)
const unitOf = (p) => (p && p.unit) || 'g';
const minQty = (unit) => (unit === 'pcs' ? 1 : MIN_GRAMS);
const big = (n) => (Number.isInteger(n) ? n : n.toFixed(2).replace(/0+$/, ''));

const formatQty = (q, unit = 'g') => {
  if (unit === 'pcs') return `${q} pc${q === 1 ? '' : 's'}`;
  if (unit === 'ml') return q >= 1000 ? `${big(q / 1000)} L` : `${q} ml`;
  return q >= 1000 ? `${big(q / 1000)} kg` : `${q} g`;
};
const formatFor = (id, q) => formatQty(q, unitOf(findProduct(id)));

// Step grows with the amount: 50 up to 500, 100 up to 1000, then 250. Pieces step by 1.
const nextQty = (q, dir, unit = 'g') => {
  if (unit === 'pcs') return Math.max(1, q + dir);
  const ref = dir > 0 ? q : q - 1;
  const step = ref >= 1000 ? 250 : ref >= 500 ? 100 : STEP;
  return Math.max(MIN_GRAMS, q + dir * step);
};

const waLink = (text) => {
  const base = STORE.whatsapp ? `https://wa.me/${STORE.whatsapp}` : 'https://wa.me/';
  return `${base}?text=${encodeURIComponent(text)}`;
};

/* ==========================================================================
   Static content: contact info, links
   ========================================================================== */
function initStaticContent() {
  $$('[data-wa]').forEach((a) => (a.href = waLink(a.dataset.wa)));
  $$('[data-maps]').forEach((a) => (a.href = STORE.mapsUrl));
  $$('[data-social]').forEach((a) => {
    const url = STORE[a.dataset.social];
    if (url) a.href = url;
    else a.remove();
  });

  const info = {
    address: STORE.address,
    hours: STORE.hours,
    phone: STORE.phone || 'To be confirmed',
    whatsapp: STORE.whatsapp ? STORE.mobile || `+${STORE.whatsapp}` : 'To be confirmed',
  };
  $$('[data-info]').forEach((el) => {
    const key = el.dataset.info;
    if (key === 'phone' && STORE.phone) {
      const tel = (n) => `<a href="tel:${n.replace(/[^+\d]/g, '')}">${n}</a>`;
      el.innerHTML = [STORE.phone, STORE.mobile].filter(Boolean).map(tel).join(' · ');
    } else if (key === 'whatsapp' && STORE.whatsapp) {
      el.innerHTML = `<a href="${waLink('Hello Wahat Al Mabrook')}" target="_blank" rel="noopener noreferrer">${info.whatsapp}</a>`;
    } else {
      el.textContent = info[key];
    }
  });

  $('#year').textContent = new Date().getFullYear();
}

/* ==========================================================================
   Header & mobile menu
   ========================================================================== */
function initHeader() {
  const header = $('#header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const toggle = $('.menu-toggle');
  const menu = $('.mobile-menu');
  const setMenu = (open) => {
    menu.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open);
  };
  toggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // Active nav link
  const links = $$('.nav-link');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          links.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${e.target.id}`));
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  $$('main section[id]').forEach((s) => observer.observe(s));
}

/* ==========================================================================
   Catalogue: categories, filters, search, grid
   ========================================================================== */
const DEFAULT_FILTER = 'spices';
const isPhone = () => window.matchMedia('(max-width: 760px)').matches;
const pageSize = () => (isPhone() ? 12 : 20);
const state = { filter: DEFAULT_FILTER, query: '', limit: 0 };

function renderFilters() {
  const count = (id) => products.filter((p) => p.category === id).length;
  const tabs = [{ id: 'all', name: 'All' }, ...categories].map(
    (c) => `
      <button class="filter-btn${c.id === state.filter ? ' active' : ''}" data-filter="${c.id}" role="tab"
        aria-selected="${c.id === state.filter}">
        ${c.name}<span class="filter-count">${c.id === 'all' ? products.length : count(c.id)}</span>
      </button>`
  );
  $('#filterBar').innerHTML = tabs.join('');
  $$('.filter-btn').forEach((b) => b.addEventListener('click', () => setFilter(b.dataset.filter)));
  initFilterArrows();
}

// Arrow buttons that scroll the category bar sideways; each shows only when there is more to see that way.
function initFilterArrows() {
  const bar = $('#filterBar');
  const prev = $('#filterPrev');
  const next = $('#filterNext');
  const wrap = $('#filterWrap');
  const update = () => {
    const max = bar.scrollWidth - bar.clientWidth;
    prev.hidden = bar.scrollLeft <= 4;
    next.hidden = bar.scrollLeft >= max - 4;
    wrap.classList.toggle('fade-left', !prev.hidden);
    wrap.classList.toggle('fade-right', !next.hidden);
  };
  const step = () => (isPhone() ? 200 : Math.max(160, bar.clientWidth * 0.7));
  prev.addEventListener('click', () => bar.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => bar.scrollBy({ left: step(), behavior: 'smooth' }));
  bar.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

function setFilter(id) {
  state.filter = id;
  state.limit = pageSize();
  $$('.filter-btn').forEach((b) => {
    const on = b.dataset.filter === id;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
    if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });
  renderGrid();
}

function renderGrid() {
  const q = state.query.trim().toLowerCase();
  // A search looks through every category; otherwise show the chosen category.
  const list = products.filter((p) =>
    q
      ? p.name.toLowerCase().includes(q) || catName(p.category).toLowerCase().includes(q)
      : state.filter === 'all' || p.category === state.filter
  );
  if (!state.limit) state.limit = pageSize();
  const shown = list.slice(0, state.limit);
  const left = list.length - shown.length;
  const more = $('#showMore');
  more.hidden = left <= 0;
  more.querySelector('span').textContent = left <= pageSize() ? `Show ${left} more` : `Show more (${left} left)`;
  $$('.filter-btn').forEach((b) => b.classList.toggle('dimmed', !!q));

  $('#productGrid').innerHTML = shown
    .map(
      (p, i) => `
      <button class="product-card" data-id="${p.id}" style="--i:${Math.min(i, 12)}"
        aria-label="View ${p.name}">
        <span class="product-thumb">
          <img src="${p.image}" alt="${p.name}" loading="lazy"
            ${p.imagePosition ? `style="object-position:${p.imagePosition}"` : ''}>
        </span>
        <span class="product-name">${p.name}</span>
      </button>`
    )
    .join('');

  $('#emptyState').hidden = list.length > 0;
  $$('.product-card').forEach((card) => card.addEventListener('click', () => openProduct(card.dataset.id)));
}

function initSearch() {
  $('#showMore').addEventListener('click', () => {
    state.limit += pageSize();
    renderGrid();
  });
  let t;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.query = e.target.value;
      state.limit = pageSize();
      renderGrid();
    }, 120);
  });
}

/* ==========================================================================
   Overlays (shared open/close + focus handling)
   ========================================================================== */
let lastFocus = null;

function openOverlay(el) {
  lastFocus = document.activeElement;
  $('#toast').classList.remove('show');
  el.hidden = false;
  requestAnimationFrame(() => el.classList.add('show'));
  document.body.classList.add('no-scroll');
}

function closeOverlay(el) {
  el.classList.remove('show');
  document.body.classList.remove('no-scroll');
  setTimeout(() => (el.hidden = true), 250);
  if (el.id === 'productOverlay' && location.hash.startsWith('#product/')) {
    history.replaceState(null, '', location.pathname + location.search);
  }
  lastFocus?.focus?.();
}

function initOverlays() {
  $$('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-close]')) closeOverlay(ov);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.overlay.show').forEach(closeOverlay);
  });
}

/* ==========================================================================
   Product viewer + quantity step
   ========================================================================== */
const viewer = { product: null, grams: 250 };

function showStep(name) {
  $$('.viewer-step').forEach((s) => (s.hidden = s.dataset.step !== name));
}

function openProduct(id) {
  const p = findProduct(id);
  if (!p) return;
  viewer.product = p;

  const img = $('#viewerImg');
  img.src = p.image;
  img.alt = p.name;
  img.style.objectPosition = p.imagePosition || '';
  $('#viewerCat').textContent = catName(p.category);
  $('#viewerName').textContent = p.name;
  $('#viewerDesc').textContent = p.description;

  const inCart = cart.items.find((it) => it.id === p.id);
  $('#addToCartBtn span').textContent = inCart ? `In cart · ${formatFor(p.id, inCart.grams)} — Change` : 'Add to Cart';

  showStep('details');
  history.replaceState(null, '', `#product/${p.id}`);
  openOverlay($('#productOverlay'));
  setTimeout(() => $('#addToCartBtn').focus(), 50);
}

function setGrams(g) {
  const unit = unitOf(viewer.product);
  const min = minQty(unit);
  const n = Number(g) || min;
  viewer.grams = Math.max(min, unit === 'pcs' ? Math.round(n) : Math.round(n / 10) * 10);
  $('#qtyInput').value = viewer.grams;
  $('#qtyReadable').textContent = unit !== 'pcs' && viewer.grams >= 1000 ? `= ${formatQty(viewer.grams, unit)}` : '\u00a0';
  $$('.size-chip').forEach((c) => c.classList.toggle('active', Number(c.dataset.g) === viewer.grams));
}

function openQtyStep() {
  const p = viewer.product;
  const sizes = p.sizes || DEFAULT_SIZES;
  const existing = cart.items.find((it) => it.id === p.id);

  const unit = unitOf(p);
  $('#qtyName').textContent = p.name;
  $('#qtyLabel').textContent = unit === 'pcs' ? 'How many do you need?' : 'How much do you need?';
  $('#qtyUnit').textContent = unit;
  $('#qtyInput').min = minQty(unit);
  $('#qtyInput').step = unit === 'pcs' ? 1 : STEP;
  $('#sizeChips').innerHTML = sizes
    .map((g) => `<button class="size-chip" data-g="${g}">${formatQty(g, unitOf(p))}</button>`)
    .join('');
  $$('.size-chip').forEach((c) => c.addEventListener('click', () => setGrams(c.dataset.g)));

  setGrams(existing ? existing.grams : sizes[Math.min(1, sizes.length - 1)]);
  $('#confirmAddBtn span').textContent = existing ? 'Update Cart' : 'Confirm & Add';
  showStep('qty');
}

function initViewer() {
  $('#addToCartBtn').addEventListener('click', openQtyStep);
  $('#qtyBack').addEventListener('click', () => showStep('details'));

  $('#qtyMinus').addEventListener('click', () => setGrams(nextQty(viewer.grams, -1, unitOf(viewer.product))));
  $('#qtyPlus').addEventListener('click', () => setGrams(nextQty(viewer.grams, 1, unitOf(viewer.product))));
  $('#qtyInput').addEventListener('change', (e) => setGrams(e.target.value));

  $('#confirmAddBtn').addEventListener('click', () => {
    const p = viewer.product;
    const existed = cart.items.some((it) => it.id === p.id);
    flyToCart($('#viewerImg'));
    cart.set(p.id, viewer.grams);
    closeOverlay($('#productOverlay'));
    toast(`${p.name} · ${formatQty(viewer.grams, unitOf(p))} ${existed ? 'updated' : 'added to cart'}`);
  });

  // Deep link: #product/<id>
  const fromHash = () => {
    const m = location.hash.match(/^#product\/(.+)$/);
    if (m && findProduct(m[1])) openProduct(m[1]);
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

/* ==========================================================================
   Cart (persisted in localStorage)
   ========================================================================== */
const cart = {
  items: [],
  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      this.items = raw.filter((it) => findProduct(it.id) && it.grams >= minQty(unitOf(findProduct(it.id))));
    } catch {
      this.items = [];
    }
  },
  save() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(this.items));
    } catch { /* storage unavailable */ }
    renderCart();
  },
  set(id, grams) {
    const it = this.items.find((x) => x.id === id);
    if (it) it.grams = grams;
    else this.items.push({ id, grams });
    this.save();
  },
  remove(id) {
    this.items = this.items.filter((x) => x.id !== id);
    this.save();
  },
  clear() {
    this.items = [];
    this.save();
  },
};

function renderCart() {
  const n = cart.items.length;
  const badge = $('.cart-count');
  badge.hidden = n === 0;
  badge.textContent = n;
  badge.classList.remove('bump');
  void badge.offsetWidth;
  if (n) badge.classList.add('bump');

  $('#cartEmpty').hidden = n > 0;
  $('#cartFoot').hidden = n === 0;
  $('#cartSummary').textContent = `${n} item${n === 1 ? '' : 's'}`;

  $('#cartItems').innerHTML = cart.items
    .map((it) => {
      const p = findProduct(it.id);
      return `
      <li class="cart-item" data-id="${p.id}">
        <img src="${p.image}" alt="" ${p.imagePosition ? `style="object-position:${p.imagePosition}"` : ''}>
        <div class="cart-item-info">
          <span class="cart-item-name">${p.name}</span>
          <div class="cart-qty">
            <button class="icon-btn sm" data-act="dec" aria-label="Decrease"><svg><use href="#i-minus"/></svg></button>
            <span>${formatQty(it.grams, unitOf(p))}</span>
            <button class="icon-btn sm" data-act="inc" aria-label="Increase"><svg><use href="#i-plus"/></svg></button>
          </div>
        </div>
        <button class="icon-btn sm remove" data-act="remove" aria-label="Remove ${p.name}"><svg><use href="#i-trash"/></svg></button>
      </li>`;
    })
    .join('');

  const lines = cart.items.map((it, i) => `${i + 1}. ${findProduct(it.id).name} — ${formatFor(it.id, it.grams)}`);
  const msg = `Hello Wahat Al Mabrook, I would like to order:\n\n${lines.join('\n')}\n\nPlease confirm availability and price. (Free delivery within 3 km of the store.) Thank you!`;
  $('#sendOrder').href = waLink(msg);
}

function initCart() {
  cart.load();
  renderCart();

  $$('[data-open-cart]').forEach((b) => b.addEventListener('click', () => openOverlay($('#cartOverlay'))));
  $('#clearCart').addEventListener('click', () => cart.clear());

  $('#cartItems').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('.cart-item').dataset.id;
    const it = cart.items.find((x) => x.id === id);
    if (btn.dataset.act === 'remove') cart.remove(id);
    const unit = unitOf(findProduct(id));
    if (btn.dataset.act === 'inc') cart.set(id, nextQty(it.grams, 1, unit));
    if (btn.dataset.act === 'dec') {
      if (it.grams <= minQty(unit)) cart.remove(id);
      else cart.set(id, nextQty(it.grams, -1, unit));
    }
  });
}

/* ==========================================================================
   Store gallery + lightbox
   ========================================================================== */
const GALLERY = [
  ['candy-milk-wall', "Milk powder, Tang & chocolates by weight", 1280, 676],
  ['coffee-syrups', "Coffee, syrups & Kerala flours", 1280, 720],
  ['oils-ghee', "Ghee, oils & cooking oil", 960, 1280],
  ['pickles-juices', "Pickles, juices & tamarind", 1280, 883],
  ['canned-sauces', "Canned foods, sauces & masala bins", 960, 1037],
];

function initGallery() {
  const grid = $('#galleryGrid');
  if (!grid) return;
  grid.innerHTML = GALLERY.map(
    ([f, alt, w, h]) => `
      <button class="gallery-item" data-src="assets/photos/${f}.jpg" aria-label="Enlarge: ${alt}">
        <img src="assets/photos/${f}.jpg" alt="${alt}" width="${w}" height="${h}" loading="lazy">
        <span class="gallery-cap">${alt}</span>
      </button>`
  ).join('');
  const allBtn = $('#galleryAll');
  if (GALLERY.length > 6) grid.classList.add('collapsed');
  else allBtn.closest('.more-wrap').remove();
  allBtn.querySelector('span').textContent = `View all ${GALLERY.length} photos`;
  allBtn.addEventListener('click', () => {
    grid.classList.remove('collapsed');
    allBtn.hidden = true;
  });
  let current = 0;
  const show = (i) => {
    current = (i + GALLERY.length) % GALLERY.length;
    const [f, alt] = GALLERY[current];
    const img = $('#lightboxImg');
    img.src = `assets/photos/${f}.jpg`;
    img.alt = alt;
    $('#lightboxCap').textContent = alt;
  };
  grid.addEventListener('click', (e) => {
    const item = e.target.closest('.gallery-item');
    if (!item) return;
    show([...grid.children].indexOf(item));
    openOverlay($('#lightbox'));
  });
  $('#lbPrev').addEventListener('click', () => show(current - 1));
  $('#lbNext').addEventListener('click', () => show(current + 1));
  document.addEventListener('keydown', (e) => {
    if (!$('#lightbox').classList.contains('show')) return;
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });
  let sx = null;
  $('#lightbox').addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  $('#lightbox').addEventListener('touchend', (e) => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    sx = null;
  });
}

/* ==========================================================================
   Fly to cart: a copy of the product photo arcs into the cart icon
   ========================================================================== */
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function flyToCart(srcImg) {
  const cartBtn = $('.cart-toggle');
  if (!srcImg || !cartBtn || reducedMotion() || !srcImg.animate) return;
  const from = srcImg.getBoundingClientRect();
  const to = cartBtn.getBoundingClientRect();
  if (!from.width || !to.width) return;

  const size = Math.min(140, from.width * 0.45);
  const startX = from.left + from.width / 2 - size / 2;
  const startY = from.top + from.height / 2 - size / 2;
  const endX = to.left + to.width / 2 - size / 2;
  const endY = to.top + to.height / 2 - size / 2;
  // gentle arc: lift up first, then glide into the cart (kept inside the screen)
  const midX = startX + (endX - startX) * 0.35;
  const midY = Math.max(endY + 40, startY - 140);

  const ghost = document.createElement('img');
  ghost.src = srcImg.currentSrc || srcImg.src;
  ghost.alt = '';
  ghost.className = 'fly-ghost';
  ghost.style.cssText = `width:${size}px;height:${size}px;left:${startX}px;top:${startY}px;object-position:${srcImg.style.objectPosition || 'center'}`;
  document.body.appendChild(ghost);

  const dx = (x) => `${x - startX}px`;
  const dy = (y) => `${y - startY}px`;
  ghost
    .animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '18px' },
        { transform: `translate(${dx(midX)},${dy(midY)}) scale(0.6)`, opacity: 1, borderRadius: '40%', offset: 0.55 },
        { transform: `translate(${dx(endX)},${dy(endY)}) scale(0.12)`, opacity: 0.6, borderRadius: '50%' },
      ],
      { duration: 850, easing: 'cubic-bezier(0.45, 0, 0.25, 1)', fill: 'forwards' }
    )
    .finished.then(() => {
      ghost.remove();
      cartBtn.classList.remove('cart-hit');
      void cartBtn.offsetWidth;
      cartBtn.classList.add('cart-hit');
    })
    .catch(() => ghost.remove());
}

/* ==========================================================================
   Hero video: plays when allowed, falls back to the still photo otherwise
   ========================================================================== */
function initHeroVideo() {
  const v = $('#heroVideo');
  if (!v) return;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reducedMotion() || saveData) {
    v.remove();
    return;
  }
  v.src = v.canPlayType('video/webm; codecs="vp9"') ? v.dataset.webm : v.dataset.src;
  v.addEventListener('playing', () => v.classList.add('ready'), { once: true });
  v.play().catch(() => {});
  // pause when off-screen to save battery
  new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.05 }).observe(v);
}

/* ==========================================================================
   Toast
   ========================================================================== */
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.innerHTML = `<svg><use href="#i-check"/></svg><span>${msg}</span><button class="link-btn" data-open-cart>View cart</button>`;
  $('[data-open-cart]', el).addEventListener('click', () => {
    el.classList.remove('show');
    openOverlay($('#cartOverlay'));
  });
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ==========================================================================
   Reveal on scroll
   ========================================================================== */
function initReveal() {
  const els = $$('.section-head, .about-grid, .steps-grid, .visit-grid, .gallery-grid');
  els.forEach((el) => el.classList.add('reveal'));
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

/* ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  initStaticContent();
  initHeader();
  renderFilters();
  initSearch();
  initOverlays();
  initCart();
  renderGrid();
  initViewer();
  initGallery();
  initReveal();
  initToTop();
  initHeroVideo();
});

function initToTop() {
  const btn = $('#toTop');
  const onScroll = () => btn.classList.toggle('show', window.scrollY > 900);
  window.addEventListener('scroll', onScroll, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();
}
