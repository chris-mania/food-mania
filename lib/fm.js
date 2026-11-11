// Shared helpers for Food Mania's Cloudflare Pages Functions.

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra)
  });
}

export function bad(msg, status = 400) { return json({ error: msg }, status); }

// Edge cache so repeat lookups don't spend API quota.
export async function cached(key, ttlSeconds, fn) {
  const cache = caches.default;
  const url = 'https://fm-cache.internal/' + encodeURIComponent(key);
  const hit = await cache.match(url);
  if (hit) return hit.json();
  const data = await fn();
  if (data !== undefined && data !== null) {
    await cache.put(url, new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=' + ttlSeconds } }));
  }
  return data;
}

export function num(v, lo, hi) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < lo || n > hi) return null;
  return n;
}

export async function fetchJson(url, init, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, Object.assign({ signal: ctrl.signal }, init || {}));
    if (!res.ok) { const e = new Error('Upstream ' + res.status); e.status = res.status; throw e; }
    return await res.json();
  } finally { clearTimeout(t); }
}

export function kmBetween(a, b) {
  const R = 6371; const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r; const dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function similarName(a, b) {
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !['the', 'and', 'restaurant', 'bar', 'grill', 'cafe', 'nj'].includes(w));
  const A = new Set(clean(a)); const B = clean(b);
  if (!A.size || !B.length) return false;
  const hit = B.filter((w) => A.has(w)).length;
  return hit / Math.min(A.size, B.length) >= 0.5;
}

// ---------- Google Places (New) ----------
const PRICE = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };
const TINTS = ['#EED7C8', '#E5DCC5', '#DCE4D3', '#E6D6E4', '#E3D3C3', '#F2DDE3', '#EADBC8', '#D9DEE6'];

export const PLACE_FIELDS = ['id', 'displayName', 'formattedAddress', 'shortFormattedAddress', 'location', 'rating', 'userRatingCount', 'priceLevel', 'priceRange',
  'regularOpeningHours', 'businessStatus', 'primaryTypeDisplayName', 'primaryType', 'types', 'photos', 'reviews', 'servesBeer', 'servesCocktails',
  'servesWine', 'goodForWatchingSports', 'goodForChildren', 'menuForChildren', 'outdoorSeating', 'liveMusic', 'reservable', 'nationalPhoneNumber',
  'internationalPhoneNumber', 'websiteUri', 'googleMapsUri'].map((f) => 'places.' + f).join(',');

function hoursFrom(roh) {
  if (!roh || !Array.isArray(roh.periods) || !roh.periods.length) return [];
  const periods = roh.periods;
  if (periods.length === 1 && periods[0].open && !periods[0].close) return [0, 1, 2, 3, 4, 5, 6].map(() => [0, 1440]);
  const days = [null, null, null, null, null, null, null];
  periods.forEach((p) => {
    if (!p.open) return;
    const d = p.open.day; const o = (p.open.hour || 0) * 60 + (p.open.minute || 0);
    let c = 1440;
    if (p.close) {
      const span = ((p.close.day - d + 7) % 7);
      c = span * 1440 + (p.close.hour || 0) * 60 + (p.close.minute || 0);
      if (c <= o) c = o + 1440;
    }
    days[d] = days[d] ? [Math.min(days[d][0], o), Math.max(days[d][1], c)] : [o, c];
  });
  return days;
}

function typeWords(types) {
  const out = new Set();
  (types || []).forEach((t) => {
    const w = t.replace(/_restaurant$/, '').replace(/_shop$/, ' shop').replace(/_/g, ' ');
    out.add(w);
    if (t === 'ice_cream_shop') out.add('ice cream');
    if (t === 'coffee_shop') out.add('cafe');
    if (t === 'fast_food_restaurant') out.add('fast food');
    if (t === 'hamburger_restaurant') out.add('burger');
    if (t === 'japanese_restaurant') out.add('hibachi');
  });
  return [...out];
}

export function normalizeGoogle(p, i) {
  const name = (p.displayName && p.displayName.text) || 'Unnamed';
  const types = typeWords(p.types);
  const cuisine = (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || (types[0] ? types[0][0].toUpperCase() + types[0].slice(1) : '');
  if (/sports bar/i.test(name) || p.goodForWatchingSports && types.includes('bar')) types.push('sports bar');
  const pr = p.priceRange;
  return {
    id: 'g-' + p.id, googleId: p.id, name, cuisine: cuisine.replace(/ Restaurant$/, ''), types,
    lat: p.location ? p.location.latitude : 0, lng: p.location ? p.location.longitude : 0,
    address: p.shortFormattedAddress || p.formattedAddress || '', phone: p.internationalPhoneNumber || p.nationalPhoneNumber || '',
    website: p.websiteUri || '', googleMapsUri: p.googleMapsUri || '',
    priceLevel: PRICE[p.priceLevel] || 0,
    priceRange: pr && pr.startPrice && pr.endPrice ? [Number(pr.startPrice.units || 0), Number(pr.endPrice.units || 0)] : null,
    sources: p.rating ? { google: { rating: p.rating, count: p.userRatingCount || 0 } } : {},
    hours: hoursFrom(p.regularOpeningHours),
    features: {
      tvs: p.goodForWatchingSports, beer: p.servesBeer, cocktails: p.servesCocktails, wine: p.servesWine,
      kids: p.goodForChildren || p.menuForChildren, outdoor: p.outdoorSeating, liveMusic: p.liveMusic, reservable: p.reservable
    },
    menu: [], menuComplete: false,
    reviews: (p.reviews || []).map((r) => ({ rating: r.rating, text: (r.text && r.text.text) || (r.originalText && r.originalText.text) || '', date: r.publishTime })),
    photos: (p.photos || []).slice(0, 3).map((ph) => '/api/photo?name=' + encodeURIComponent(ph.name)),
    closedPermanently: p.businessStatus === 'CLOSED_PERMANENTLY',
    tint: TINTS[(i || 0) % TINTS.length]
  };
}

export async function googleTextSearch(env, body, fields) {
  return fetchJson('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': fields || PLACE_FIELDS },
    body: JSON.stringify(body)
  }, 10000);
}
