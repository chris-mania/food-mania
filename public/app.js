// Food Mania app: screens, data loading and navigation.
(function () {
  'use strict';
  const L = window.FMLogic;
  const $app = document.getElementById('app');
  const DEFAULT_ORIGIN = { name: 'Paramus, NJ', lat: 40.9445, lng: -74.0754 };
  const FEATURE_PHRASE = { tvs: 'tvs', drinks: 'drinks', kids: 'kid friendly', view: 'view', rooftop: 'rooftop', outdoor: 'outdoor seating',
    romantic: 'date night', quiet: 'quiet', liveMusic: 'live music', reservable: 'reservations', cheap: 'cheap', fancy: 'fancy', openNow: 'open now', late: 'late night' };
  const STATE_TEXT = { yes: 'yes', reviews: 'per reviews', likely: 'likely', unknown: 'not sure', no: 'no' };
  const LABELS = {
    menu: ['On the menu', 'b-menu'], reviews: ['In reviews', 'b-reviews'], closest: ['Closest match', 'b-likely'],
    likely: ['Likely', 'b-likely'], unconfirmed: ['Not confirmed', 'b-unconfirmed'], no: ['Probably not', 'b-no']
  };

  const FM = {
    live: false, status: {}, origin: load('fm-origin') || null, mode: load('fm-mode') || 'drive', radius: 15, sort: 'best',
    compare: load('fm-compare') || [], userRadius: load('fm-radius') || 15, placesById: {}, cache: {}, last: null, loading: null, extras: {}, wheel: { options: null, mode: 'spin', rot: 0, out: [], winner: null, spinning: false, lastOut: null },
    ui: { showOthers: false, showRuled: false, cmpMode: 'place', lens: 'overall' }, turnstile: null
  };

  // ---------- small helpers ----------
  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function money(n) { return n ? '$' + (Number.isInteger(n) ? n : n.toFixed(2)) : ''; }
  function dollars(level) { return level ? '$'.repeat(level) : ''; }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function origin() { return FM.origin || DEFAULT_ORIGIN; }
  function num(n) { return Number(n || 0).toLocaleString('en-US'); }
  async function api(path, opts) {
    const o = Object.assign({ headers: {} }, opts || {});
    if (o.json) { o.method = o.method || 'POST'; o.headers['content-type'] = 'application/json'; o.body = JSON.stringify(o.json); delete o.json; }
    if (o.turnstile && FM.turnstile) { const t = await turnstileToken(); if (t) o.headers['x-turnstile-token'] = t; }
    const res = await fetch(path, o);
    if (!res.ok) { const e = new Error('HTTP ' + res.status); e.status = res.status; throw e; }
    return res.json();
  }
  function isApple() { return /iPhone|iPad|Macintosh/.test(navigator.userAgent); }
  function dirLinks(p) {
    const q = encodeURIComponent(p.name + (p.address ? ', ' + p.address : ''));
    return {
      apple: 'https://maps.apple.com/?daddr=' + p.lat + ',' + p.lng + '&q=' + encodeURIComponent(p.name),
      google: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(p.lat + ',' + p.lng) + (p.googleId ? '&destination_place_id=' + p.googleId : ''),
      googlePlace: p.googleMapsUri || ('https://www.google.com/maps/search/?api=1&query=' + q + (p.googleId ? '&query_place_id=' + p.googleId : '')),
      yelp: 'https://www.yelp.com/search?find_desc=' + encodeURIComponent(p.name) + '&find_loc=' + encodeURIComponent(p.address || (p.lat + ',' + p.lng)),
      tripadvisor: p.tripadvisorUrl || ('https://www.tripadvisor.com/Search?q=' + q),
      menu: p.website || ('https://www.google.com/search?q=' + encodeURIComponent(p.name + ' ' + (p.address || '') + ' menu'))
    };
  }
  const I = {
    pin: '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    search: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    arrow: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    clock: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9 2h6"/></svg>',
    heart: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C80000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    gem: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7A4E00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M12 21L8 9l4-6 4 6z"/></svg>',
    wheel: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/></svg>',
    home: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    cmp: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/></svg>',
    car: '<svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14l-1.5-6a2 2 0 0 0-2-1.5h-7a2 2 0 0 0-2 1.5z"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
    down: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F7A3D" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    nav: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8z"/></svg>',
    phone: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    menu: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7"/></svg>',
    share: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/></svg>'
  };

  // ---------- data ----------
  async function init() {
    try { FM.status = await api('/api/status'); FM.live = !!FM.status.live; } catch (e) { FM.live = false; }
    if (FM.live && FM.status.turnstileSiteKey) setupTurnstile(FM.status.turnstileSiteKey);
    if (!FM.live) FM.origin = DEFAULT_ORIGIN;
    window.addEventListener('hashchange', route);
    route();
    loadExtras();
  }

  function setupTurnstile(siteKey) {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.onload = () => {
      const box = document.createElement('div'); box.style.display = 'none'; document.body.appendChild(box);
      FM.turnstile = window.turnstile.render(box, { sitekey: siteKey, size: 'flexible', appearance: 'interaction-only' });
    };
    document.head.appendChild(s);
  }
  async function turnstileToken() {
    for (let i = 0; i < 20; i++) {
      const t = window.turnstile && window.turnstile.getResponse(FM.turnstile);
      if (t) { setTimeout(() => window.turnstile.reset(FM.turnstile), 0); return t; }
      await sleep(150);
    }
    return null;
  }

  async function loadExtras() {
    if (!FM.live) return;
    const o = origin();
    const jobs = [
      api('/api/holiday').then((d) => { FM.extras.holiday = d && d.today; }),
      api('/api/weather?lat=' + o.lat + '&lng=' + o.lng).then((d) => { FM.extras.weather = d; }),
      api('/api/events?lat=' + o.lat + '&lng=' + o.lng).then((d) => { FM.extras.events = d && d.events; })
    ];
    await Promise.allSettled(jobs);
    if (currentRoute().name === 'home') render();
  }

  function setPlaces(list) { list.forEach((p) => { FM.placesById[p.id] = p; }); }

  function demoPlaces() { const list = window.FM_SAMPLE.places; setPlaces(list); return list; }

  function liveQueries(parsed) {
    const type = parsed.types[0] || '';
    if (parsed.items.length) return parsed.items.map((i) => (i.name + ' ' + type).trim());
    if (type) return [type];
    const f = parsed.features.map((x) => x.key);
    if (f.includes('romantic')) return ['romantic restaurant'];
    if (f.includes('tvs')) return ['sports bar'];
    if (f.includes('late')) return ['late night food'];
    return ['restaurants'];
  }

  // Runs the staged load. onStep(i) moves the progress bar.
  async function fetchPlaces(parsed, onStep, opts) {
    let o = origin(); let anchorName = null;
    const key = JSON.stringify([parsed.items, parsed.types, parsed.features.map((f) => f.key), parsed.anchor, o.lat.toFixed(3), o.lng.toFixed(3), FM.live, opts && opts.gems]);
    if (FM.cache[key]) return FM.cache[key];
    const notes = [];
    let places = [];
    if (!FM.live) {
      onStep(0); await sleep(450);
      if (parsed.anchor) notes.push('Looking up "' + parsed.anchor + '" needs the live version, so these are near ' + o.name + '.');
      places = demoPlaces();
      onStep(1); await sleep(450); onStep(2); await sleep(400); onStep(3); await sleep(400);
    } else {
      onStep(0);
      if (parsed.anchor) {
        try {
          const g = await api('/api/geocode?q=' + encodeURIComponent(parsed.anchor) + '&lat=' + o.lat + '&lng=' + o.lng);
          if (g && g.lat) { o = { name: g.name, lat: g.lat, lng: g.lng }; anchorName = g.name; }
          else notes.push('Couldn’t find "' + parsed.anchor + '", so these are near ' + o.name + '.');
        } catch (e) { notes.push('Couldn’t look up "' + parsed.anchor + '" right now, so these are near ' + o.name + '.'); }
      }
      const radiusM = Math.min(50000, Math.round((FM.radius >= 999 ? 40 : Math.max(FM.radius, 25)) * 700));
      const qs = liveQueries(parsed);
      const results = await Promise.allSettled(qs.map((q) => api('/api/search', { json: { textQuery: q, lat: o.lat, lng: o.lng, radius: radiusM }, turnstile: true })));
      const byId = {};
      results.forEach((r) => { if (r.status === 'fulfilled' && r.value && r.value.places) r.value.places.forEach((p) => { byId[p.id] = byId[p.id] || p; }); });
      places = Object.values(byId);
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length === results.length) {
        const st = failed[0].reason && failed[0].reason.status;
        throw new Error(st === 429 ? 'limit' : 'search');
      }
      places.forEach((p) => { p.chain = L.isChain(p.name); });
      // extra places from OpenStreetMap when Google found very few
      if (places.length < 5) {
        try {
          const osm = await api('/api/osm?lat=' + o.lat + '&lng=' + o.lng + '&radius=' + radiusM + '&q=' + encodeURIComponent(qs[0]));
          (osm.places || []).forEach((p) => { if (!places.some((x) => L.km(x, p) < 0.08)) places.push(p); });
        } catch (e) { /* optional */ }
      }
      onStep(1);
      try {
        const top = places.slice().sort((a, b) => (b.sources.google ? b.sources.google.count : 0) - (a.sources.google ? a.sources.google.count : 0)).slice(0, 6);
        const ta = await api('/api/tripadvisor', { json: { places: top.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })) } });
        Object.keys(ta.results || {}).forEach((id) => {
          const p = places.find((x) => x.id === id); const t = ta.results[id];
          if (p && t && t.rating) { p.sources.tripadvisor = { rating: t.rating, count: t.count }; p.tripadvisorUrl = t.url; }
        });
      } catch (e) { /* optional */ }
      onStep(2);
      try {
        const dm = await api('/api/drive', { json: { origin: { lat: o.lat, lng: o.lng }, mode: FM.mode, places: places.slice(0, 40).map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })) } });
        FM.driveMinutes = Object.assign(FM.driveMinutes || {}, dm.minutes || {});
      } catch (e) { /* estimates are used instead */ }
      onStep(3);
      try {
        const chains = [...new Set(places.filter((p) => p.chain).map((p) => p.name))].slice(0, 5);
        if (chains.length) {
          const m = await api('/api/menus', { json: { chains: chains } });
          places.forEach((p) => { const items = m.menus && m.menus[p.name]; if (items && items.length) { p.menu = items; p.chainMenu = true; p.menuComplete = false; } });
        }
      } catch (e) { /* optional */ }
      setPlaces(places);
    }
    const out = { places: places, origin: o, anchorName: anchorName, notes: notes };
    FM.cache[key] = out;
    return out;
  }

  // ---------- routing ----------
  function currentRoute() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const params = new URLSearchParams(qs || '');
    const parts = path.split('/');
    if (parts[0] === 's') return { name: 'results', params: params };
    if (parts[0] === 'p') return { name: 'place', id: decodeURIComponent(parts[1] || '') };
    if (parts[0] === 'c') return { name: 'compare' };
    if (parts[0] === 'w') return { name: 'wheel' };
    return { name: 'home' };
  }
  function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }
  function searchHash(q, extra) { const p = new URLSearchParams(Object.assign({ q: q }, extra || {})); return '#/s?' + p.toString(); }

  function route() {
    const r = currentRoute();
    closeSheet();
    if (r.name === 'results') startSearch(r.params);
    else render();
    window.scrollTo(0, 0);
  }

  // ---------- search ----------
  let searchSeq = 0;
  async function startSearch(params) {
    const q = params.get('q') || '';
    const special = params.get('m') || '';
    FM.radius = params.get('r') ? Number(params.get('r')) : FM.userRadius;
    const seq = ++searchSeq;
    let parsed = L.parseQuery(q);
    if (special === 'hungry') { parsed.features.push({ key: 'openNow', label: 'Open now' }); }
    FM.ui.showOthers = false; FM.ui.showRuled = false;
    FM.loading = { step: 0, q: q, special: special };
    FM.last = { q: q, parsed: parsed, special: special, result: null, error: null };
    render();
    try {
      const data = await fetchPlaces(parsed, (i) => { if (seq === searchSeq && FM.loading) { FM.loading.step = i; renderProgressOnly(); } }, { gems: special === 'gems' });
      if (seq !== searchSeq) return;
      FM.loading.step = 4; renderProgressOnly(); await sleep(250);
      const radius = special === 'hungry' ? Math.min(FM.radius, 10) : FM.radius;
      const res = L.rank(data.places, parsed, { origin: data.origin, now: new Date(), radius: radius, fixedRadius: params.get('fixed') === '1', mode: FM.mode,
        sort: special === 'gems' ? 'gems' : FM.sort, gemsOnly: special === 'gems', driveMinutes: FM.live ? FM.driveMinutes : null, minGood: special === 'gems' ? 1 : FM.live ? 6 : 3 });
      FM.last.result = res; FM.last.data = data;
      if (FM.live && (parsed.types.includes('sports bar') || parsed.features.some((f) => f.key === 'tvs'))) {
        try { const g = await api('/api/games'); FM.last.games = (g.games || []).slice(0, 3); } catch (e) { /* optional */ }
      }
      if (special !== 'gems' && special !== 'hungry' && q) {
        const top3 = res.rows.slice(0, 3).map((r) => ({ id: r.place.id, name: r.place.name }));
        if (top3.length >= 2) FM.wheel.suggested = top3;
      }
    } catch (e) {
      FM.last.error = e.message === 'limit' ? 'limit' : 'search';
    }
    FM.loading = null;
    if (seq === searchSeq) render();
  }

  function rebuildQuery(parsed) {
    const bits = [];
    if (parsed.items.length) bits.push(parsed.items.map((i) => i.name).join(' and '));
    if (parsed.types.length) bits.push(parsed.types.map((t) => (t === 'mexican' ? 'taco place' : t)).join(' '));
    parsed.features.forEach((f) => bits.push(FEATURE_PHRASE[f.key] || f.key));
    if (parsed.anchor) bits.push('near ' + parsed.anchor);
    return bits.join(' ').trim();
  }

  // ---------- rendering ----------
  function render() {
    const r = currentRoute();
    let html = '';
    if (!FM.live) html += '<div class="demo-banner">Demo mode: sample places around Paramus. Real places turn on once the Google connection is set up.</div>';
    if (r.name === 'home') html += viewHome();
    else if (r.name === 'results') html += viewResults();
    else if (r.name === 'place') html += viewPlace(r.id);
    else if (r.name === 'compare') html += viewCompare();
    else if (r.name === 'wheel') html += viewWheel();
    html += viewTabs(r.name);
    $app.innerHTML = html;
    if (r.name === 'place') loadPlaceExtras(r.id);
  }

  function viewTabs(active) {
    const lastQ = FM.last && FM.last.q ? searchHash(FM.last.q) : '#/s?q=';
    const tab = (href, icon, label, on, badge) => '<a href="' + href + '" class="' + (on ? 'on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + icon + label + (badge ? ' (' + badge + ')' : '') + '</a>';
    return '<nav class="tabs" aria-label="Main"><div>' + tab('#/', I.home, 'Home', active === 'home') + tab(lastQ, I.search, 'Search', active === 'results') +
      tab('#/c', I.cmp, 'Compare', active === 'compare', FM.compare.length || '') + tab('#/w', I.wheel, 'Wheel', active === 'wheel') + '</div></nav>';
  }

  function searchForm(value, big) {
    return '<form class="search' + (big ? '' : ' small-s') + '" data-form="search" role="search">' +
      '<label for="q" class="sr">Search for food</label>' + (big ? I.search : '') +
      '<input id="q" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="Spicy chicken sandwich, boba, wings…" value="' + esc(value || '') + '">' +
      '<button class="go" type="submit" aria-label="Search">' + I.arrow + '</button></form>';
  }

  function viewHome() {
    const o = origin();
    let banners = '';
    const ex = FM.extras;
    if (ex.holiday) banners += '<div class="notice warn">Today is ' + esc(ex.holiday) + '. Hours may be different, so call ahead.</div>';
    if (ex.weather && ex.weather.raining) banners += '<div class="notice">It’s raining near you. Try <a href="' + searchHash('', { m: 'hungry' }) + '">Hungry Now</a> for quick spots close by.</div>';
    if (ex.events && ex.events.length) banners += '<div class="notice">' + esc(ex.events[0].name) + ' tonight at ' + esc(ex.events[0].venue) + '. <a href="' + searchHash('restaurants near ' + ex.events[0].venue) + '">Eat nearby</a></div>';
    const cats = [['Chicken', 'chicken'], ['Tacos', 'tacos'], ['Pizza', 'pizza'], ['Coffee', 'coffee'], ['Ice cream', 'ice cream'], ['Wings', 'wings'], ['Sports bars', 'sports bar'], ['Noodles', 'noodles'], ['Late night', 'late night food']];
    return '<div class="top" style="gap:18px;padding-top:18px">' +
      '<div class="row between"><img src="logo-wide.png" alt="Food Mania" style="height:44px;width:auto"><button class="pill-btn" data-act="location">' + I.pin + esc(o.name) + '</button></div>' +
      banners +
      '<h1 class="hero">What are you<br>craving?</h1>' + searchForm('', true) +
      '<div class="small muted">Try "sports bar with TVs and wings" or "chicken sandwich and fried pickles"</div></div>' +
      '<div class="pad" style="margin-top:8px"><div class="modes">' +
      '<a class="mode primary" href="' + searchHash('', { m: 'hungry' }) + '">' + I.clock + '<b>Hungry Now</b><span>Open, close by, good</span></a>' +
      '<button class="mode" data-act="date">' + I.heart + '<b>Date Night</b><span>Views, vibes, budget</span></button>' +
      '<a class="mode" href="' + searchHash('', { m: 'gems', r: 25 }) + '">' + I.gem + '<b>Hidden Gems</b><span>Loved, under the radar</span></a>' +
      '<a class="mode" href="#/w">' + I.wheel + '<b>Can’t Decide</b><span>Spin the wheel</span></a></div></div>' +
      '<div class="pad" style="margin-top:20px"><div class="scroller">' + cats.map((c) => '<a class="cat" style="display:inline-flex;align-items:center" href="' + searchHash(c[1]) + '">' + c[0] + '</a>').join('') + '</div></div>' +
      viewTopNear();
  }

  function viewTopNear() {
    if (FM.live && !FM.topNear) { loadTopNear(); return '<div class="pad" style="margin-top:22px"><h2 class="sec">Top near you</h2><div class="shim" style="height:120px;margin-top:12px;border-radius:16px"></div></div>'; }
    const places = FM.live ? FM.topNear : demoPlaces();
    if (!places || !places.length) return '';
    const res = L.rank(places, L.parseQuery(''), { origin: origin(), now: new Date(), radius: 15, mode: FM.mode, sort: 'score', driveMinutes: FM.driveMinutes, minGood: 3 });
    const rows = res.rows.slice(0, 6);
    return '<div class="pad" style="margin-top:22px"><div class="row between"><h2 class="sec">Top near you</h2><a class="small bold" href="' + searchHash('restaurants') + '">See all</a></div>' +
      '<div class="scroller" style="gap:12px;margin-top:12px">' + rows.map((r) => {
        const p = r.place;
        return '<a href="#/p/' + encodeURIComponent(p.id) + '" class="card" style="width:220px;flex-shrink:0">' + photo(p, 'height:118px') +
          '<div style="padding:10px 12px 12px" class="col gap6"><div class="row between gap6"><b style="font-size:15px">' + esc(p.name) + '</b>' + (r.gem && r.gem >= 70 ? '<span class="badge b-gem">Gem ' + r.gem + '</span>' : '') + '</div>' +
          '<div class="small muted">' + scoreText(r) + ' · ' + r.minutes + ' min</div><div class="tiny bold ' + r.open.cls + '">' + esc(r.open.label) + '</div></div></a>';
      }).join('') + '</div></div>';
  }
  let topLoading = false;
  async function loadTopNear() {
    if (topLoading) return; topLoading = true;
    const o = origin(); const k = 'fm-top-' + o.lat.toFixed(2) + ',' + o.lng.toFixed(2);
    const saved = load(k);
    if (saved && Date.now() - saved.t < 6 * 3600 * 1000) { FM.topNear = saved.places; setPlaces(saved.places); }
    else {
      try { const d = await api('/api/search', { json: { textQuery: 'restaurants', lat: o.lat, lng: o.lng, radius: 12000 }, turnstile: true }); FM.topNear = d.places || []; setPlaces(FM.topNear); save(k, { t: Date.now(), places: FM.topNear }); }
      catch (e) { FM.topNear = []; }
    }
    topLoading = false;
    if (currentRoute().name === 'home') render();
  }

  function photo(p, style, label) {
    const url = p.photos && p.photos[0];
    return '<div class="photo" style="' + style + ';background-color:' + (p.tint || '#EED7C8') + (url ? ';background-image:url(\'' + esc(url) + '\')' : '') + '">' +
      (url ? '' : '<span class="ph-label">' + (label || 'No photo yet') + '</span>') + '</div>';
  }
  function scoreText(r) {
    if (!r.score.count) return 'No ratings yet';
    return '<b style="color:var(--ink)">' + r.score.score.toFixed(1) + '</b> from ' + num(r.score.count) + ' ratings';
  }
  function minutesText(r) { return (r.exactMinutes ? '' : 'about ') + r.minutes + ' min ' + (FM.mode === 'walk' ? 'walk' : 'drive'); }

  const STEPS = ['Finding places near you', 'Checking ratings across Google and Tripadvisor', 'Working out drive times', 'Scanning menus and reviews'];
  function viewProgress() {
    const s = FM.loading ? FM.loading.step : 4;
    const pct = [8, 35, 60, 82, 100][s];
    return '<div class="progress" id="progress" aria-live="polite"><div class="row between"><div class="display" style="font-size:18px">' + (s >= 4 ? 'All set' : 'Hang tight, loading everything near you') + '</div><div class="small muted bold">' + pct + '%</div></div>' +
      '<div class="bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><div style="width:' + pct + '%"></div></div>' +
      '<div class="col gap8">' + STEPS.map((t, i) => '<div class="step ' + (i < s ? 'done' : i === s ? 'active' : '') + '">' + (i < s ? I.check : '<span class="ring"></span>') + '<span>' + t + '</span></div>').join('') + '</div>' +
      '<div class="small muted">First time anyone’s searched here, so this takes a few seconds. Next time it’s instant.</div></div>';
  }
  function renderProgressOnly() { const el = document.getElementById('progress'); if (el) el.outerHTML = viewProgress(); }

  function viewResults() {
    const last = FM.last || { q: '', parsed: L.parseQuery('') };
    const parsed = last.parsed;
    let html = '<div class="top"><div class="row gap8"><a class="icon-btn" href="#/" aria-label="Back">' + I.back + '</a><div style="flex:1;min-width:0">' + searchForm(last.q, false) + '</div></div>';
    const typoFixed = last.q && L.normalize(last.q) !== last.q.toLowerCase().replace(/[^a-z0-9' &,+-]/g, ' ').replace(/\s+/g, ' ').trim();
    const chips = [];
    parsed.items.forEach((it, i) => chips.push('<button class="chip" data-act="rm-item" data-i="' + i + '">' + esc(it.name) + ' <span class="x" aria-hidden="true">×</span><span class="sr">Remove</span></button>'));
    parsed.types.forEach((t, i) => chips.push('<button class="chip" data-act="rm-type" data-i="' + i + '">' + esc(t === 'mexican' ? 'Taco place' : t[0].toUpperCase() + t.slice(1)) + ' <span class="x" aria-hidden="true">×</span><span class="sr">Remove</span></button>'));
    parsed.features.forEach((f, i) => chips.push('<button class="chip" data-act="rm-feat" data-i="' + i + '">' + esc(f.label) + ' <span class="x" aria-hidden="true">×</span><span class="sr">Remove</span></button>'));
    if (parsed.anchor) chips.push('<button class="chip" data-act="rm-anchor">Near ' + esc(parsed.anchor) + ' <span class="x" aria-hidden="true">×</span></button>');
    const rad = FM.radius >= 999 ? 'Any distance' : 'Within ' + FM.radius + ' min ' + (FM.mode === 'walk' ? 'walk' : 'drive');
    chips.push('<button class="chip outline" data-act="distance">' + I.car + esc(rad) + I.down + '</button>');
    chips.push('<button class="chip dashed" data-act="filters">+ Add filter</button>');
    html += '<div class="chips">' + chips.join('') + '</div>';
    if (typoFixed) html += '<div class="small muted">Showing results for <b>' + esc(L.normalize(last.q)) + '</b></div>';
    if (last.special !== 'gems') {
      html += '<div class="seg" role="tablist" aria-label="Sort">' + [['best', 'Best match'], ['score', 'Score'], ['closest', 'Closest'], ['gems', 'Gems']].map((s) =>
        '<button role="tab" aria-selected="' + (FM.sort === s[0]) + '" data-act="sort" data-v="' + s[0] + '">' + s[1] + '</button>').join('') + '</div>';
    }
    html += '</div><div class="pad col gap12">';
    if (FM.loading) return html + viewProgress() + '<div class="card" style="padding:12px"><div class="shim" style="width:60%"></div><div class="shim" style="width:40%;margin-top:8px"></div></div></div>';
    if (last.error) {
      return html + '<div class="notice warn">' + (last.error === 'limit' ? 'Food Mania hit its free daily search limit. It resets tomorrow. Saved areas still work.' : 'Search isn’t reachable right now. Check your signal and try again.') +
        '</div><button class="big-btn light" data-act="retry">Try again</button></div>';
    }
    const res = last.result; if (!res) return html + '</div>';
    const data = last.data || {};
    const title = last.special === 'gems' ? 'Hidden gems' : last.special === 'hungry' ? 'Hungry Now: open and close by' : '';
    if (title) html += '<h2 class="sec" style="margin-top:4px">' + title + '</h2>';
    const notes = (data.notes || []).concat(parsed.notes || []);
    if (data.anchorName) notes.unshift('Showing places near ' + data.anchorName + '.');
    if (res.widened) notes.push(res.widened >= 999 ? 'Not much close by, so we looked farther out.' : 'Not much close by, so we looked up to ' + res.widened + ' min away.');
    notes.forEach((n) => { html += '<div class="notice">' + esc(n) + '</div>'; });
    if (last.games && last.games.length) html += '<div class="notice"><b style="color:var(--ink)">Games today:</b> ' + last.games.map((g) => esc(g.name)).join(' · ') + '</div>';
    const count = res.rows.length;
    if (parsed.items.length && count && res.rows.every((r) => r.items.every((i) => i.label === 'unconfirmed'))) {
      html += '<div class="notice warn">We couldn\u2019t find "' + esc(parsed.items.map((i) => i.name).join(', ')) + '" on any menu or review nearby. Check the spelling, or try a broader word. Here are places that might still have it.</div>';
    }
    const confirmed = res.rows.filter((r) => r.items.length && r.items.every((i) => i.label === 'menu' || i.label === 'reviews')).length;
    html += '<div class="small muted">' + count + ' place' + (count === 1 ? '' : 's') + ' near ' + esc((data.origin || origin()).name) + (parsed.items.length ? ' · ' + confirmed + ' confirmed' : '') + '</div>';
    if (!count) {
      html += '<div class="empty"><div class="display" style="font-size:20px;color:var(--ink)">Nothing matched all of that</div><p>Try removing a filter above, or widen the distance.</p>' +
        '<button class="big-btn light" data-act="distance">Change distance</button></div>';
    }
    if (res.groups) {
      if (!res.groups[0].rows.length && count) html += '<div class="notice warn">No place nearby has all ' + parsed.items.length + '. Here are the best with some of them.</div>';
      res.groups.forEach((g) => { if (g.rows.length) html += '<div class="group-h">' + esc(g.title) + '</div><div class="grid-results col gap12">' + g.rows.map(card).join('') + '</div>'; });
    } else {
      html += '<div class="grid-results col gap12">' + res.rows.map(card).join('') + '</div>';
    }
    if (res.others && res.others.length) {
      html += '<button class="big-btn light" data-act="toggle-others">' + (FM.ui.showOthers ? 'Hide' : 'Show') + ' ' + res.others.length + ' more we couldn’t confirm</button>';
      if (FM.ui.showOthers) html += '<div class="grid-results col gap12">' + res.others.map(card).join('') + '</div>';
    }
    if (res.ruledOut && res.ruledOut.length) {
      html += '<button class="big-btn light" data-act="toggle-ruled">' + (FM.ui.showRuled ? 'Hide' : 'Show') + ' ' + res.ruledOut.length + ' we ruled out</button>';
      if (FM.ui.showRuled) html += '<div class="grid-results col gap12">' + res.ruledOut.map(card).join('') + '</div>';
    }
    html += '<div style="height:70px"></div></div>';
    if (FM.compare.length >= 2) html += '<div class="sticky-bottom"><div><a class="big-btn dark" style="flex:1" href="#/c">' + I.cmp + 'Compare ' + FM.compare.length + ' places</a></div></div>';
    return html;
  }

  function card(r) {
    const p = r.place;
    const inCmp = FM.compare.includes(p.id);
    const meta = [p.cuisine, dollars(p.priceLevel), minutesText(r)].filter(Boolean).join(' · ');
    let matches = '';
    r.items.forEach((m) => {
      const lab = LABELS[m.label];
      let text = m.text || (m.label === 'likely' ? m.item + ' · check the menu' : m.label === 'no' ? 'Not on their menu' : m.item);
      if (m.label === 'menu' && m.chainMenu) text += ' (chain menu)';
      matches += '<div class="match-line"><div class="row gap8" style="min-width:0;flex:1"><span class="badge ' + lab[1] + '">' + lab[0] + '</span><span class="name">' + esc(text) + '</span></div>' +
        (m.price ? '<b class="small">' + money(m.price) + '</b>' : '') + '</div>';
    });
    if (r.feats.length) {
      matches += '<div class="tiny muted">' + r.feats.map((f) => esc(f.label) + ': <b style="color:' + (f.state === 'no' ? '#8F2A16' : f.state === 'yes' ? 'var(--green-ink)' : 'var(--muted)') + '">' + STATE_TEXT[f.state] + '</b>').join(' · ') + '</div>';
    }
    const needMenu = r.items.some((m) => m.label === 'likely' || m.label === 'unconfirmed' || m.label === 'closest');
    const links = dirLinks(p);
    return '<div class="card"><a href="#/p/' + encodeURIComponent(p.id) + '" class="result-main" style="color:inherit">' + photo(p, '') +
      '<div class="col gap6" style="flex:1;min-width:0"><div class="row between gap6" style="align-items:flex-start"><b style="font-size:16px;line-height:1.2">' + esc(p.name) + '</b>' +
      (r.gem && r.gem >= 70 ? '<span class="badge b-gem">Gem ' + r.gem + '</span>' : '') + '</div>' +
      '<div class="small muted">' + scoreText(r) + '</div><div class="small muted">' + esc(meta) + '</div>' +
      '<div class="tiny bold ' + r.open.cls + '">' + esc(r.open.label) + '</div></div></a>' +
      (matches ? '<div class="match">' + matches + '</div>' : '') +
      '<div class="card-actions" style="padding-top:' + (matches ? '0' : '0') + '">' +
      '<button class="mini' + (inCmp ? ' on' : '') + '" data-act="cmp" data-id="' + esc(p.id) + '" aria-pressed="' + inCmp + '">' + (inCmp ? '✓ Comparing' : '+ Compare') + '</button>' +
      '<a class="mini" href="' + esc(isApple() ? links.apple : links.google) + '" target="_blank" rel="noopener">Directions</a>' +
      (needMenu ? '<a class="mini" href="' + esc(links.menu) + '" target="_blank" rel="noopener">See menu</a>' : '') + '</div></div>';
  }

  function viewPlace(id) {
    const p = FM.placesById[id] || (window.FM_SAMPLE.places.find((x) => x.id === id));
    if (!p) return '<div class="top"><a class="icon-btn" href="#/" aria-label="Back">' + I.back + '</a></div><div class="empty">This place isn’t loaded anymore. Search again to find it.</div>';
    const now = new Date();
    const all = Object.values(FM.placesById);
    const res = L.rank(all, L.parseQuery(''), { origin: (FM.last && FM.last.data && FM.last.data.origin) || origin(), now: now, radius: 999, fixedRadius: true, mode: FM.mode, driveMinutes: FM.live ? FM.driveMinutes : null });
    const r = res.rows.find((x) => x.place.id === id) || res.rows[0];
    const tr = L.typeRank(r, res.rows);
    const links = dirLinks(p);
    const ph = p.photos || [];
    const hero = '<div class="place-hero">' + '<div class="photo" style="flex:2;background-color:' + (p.tint || '#EED7C8') + (ph[0] ? ';background-image:url(\'' + esc(ph[0]) + '\')' : '') + '"></div>' +
      '<div class="side"><div class="photo" style="background-color:#E7CDBB' + (ph[1] ? ';background-image:url(\'' + esc(ph[1]) + '\')' : '') + '"></div>' +
      '<a class="photo" href="' + esc(links.googlePlace) + '" target="_blank" rel="noopener" style="background-color:#E2C6B2;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#4A3A2E' + (ph[2] ? ';background-image:url(\'' + esc(ph[2]) + '\')' : '') + '">' + (ph[2] ? '' : 'More photos') + '</a></div>' +
      '<a class="icon-btn solid back" href="javascript:history.back()" aria-label="Back">' + I.back + '</a></div>';
    const meta = [p.cuisine, dollars(p.priceLevel), minutesText(r)].filter(Boolean).join(' · ');
    const parts = r.score.parts.map((x) => (x.source === 'google' ? 'Google' : x.source === 'tripadvisor' ? 'Tripadvisor' : x.source) + ' ' + x.rating.toFixed(1) + ' (' + num(x.count) + ')').join(' · ');
    let html = hero + '<div class="pad col gap12" style="margin-top:16px">' +
      '<div class="col" style="gap:4px"><h1 class="display" style="margin:0;font-size:26px">' + esc(p.name) + '</h1><div class="small muted">' + esc(meta) + ' · <span class="bold ' + r.open.cls + '">' + esc(r.open.label) + '</span></div></div>' +
      '<div class="row gap10" style="align-items:stretch"><div class="score-box"><div class="tiny bold muted">Food Mania Score</div>' +
      (r.score.count ? '<div class="row gap6" style="align-items:baseline"><span class="display" style="font-size:28px">' + r.score.score.toFixed(1) + '</span><span class="tiny muted">' + num(r.score.count) + ' ratings</span></div><div class="tiny muted">' + esc(parts) + '</div>' : '<div class="small muted">No ratings yet</div>') + '</div>' +
      (tr && tr.pct ? '<div class="rank-box"><div class="tiny bold">Rank</div><div class="display" style="font-size:22px">Top ' + tr.pct + '%</div><div class="tiny">' + esc(tr.cuisine) + ' spots nearby</div></div>' :
        r.gem && r.gem >= 70 ? '<div class="rank-box" style="background:var(--gem-soft);color:var(--gem)"><div class="tiny bold">Hidden gem</div><div class="display" style="font-size:24px">' + r.gem + '</div><div class="tiny">Gem Score</div></div>' : '') + '</div>' +
      '<div class="actions"><button class="act primary" data-act="directions" data-id="' + esc(p.id) + '">' + I.nav + 'Directions</button>' +
      (p.phone ? '<a class="act" href="tel:' + esc(p.phone) + '">' + I.phone + 'Call</a>' : '<span class="act" style="opacity:0.5">' + I.phone + 'No phone</span>') +
      '<a class="act" href="' + esc(links.menu) + '" target="_blank" rel="noopener">' + I.menu + (p.website ? 'Website' : 'Menu') + '</a>' +
      '<button class="act" data-act="share" data-id="' + esc(p.id) + '">' + I.share + 'Share</button></div>' +
      '<div class="tiny muted">Open in <a href="' + esc(links.apple) + '" target="_blank" rel="noopener">Apple Maps</a> · <a href="' + esc(links.googlePlace) + '" target="_blank" rel="noopener">Google Maps</a> · <a href="' + esc(links.yelp) + '" target="_blank" rel="noopener">Yelp</a> · <a href="' + esc(links.tripadvisor) + '" target="_blank" rel="noopener">Tripadvisor</a></div>';
    const lastParsed = FM.last && FM.last.parsed;
    if (lastParsed && (lastParsed.items.length || lastParsed.features.length)) {
      const its = lastParsed.items.map((it) => Object.assign({ item: it.name }, L.matchItem(it, p)));
      const fs = lastParsed.features.map((f) => ({ label: f.label, state: L.checkFeature(f.key, p, now) }));
      html += '<h2 class="sec" style="font-size:18px">Your search</h2><div class="list-card">' +
        its.map((m) => '<div><span>' + esc(m.item) + (m.text && m.label !== 'reviews' ? ' <span class="tiny muted">(' + esc(m.text) + ')</span>' : '') + '</span><span class="badge ' + LABELS[m.label][1] + '">' + LABELS[m.label][0] + '</span></div>').join('') +
        fs.map((f) => '<div><span>' + esc(f.label) + '</span><span class="small bold">' + STATE_TEXT[f.state] + '</span></div>').join('') + '</div>';
    }
    const order = L.whatToOrder(p);
    const ai = FM.extras['ai-' + id];
    if (order.length || (ai && ai.order && ai.order.length)) {
      const list = order.length ? order : ai.order.map((o) => ({ name: o, mentions: 0, quote: '' }));
      html += '<h2 class="sec" style="font-size:18px">What to order</h2><div class="list-card">' + list.map((o) => '<div><div class="col" style="gap:2px"><b class="small" style="font-size:14px">' + esc(o.name) + '</b>' +
        (o.quote ? '<span class="tiny muted">"' + esc(o.quote) + '"' + (o.mentions ? ' · ' + o.mentions + ' mention' + (o.mentions === 1 ? '' : 's') : '') + '</span>' : '') + '</div>' + (o.price ? '<b class="small">' + money(o.price) + '</b>' : '') + '</div>').join('') + '</div>';
    }
    if (ai && ai.summary) html += '<h2 class="sec" style="font-size:18px">What people say</h2><div class="notice" style="color:var(--ink)">' + esc(ai.summary) + '</div>';
    else if ((p.reviews || []).length) {
      const good = p.reviews.filter((x) => (x.rating || 5) >= 4 && x.text).slice(0, 2);
      if (good.length) html += '<h2 class="sec" style="font-size:18px">What people say</h2><div class="list-card">' + good.map((x) => '<div><span class="small">"' + esc(x.text.length > 160 ? x.text.slice(0, 157) + '…' : x.text) + '"</span></div>').join('') + '</div>';
    }
    const tips = FM.extras['tips-' + id];
    if (tips && tips.length) html += '<h2 class="sec" style="font-size:18px">Tips from Foursquare</h2><div class="list-card">' + tips.slice(0, 3).map((t) => '<div><span class="small">' + esc(t) + '</span></div>').join('') + '</div>';
    if (p.chainMenu && p.menu && p.menu.length) {
      html += '<h2 class="sec" style="font-size:18px">Menu (chain-wide)</h2><div class="list-card">' + p.menu.slice(0, 8).map((m, i) => '<div><span class="small">' + esc(m.name) + '</span>' +
        '<button class="mini" data-act="cal" data-id="' + esc(p.id) + '" data-i="' + i + '">' + (m.calories ? m.calories + ' cal' : 'Calories') + '</button></div>').join('') + '</div>';
    }
    if (p.hours && p.hours.length) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      html += '<h2 class="sec" style="font-size:18px">Hours</h2><div class="list-card">' + [1, 2, 3, 4, 5, 6, 0].map((d) => {
        const h = p.hours[d];
        return '<div' + (d === now.getDay() ? ' style="font-weight:700"' : '') + '><span class="small">' + days[d] + '</span><span class="small">' + (h ? (h[0] === 0 && h[1] >= 1440 ? 'Open 24 hours' : L.fmtTime(h[0]) + ' – ' + L.fmtTime(h[1])) : 'Closed') + '</span></div>';
      }).join('') + '</div>';
    }
    if (p.osm) html += '<div class="tiny muted">From OpenStreetMap. No ratings yet.</div>';
    html += '<button class="big-btn dark" data-act="cmp" data-id="' + esc(p.id) + '">' + (FM.compare.includes(p.id) ? '✓ In Compare' : 'Add to Compare') + '</button><div style="height:20px"></div></div>';
    return html;
  }

  async function loadPlaceExtras(id) {
    const p = FM.placesById[id];
    if (!FM.live || !p || p.osm) return;
    const jobs = [];
    if (!FM.extras['ai-' + id] && (p.reviews || []).length >= 2) {
      jobs.push(api('/api/summary', { json: { id: id, name: p.name, reviews: p.reviews.slice(0, 8).map((r) => ({ rating: r.rating, text: r.text })) } })
        .then((d) => { FM.extras['ai-' + id] = d; }).catch(() => { FM.extras['ai-' + id] = {}; }));
    }
    if (!FM.extras['tips-' + id]) {
      jobs.push(api('/api/tips?name=' + encodeURIComponent(p.name) + '&lat=' + p.lat + '&lng=' + p.lng)
        .then((d) => { FM.extras['tips-' + id] = d.tips || []; }).catch(() => { FM.extras['tips-' + id] = []; }));
    }
    if (!jobs.length) return;
    await Promise.allSettled(jobs);
    const r = currentRoute(); if (r.name === 'place' && r.id === id) { const y = window.scrollY; render(); window.scrollTo(0, y); }
  }

  // ---------- compare ----------
  function viewCompare() {
    const ps = FM.compare.map((id) => FM.placesById[id]).filter(Boolean);
    let html = '<div class="top"><div class="row between"><div class="row gap6"><a class="icon-btn" href="javascript:history.back()" aria-label="Back">' + I.back + '</a><h1 class="display" style="margin:0;font-size:22px">Head to head</h1></div>' +
      (ps.length ? '<button class="mini" data-act="cmp-clear">Clear</button>' : '') + '</div>';
    if (ps.length < 2) {
      return html + '</div><div class="pad"><div class="empty"><div class="display" style="font-size:20px;color:var(--ink)">Pick 2 or 3 places</div><p>Tap "+ Compare" on any search result, then come back here.</p>' +
        (ps.length ? '<p class="small">You have ' + esc(ps[0].name) + ' so far.</p>' : '') + '<a class="big-btn" href="' + (FM.last && FM.last.q ? searchHash(FM.last.q) : '#/') + '">Find places</a></div></div>';
    }
    const now = new Date();
    const lastItem = FM.last && FM.last.parsed && FM.last.parsed.items[0];
    const itemMode = FM.ui.cmpMode === 'item' && lastItem;
    html += '<div class="seg" role="tablist" aria-label="Compare by"><button role="tab" aria-selected="' + !itemMode + '" data-act="cmp-mode" data-v="place">Whole place</button>' +
      (lastItem ? '<button role="tab" aria-selected="' + !!itemMode + '" data-act="cmp-mode" data-v="item">' + esc(lastItem.name[0].toUpperCase() + lastItem.name.slice(1)) + '</button>' : '') + '</div>';
    const lenses = [['overall', 'Overall'], ['rating', 'Rating'], ['drive', 'Drive'], ['price', 'Price'], ['reviews', 'Most ratings']];
    if (!itemMode) html += '<div class="scroller">' + lenses.map((l) => '<button class="mini' + (FM.ui.lens === l[0] ? ' on' : '') + '" data-act="lens" data-v="' + l[0] + '" style="border-radius:999px">' + l[1] + '</button>').join('') + '</div>';
    html += '</div>';
    const res = L.rank(Object.values(FM.placesById), L.parseQuery(''), { origin: (FM.last && FM.last.data && FM.last.data.origin) || origin(), now: now, radius: 999, fixedRadius: true, mode: FM.mode, driveMinutes: FM.live ? FM.driveMinutes : null });
    const rows = ps.map((p) => res.rows.find((x) => x.place.id === p.id)).filter(Boolean);
    const n = rows.length;
    const mid = (p) => (p.priceRange ? (p.priceRange[0] + p.priceRange[1]) / 2 : p.priceLevel ? p.priceLevel * 12 : null);
    const best = (vals, dir) => { const ok = vals.filter((v) => v !== null && v !== undefined); if (!ok.length) return -1; const t = dir > 0 ? Math.max(...ok) : Math.min(...ok); return ok.filter((v) => v === t).length === ok.length && ok.length > 1 ? -1 : vals.indexOf(t); };
    let metric = []; let winner = 0; let verdict = ''; let sub = '';
    if (!itemMode) {
      const sc = rows.map((r) => (r.score.count ? r.score.score : null)); const ct = rows.map((r) => r.score.count || null);
      const dr = rows.map((r) => r.minutes); const pr = rows.map((r) => mid(r.place)); const cl = rows.map((r) => (r.open.known ? (r.open.closeAt || L.openInfo(r.place, new Date(now.getTime() + 3600e3)).closeAt || 0) : null));
      const maxOf = (a) => Math.max(...a.filter((x) => x !== null), 1);
      metric = [
        { key: 'rating', label: 'Rating', vals: rows.map((r) => (r.score.count ? r.score.score.toFixed(1) : 'No ratings')), w: best(sc, 1), bars: sc.map((v) => (v ? Math.round(((v - 3) / 2) * 100) : 0)) },
        { key: 'reviews', label: 'Total ratings', vals: rows.map((r) => num(r.score.count)), w: best(ct, 1), bars: ct.map((v) => Math.round(((v || 0) / maxOf(ct)) * 100)) },
        { key: 'price', label: 'Price per person', vals: rows.map((r) => (r.place.priceRange ? 'About $' + r.place.priceRange[0] + '–' + r.place.priceRange[1] : dollars(r.place.priceLevel) || 'Not listed')), w: best(pr, -1) },
        { key: 'drive', label: FM.mode === 'walk' ? 'Walk' : 'Drive', vals: rows.map((r) => r.minutes + ' min'), w: best(dr, -1), bars: dr.map((v) => Math.round((Math.min(...dr) / v) * 100)) },
        { key: 'hours', label: 'Open', vals: rows.map((r) => r.open.label.replace('Open until', 'Until')), w: best(cl, 1) },
        { key: 'known', label: 'Known for', vals: rows.map((r) => { const o = L.whatToOrder(r.place); return o.length ? o.slice(0, 2).map((x) => x.name).join(', ') : r.place.cuisine || ''; }), w: -1 }
      ];
      const lens = FM.ui.lens;
      if (lens === 'overall') {
        const wins = rows.map((_, i) => metric.filter((m) => m.w === i).length);
        const top = Math.max(...wins); const tied = wins.map((w, i) => (w === top ? i : -1)).filter((i) => i >= 0);
        winner = tied.length > 1 ? tied.sort((a, b) => (sc[b] || 0) - (sc[a] || 0))[0] : tied[0];
        const scored = metric.filter((m) => m.w >= 0).length;
        verdict = rows[winner].place.name + ' wins ' + wins[winner] + ' of ' + scored;
        const others = rows.map((r, i) => (i === winner ? null : { name: r.place.name, good: metric.filter((m) => m.w === i).map((m) => m.label.toLowerCase()) })).filter((x) => x && x.good.length);
        sub = others.length ? others.map((o) => o.name + ' wins on ' + o.good.join(' and ')).join('. ') + '.' : 'Better across the board.';
      } else {
        const m = metric.find((x) => x.key === lens);
        winner = m.w >= 0 ? m.w : 0;
        const label = { rating: 'wins on rating', drive: 'is closest', price: 'is cheapest', reviews: 'has the most ratings' }[lens];
        verdict = m.w >= 0 ? rows[winner].place.name + ' ' + label : 'It’s a tie on ' + m.label.toLowerCase();
        sub = rows.map((r, i) => r.place.name + ': ' + m.vals[i]).join(' · ');
      }
    } else {
      const ms = rows.map((r) => L.matchItem(lastItem, r.place));
      const strength = ms.map((m) => m.rank * 100 + (m.mentions || 0) * 2 + (m.positive || 0));
      winner = strength.indexOf(Math.max(...strength));
      const maxMent = Math.max(1, ...ms.map((m) => m.mentions || 0));
      metric = [
        { label: 'Dish', vals: ms.map((m) => (m.label === 'menu' ? m.text : m.label === 'closest' ? m.text + ' (closest match)' : m.label === 'reviews' ? lastItem.name + ' (from reviews)' : m.label === 'likely' ? 'Probably, check the menu' : m.label === 'no' ? 'Not on the menu' : 'Not confirmed')), w: -1 },
        { label: 'Item price', vals: ms.map((m) => (m.price ? money(m.price) : 'Not listed')), w: best(ms.map((m) => m.price || null), -1) },
        { label: 'Reviews that mention it', vals: ms.map((m) => String(m.mentions || 0)), w: best(ms.map((m) => m.mentions || 0), 1), bars: ms.map((m) => Math.round(((m.mentions || 0) / maxMent) * 100)) },
        { label: 'Positive', vals: ms.map((m) => (m.mentions ? Math.round((m.positive / m.mentions) * 100) + '%' : '–')), w: best(ms.map((m) => (m.mentions ? m.positive / m.mentions : null)), 1), bars: ms.map((m) => (m.mentions ? Math.round((m.positive / m.mentions) * 100) : 0)) },
        { label: 'People say', vals: ms.map((m) => (m.quote ? '"' + m.quote + '"' : 'No reviews of it yet')), w: -1 }
      ];
      verdict = rows[winner].place.name + ' wins on ' + lastItem.name;
      sub = ms.some((m) => m.label === 'closest') ? 'Not every place has the exact dish, so we compared the closest match.' : 'Based on the menu and how often reviewers mention it.';
      if (ms.every((m) => m.label !== 'menu' && m.label !== 'reviews' && m.label !== 'closest')) { verdict = 'None of these confirm ' + lastItem.name; sub = 'Switch to Whole place, or check their menus.'; }
    }
    html += '<div class="pad col gap12"><div class="vs-wrap">' + rows.map((r, i) => '<a href="#/p/' + encodeURIComponent(r.place.id) + '" class="vs-card' + (i === winner ? ' win' : '') + '"><div style="position:relative">' + photo(r.place, 'height:84px') + (i === winner ? '<span class="win-tag">Winner</span>' : '') + '</div>' +
      '<div style="padding:8px 10px 10px" class="col" ><b style="font-size:14px">' + esc(r.place.name) + '</b><span class="tiny muted">' + esc([r.place.cuisine, r.minutes + ' min'].filter(Boolean).join(' · ')) + '</span></div></a>').join('') +
      (n === 2 ? '<div class="vs-badge">VS</div>' : '') + '</div>' +
      '<div class="verdict"><div class="display" style="font-size:17px">' + esc(verdict) + '</div><div class="sub">' + esc(sub) + '</div></div><div>';
    metric.forEach((m) => {
      const focus = !itemMode && FM.ui.lens === m.key;
      html += '<div class="cmp-row' + (focus ? ' focus' : '') + '"><div class="lab">' + esc(m.label) + '</div><div class="cmp-cells" style="grid-template-columns:repeat(' + n + ',minmax(0,1fr))">' +
        m.vals.map((v, i) => '<div style="' + (n === 2 ? '' : 'align-items:center;text-align:center') + '"><span class="' + (m.w === -1 ? '' : m.w === i ? 'wint' : 'lose') + '">' + esc(v) + '</span>' +
          (m.bars ? '<div class="cbar"' + (n === 2 && i === 0 ? '' : ' style="justify-content:flex-start"') + '><div class="' + (m.w === i ? 'w' : '') + '" style="width:' + Math.max(0, Math.min(100, m.bars[i])) + '%"></div></div>' : '') + '</div>').join('') + '</div></div>';
    });
    html += '</div><div class="row gap10" style="margin-bottom:20px"><a class="big-btn" style="flex:1" href="#/p/' + encodeURIComponent(rows[winner].place.id) + '">Go to ' + esc(rows[winner].place.name) + '</a><button class="big-btn light" data-act="cmp-wheel">Spin for it</button></div>';
    if (n < 3) html += '<div class="tiny muted" style="text-align:center;margin-bottom:20px">Add a third place from any search with "+ Compare".</div>';
    return html + '</div>';
  }

  // ---------- wheel ----------
  const WHEEL_COLORS = [['#C80000', '#fff'], ['#17130F', '#fff'], ['#F0B84E', '#17130F'], ['#5E554C', '#fff'], ['#9A0000', '#fff'], ['#D9C3A5', '#17130F']];
  function wheelOptions() {
    const w = FM.wheel;
    if (!w.options) {
      const fromCmp = FM.compare.map((id) => FM.placesById[id]).filter(Boolean).map((p) => ({ id: p.id, name: p.name }));
      w.options = fromCmp.length >= 2 ? fromCmp : (w.suggested || []).slice();
    }
    return w.options;
  }
  function viewWheel() {
    const w = FM.wheel; const opts = wheelOptions(); const n = opts.length;
    const elim = w.mode === 'elim';
    let html = '<div class="top"><div class="row gap6"><a class="icon-btn" href="javascript:history.back()" aria-label="Back">' + I.back + '</a><h1 class="display" style="margin:0;font-size:22px">Can’t decide?</h1></div>' +
      '<div class="seg" role="tablist" aria-label="Wheel mode"><button role="tab" aria-selected="' + !elim + '" data-act="wheel-mode" data-v="spin">Spin for a winner</button><button role="tab" aria-selected="' + elim + '" data-act="wheel-mode" data-v="elim">Knock one out</button></div>' +
      '<div class="chips">' + opts.map((o, i) => '<button class="chip light" data-act="wheel-rm" data-i="' + i + '" style="' + (w.out.includes(i) ? 'text-decoration:line-through;color:var(--faint)' : '') + '">' + esc(o.name) + ' <span class="x" aria-hidden="true">×</span><span class="sr">Remove</span></button>').join('') + '</div>' +
      '<form class="row gap8" data-form="wheel-add"><label for="wadd" class="sr">Add an option</label><input id="wadd" class="text" placeholder="Add a place, like Chipotle" maxlength="40"><button class="mini" type="submit" style="min-height:46px">Add</button></form></div>';
    if (n < 2) return html + '<div class="pad"><div class="empty">Add at least 2 options, or pick places with "+ Compare" in search.</div></div>';
    const seg = 360 / n; const cx = 135; const cy = 135; const R = 125;
    let svg = '<svg role="img" aria-label="Wheel with ' + esc(opts.map((o) => o.name).join(', ')) + '" width="270" height="270" viewBox="0 0 270 270">';
    opts.forEach((o, i) => {
      const a0 = (-90 + i * seg) * Math.PI / 180; const a1 = (-90 + (i + 1) * seg) * Math.PI / 180;
      const x0 = cx + R * Math.cos(a0); const y0 = cy + R * Math.sin(a0); const x1 = cx + R * Math.cos(a1); const y1 = cy + R * Math.sin(a1);
      const out = w.out.includes(i); const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
      svg += '<path d="M' + cx + ' ' + cy + ' L' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + (seg > 180 ? 1 : 0) + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2) + ' Z" fill="' + (out ? '#E4DCD3' : c[0]) + '"/>';
      const am = (-90 + (i + 0.5) * seg) * Math.PI / 180; const tx = cx + R * 0.6 * Math.cos(am); const ty = cy + R * 0.6 * Math.sin(am);
      const label = o.name.length > 14 ? o.name.slice(0, 13) + '…' : o.name;
      svg += '<text x="' + tx.toFixed(1) + '" y="' + (ty + 5).toFixed(1) + '" text-anchor="middle" font-family="Inter, sans-serif" font-size="' + (n > 4 ? 11 : 13) + '" font-weight="700" fill="' + (out ? '#5E554C' : c[1]) + '" transform="rotate(' + ((i + 0.5) * seg > 90 && (i + 0.5) * seg < 270 ? 0 : 0) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) + ')">' + esc(label) + '</text>';
    });
    svg += '<circle cx="135" cy="135" r="18" fill="#fff"/></svg>';
    let title = elim ? 'Knock them out one by one' : 'Spin to pick a winner'; let sub = elim ? 'Last place standing wins' : 'One spin, no take-backs';
    if (w.spinning) { title = 'Spinning…'; sub = ''; }
    else if (w.winner !== null) { title = opts[w.winner].name + ' wins'; sub = ''; }
    else if (w.lastOut !== null) { title = opts[w.lastOut].name + ' is out'; sub = 'Spin again to knock out the next one'; }
    const win = w.winner !== null && !w.spinning ? opts[w.winner] : null;
    const winPlace = win && win.id && FM.placesById[win.id];
    html += '<div class="wheel-box"><svg aria-hidden="true" width="28" height="24" viewBox="0 0 28 24" style="margin-bottom:-8px;position:relative;z-index:2"><path d="M14 24L2 2h24z" fill="#17130F"/></svg>' +
      '<div class="wheel-outer"><div class="wheel-spin" id="wheel" style="transform:rotate(' + w.rot + 'deg)">' + svg + '</div></div>' +
      '<div class="col" style="align-items:center;margin-top:18px;text-align:center;padding:0 24px;min-height:52px" aria-live="polite"><div class="display" style="font-size:22px">' + esc(title) + '</div><div class="small muted">' + esc(sub) + '</div></div></div>' +
      '<div class="pad col gap10" style="margin-bottom:20px"><button class="big-btn" data-act="spin" ' + (w.spinning ? 'disabled' : '') + '>' + (w.winner !== null ? 'Spin again' : elim && w.out.length ? 'Knock out the next one' : 'Spin') + '</button>' +
      (winPlace ? '<a class="big-btn light" href="#/p/' + encodeURIComponent(winPlace.id) + '">Go to ' + esc(winPlace.name) + '</a>' : win ? '<a class="big-btn light" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(win.name + ' near ' + origin().name) + '">Find ' + esc(win.name) + ' on the map</a>' : '') + '</div>';
    return html;
  }
  function spin() {
    const w = FM.wheel; const opts = wheelOptions(); const n = opts.length;
    if (w.spinning || n < 2) return;
    if (w.winner !== null) { w.out = []; w.winner = null; }
    w.lastOut = null;
    const left = opts.map((_, i) => i).filter((i) => !w.out.includes(i));
    const pick = left[Math.floor(Math.random() * left.length)];
    const seg = 360 / n; const centre = (pick + 0.5) * seg;
    const target = (360 - centre) % 360;
    const base = w.rot - (w.rot % 360);
    w.rot = base + 1800 + target + (Math.random() - 0.5) * seg * 0.5;
    w.spinning = true; render();
    setTimeout(() => {
      w.spinning = false;
      if (w.mode === 'spin') w.winner = pick;
      else { w.out.push(pick); w.lastOut = pick; const rem = opts.map((_, i) => i).filter((i) => !w.out.includes(i)); if (rem.length === 1) { w.winner = rem[0]; w.lastOut = null; } }
      if (currentRoute().name === 'wheel') render();
    }, 3100);
  }

  // ---------- sheets ----------
  function openSheet(html) { closeSheet(); const d = document.createElement('div'); d.className = 'sheet-back'; d.id = 'sheet'; d.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' + html + '</div>'; document.body.appendChild(d); const f = d.querySelector('button, input, a'); if (f) f.focus(); }
  function closeSheet() { const s = document.getElementById('sheet'); if (s) s.remove(); }

  function sheetDistance() {
    const opts = [['walk', 10, '10 min walk'], ['drive', 5, '5 min drive'], ['drive', 10, '10 min drive'], ['drive', 15, '15 min drive'], ['drive', 25, '25 min drive'], ['drive', 40, '40 min drive'], ['drive', 999, 'Any distance']];
    openSheet('<div class="display" style="font-size:20px">How far will you go?</div><div class="small muted">Times are from ' + esc(origin().name) + '.</div><div class="opt-grid">' +
      opts.map((o) => '<button class="opt' + (FM.mode === o[0] && FM.radius === o[1] ? ' on' : '') + '" data-act="set-dist" data-mode="' + o[0] + '" data-v="' + o[1] + '">' + o[2] + '</button>').join('') + '</div><button class="big-btn light" data-act="close">Cancel</button>');
  }
  function sheetLocation(msg) {
    openSheet('<div class="display" style="font-size:20px">Where are you?</div>' + (msg ? '<div class="notice warn">' + esc(msg) + '</div>' : '') +
      '<button class="big-btn" data-act="geo">' + I.pin + 'Use my current location</button>' +
      '<form class="col gap8" data-form="loc"><label for="locq" class="small bold">Or type a town, ZIP, hotel or address</label><input id="locq" class="text" placeholder="Paramus, NJ or the Omni Nashville"><button class="big-btn dark" type="submit">Set location</button></form>' +
      '<button class="big-btn light" data-act="close">Cancel</button>');
  }
  function sheetDate() {
    const vibes = [['view', 'Nice view'], ['rooftop', 'Rooftop or balcony'], ['outdoor', 'Outdoor seating'], ['quiet', 'Quiet'], ['liveMusic', 'Live music'], ['reservable', 'Takes reservations']];
    openSheet('<div class="display" style="font-size:20px">Date Night</div><div class="small bold">Budget</div><div class="opt-grid" data-group="budget">' +
      '<button class="opt on" data-act="pick" data-v="cheap">Inexpensive</button><button class="opt" data-act="pick" data-v="fancy">Go big</button></div>' +
      '<div class="small bold">Vibe (pick any)</div><div class="opt-grid" data-group="vibe" data-multi="1">' + vibes.map((v) => '<button class="opt" data-act="pick" data-v="' + v[0] + '">' + v[1] + '</button>').join('') + '</div>' +
      '<label for="dfood" class="small bold">Any food you want? (optional)</label><input id="dfood" class="text" placeholder="Any chicken dish, something cheesy…">' +
      '<button class="big-btn" data-act="date-go">Find date spots</button><button class="big-btn light" data-act="close">Cancel</button>');
  }
  function sheetFilters() {
    const parsed = FM.last && FM.last.parsed; if (!parsed) return;
    const have = new Set(parsed.features.map((f) => f.key));
    const all = [['openNow', 'Open now'], ['late', 'Open late'], ['cheap', 'Inexpensive'], ['fancy', 'Go big'], ['kids', 'Kid-friendly'], ['tvs', 'TVs'], ['drinks', 'Drinks'], ['outdoor', 'Outdoor seating'], ['view', 'Nice view'], ['romantic', 'Date night'], ['reservable', 'Takes reservations']];
    openSheet('<div class="display" style="font-size:20px">Add a filter</div><div class="opt-grid">' + all.map((a) => '<button class="opt' + (have.has(a[0]) ? ' on' : '') + '" data-act="toggle-feat" data-v="' + a[0] + '" data-l="' + esc(a[1]) + '">' + a[1] + '</button>').join('') + '</div>' +
      '<form class="col gap8" data-form="add-item"><label for="additem" class="small bold">Add another food</label><input id="additem" class="text" placeholder="Fried pickles, vanilla latte…"><button class="big-btn dark" type="submit">Add food</button></form><button class="big-btn light" data-act="close">Done</button>');
  }
  function sheetDirections(p) {
    const l = dirLinks(p);
    openSheet('<div class="display" style="font-size:20px">Directions to ' + esc(p.name) + '</div><a class="big-btn" href="' + esc(l.apple) + '" target="_blank" rel="noopener">Apple Maps</a><a class="big-btn dark" href="' + esc(l.google) + '" target="_blank" rel="noopener">Google Maps</a><button class="big-btn light" data-act="close">Cancel</button>');
  }

  async function setLocationFromText(text) {
    if (!FM.live) { sheetLocation('Typed locations work once the Google connection is set up. The demo uses Paramus.'); return; }
    try {
      const o = origin();
      const g = await api('/api/geocode?q=' + encodeURIComponent(text) + '&lat=' + o.lat + '&lng=' + o.lng);
      if (!g || !g.lat) { sheetLocation('Couldn’t find "' + text + '". Try a town and state, like Paramus, NJ.'); return; }
      setOrigin({ name: g.name, lat: g.lat, lng: g.lng });
    } catch (e) { sheetLocation('Couldn’t look that up right now. Try again in a moment.'); }
  }
  function setOrigin(o) { FM.origin = o; save('fm-origin', o); FM.cache = {}; FM.topNear = null; FM.driveMinutes = {}; closeSheet(); route(); }

  // ---------- events ----------
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('[data-form]'); if (!f) return;
    e.preventDefault();
    const kind = f.getAttribute('data-form');
    if (kind === 'search') { const q = f.querySelector('input').value.trim(); if (q) go(searchHash(q)); }
    if (kind === 'loc') { const v = f.querySelector('input').value.trim(); if (v) setLocationFromText(v); }
    if (kind === 'wheel-add') { const v = f.querySelector('input').value.trim(); if (v) { wheelOptions().push({ name: v }); FM.wheel.out = []; FM.wheel.winner = null; render(); const i = document.getElementById('wadd'); if (i) i.focus(); } }
    if (kind === 'add-item') {
      const v = f.querySelector('input').value.trim(); if (!v || !FM.last) return;
      const p = JSON.parse(JSON.stringify(FM.last.parsed)); p.items.push({ name: L.normalize(v) }); closeSheet(); go(searchHash(rebuildQuery(p)));
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.id === 'sheet') { closeSheet(); return; }
    const el = e.target.closest('[data-act]'); if (!el) return;
    const act = el.getAttribute('data-act'); const v = el.getAttribute('data-v'); const i = Number(el.getAttribute('data-i'));
    const parsed = FM.last && FM.last.parsed ? JSON.parse(JSON.stringify(FM.last.parsed)) : null;
    switch (act) {
      case 'close': closeSheet(); break;
      case 'location': sheetLocation(); break;
      case 'distance': sheetDistance(); break;
      case 'filters': sheetFilters(); break;
      case 'date': sheetDate(); break;
      case 'set-dist': FM.mode = el.getAttribute('data-mode'); FM.radius = Number(v); FM.userRadius = FM.radius; save('fm-radius', FM.radius); save('fm-mode', FM.mode); FM.driveMinutes = {}; FM.cache = {}; closeSheet(); go(searchHash(FM.last ? FM.last.q : '', { r: FM.radius, fixed: 1, m: FM.last ? FM.last.special : '' })); break;
      case 'geo':
        if (!navigator.geolocation) { sheetLocation('Location isn’t available on this device. Type a town instead.'); break; }
        el.textContent = 'Finding you…';
        navigator.geolocation.getCurrentPosition((pos) => setOrigin({ name: 'Your location', lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => sheetLocation('Location is blocked. Type a town or ZIP instead.'), { timeout: 10000 });
        break;
      case 'sort': FM.sort = v; if (FM.last && FM.last.data) { FM.last.result = L.rank(FM.last.data.places, FM.last.parsed, { origin: FM.last.data.origin, now: new Date(), radius: FM.radius, mode: FM.mode, sort: v, driveMinutes: FM.live ? FM.driveMinutes : null, minGood: FM.live ? 6 : 3 }); render(); } break;
      case 'rm-item': parsed.items.splice(i, 1); go(searchHash(rebuildQuery(parsed))); break;
      case 'rm-type': parsed.types.splice(i, 1); go(searchHash(rebuildQuery(parsed))); break;
      case 'rm-feat': parsed.features.splice(i, 1); go(searchHash(rebuildQuery(parsed), FM.last.special ? { m: FM.last.special } : {})); break;
      case 'rm-anchor': parsed.anchor = null; go(searchHash(rebuildQuery(parsed))); break;
      case 'toggle-feat': {
        const k = v; const idx = parsed.features.findIndex((f) => f.key === k);
        if (idx >= 0) parsed.features.splice(idx, 1); else parsed.features.push({ key: k, label: el.getAttribute('data-l') });
        closeSheet(); go(searchHash(rebuildQuery(parsed))); break;
      }
      case 'retry': route(); break;
      case 'toggle-others': FM.ui.showOthers = !FM.ui.showOthers; render(); break;
      case 'toggle-ruled': FM.ui.showRuled = !FM.ui.showRuled; render(); break;
      case 'cmp': {
        const id = el.getAttribute('data-id'); const at = FM.compare.indexOf(id);
        if (at >= 0) FM.compare.splice(at, 1);
        else { if (FM.compare.length >= 3) FM.compare.shift(); FM.compare.push(id); }
        save('fm-compare', FM.compare); FM.wheel.options = null; const y = window.scrollY; render(); window.scrollTo(0, y); break;
      }
      case 'cmp-clear': FM.compare = []; save('fm-compare', []); FM.wheel.options = null; render(); break;
      case 'cmp-mode': FM.ui.cmpMode = v; render(); break;
      case 'lens': FM.ui.lens = v; render(); break;
      case 'cmp-wheel': FM.wheel.options = null; FM.wheel.out = []; FM.wheel.winner = null; go('#/w'); break;
      case 'wheel-mode': FM.wheel.mode = v; FM.wheel.out = []; FM.wheel.winner = null; FM.wheel.lastOut = null; render(); break;
      case 'wheel-rm': wheelOptions().splice(i, 1); FM.wheel.out = []; FM.wheel.winner = null; FM.wheel.lastOut = null; render(); break;
      case 'spin': spin(); break;
      case 'directions': { const p = FM.placesById[el.getAttribute('data-id')]; if (p) sheetDirections(p); break; }
      case 'share': {
        const p = FM.placesById[el.getAttribute('data-id')]; if (!p) break;
        const url = dirLinks(p).googlePlace; const text = p.name + ' on Food Mania';
        if (navigator.share) navigator.share({ title: p.name, text: text, url: url }).catch(() => {});
        else if (navigator.clipboard) { navigator.clipboard.writeText(url); el.lastChild.textContent = 'Copied'; }
        break;
      }
      case 'pick': {
        const group = el.parentElement; const multi = group.getAttribute('data-multi');
        if (!multi) group.querySelectorAll('.opt').forEach((b) => b.classList.remove('on'));
        el.classList.toggle('on', multi ? !el.classList.contains('on') : true); break;
      }
      case 'date-go': {
        const sheet = document.getElementById('sheet');
        const budget = sheet.querySelector('[data-group="budget"] .on'); const vibes = [...sheet.querySelectorAll('[data-group="vibe"] .on')].map((b) => FEATURE_PHRASE[b.getAttribute('data-v')]);
        const food = sheet.querySelector('#dfood').value.trim();
        const q = [food, 'date night', budget ? budget.getAttribute('data-v') : '', vibes.join(' ')].filter(Boolean).join(' ');
        closeSheet(); go(searchHash(q)); break;
      }
      case 'cal': {
        const p = FM.placesById[el.getAttribute('data-id')]; const m = p && p.menu[i]; if (!m || !FM.live) { el.textContent = 'Needs live mode'; break; }
        el.textContent = '…';
        api('/api/calories?q=' + encodeURIComponent(p.name + ' ' + m.name)).then((d) => { m.calories = d.calories; el.textContent = d.calories ? d.calories + ' cal' : 'Not found'; }).catch(() => { el.textContent = 'Not found'; });
        break;
      }
      default: break;
    }
  });

  init();
})();
