// Loads every food place in a neighborhood from OpenStreetMap, in the browser (free, no key).
// Doing it here keeps the server's work tiny, which Cloudflare's free plan needs.
(function (root) {
  'use strict';
const DAY = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };
const ORDER = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];

function toMin(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function daysFrom(spec) {
  const out = new Set();
  spec.toLowerCase().split(',').forEach((part) => {
    const p = part.trim().slice(0, 5);
    const r = /^([a-z]{2})(?:-([a-z]{2}))?$/.exec(p);
    if (!r || !(r[1] in DAY)) return;
    if (!r[2]) { out.add(DAY[r[1]]); return; }
    let i = ORDER.indexOf(r[1]); const end = ORDER.indexOf(r[2]);
    if (i < 0 || end < 0) return;
    for (let n = 0; n < 7; n++) { out.add(DAY[ORDER[i]]); if (i === end) break; i = (i + 1) % 7; }
  });
  return [...out];
}

// "Mo-Fr 11:00-22:00; Sa,Su 12:00-23:00" -> hours[0..6] = [openMin, closeMin] (close may pass 1440)
function parseOpeningHours(s) {
  if (!s || typeof s !== 'string') return [];
  const text = s.trim();
  if (/^24\/7$/.test(text)) return [0, 1, 2, 3, 4, 5, 6].map(() => [0, 1440]);
  const days = [null, null, null, null, null, null, null];
  let understood = false;
  text.split(';').forEach((rule) => {
    const r = rule.trim();
    if (!r || /\b(PH|SH|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|week)\b/i.test(r)) return;
    const m = /^([A-Za-z,\- ]+?)?\s*((?:\d{1,2}:\d{2}-\d{1,2}:\d{2}\+?,?\s*)+|off|closed)$/i.exec(r);
    if (!m) return;
    const ds = m[1] ? daysFrom(m[1].replace(/\s/g, '')) : [0, 1, 2, 3, 4, 5, 6];
    if (!ds.length) return;
    understood = true;
    if (/^(off|closed)$/i.test(m[2])) { ds.forEach((d) => { days[d] = null; }); return; }
    let lo = null; let hi = null;
    m[2].split(',').forEach((span) => {
      const [a, b] = span.replace('+', '').split('-');
      const o = toMin(a || ''); let c = toMin(b || '');
      if (o === null || c === null) return;
      if (c <= o) c += 1440;
      lo = lo === null ? o : Math.min(lo, o); hi = hi === null ? c : Math.max(hi, c);
    });
    if (lo !== null) ds.forEach((d) => { days[d] = [lo, hi]; });
  });
  return understood ? days : [];
}

const AMENITY = '^(restaurant|fast_food|cafe|bar|pub|ice_cream|food_court|biergarten)$';
const SHOP = '^(bakery|coffee|pastry|confectionery|deli|tea|donut)$';

// All food places in a box. Overpass is free; one call loads a whole area.
async function overpassBox(s, w, n, e) {
  const bb = [s, w, n, e].map((x) => x.toFixed(5)).join(',');
  const q = '[out:json][timeout:20];(nwr["amenity"~"' + AMENITY + '"]["name"](' + bb + ');nwr["shop"~"' + SHOP + '"]["name"](' + bb + '););out center tags;';
  const hosts = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  let lastErr = null;
  for (const h of hosts) {
    try {
      const ctrl = new AbortController(); const tm = setTimeout(() => ctrl.abort(), 22000);
      const r = await fetch(h, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': 'FoodMania/1.1 (food search app)' }, signal: ctrl.signal }).finally(() => clearTimeout(tm));
      if (!r.ok) { lastErr = new Error('overpass ' + r.status); continue; }
      const d = await r.json();
      return (d.elements || []).map(osmToPlace).filter(Boolean);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('overpass');
}

function titleCase(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; }

function osmToPlace(e) {
  const t = e.tags || {};
  const lat = e.lat || (e.center && e.center.lat); const lng = e.lon || (e.center && e.center.lon);
  if (!t.name || !lat) return null;
  const kind = t.amenity || (t.shop ? t.shop : '');
  const cuisines = String(t.cuisine || '').split(/[;,]/).map((c) => c.trim().replace(/_/g, ' ')).filter(Boolean);
  const types = new Set();
  const kindWord = { fast_food: 'fast food', ice_cream: 'ice cream', food_court: 'food court', coffee: 'cafe', pastry: 'bakery', donut: 'bakery', confectionery: 'dessert', biergarten: 'bar' }[kind] || kind.replace(/_/g, ' ');
  if (kindWord) types.add(kindWord);
  cuisines.forEach((c) => types.add(c));
  if (cuisines.includes('coffee shop')) types.add('cafe');
  if (/sports/i.test(t.name) || t.sport) types.add('sports bar');
  const cuisine = cuisines[0] ? titleCase(cuisines[0]) : titleCase(kindWord);
  const yes = (v) => (v === 'yes' ? true : v === 'no' ? false : undefined);
  return {
    id: 'osm-' + e.type[0] + e.id, osmId: e.type + '/' + e.id, name: t.name, cuisine, types: [...types],
    lat, lng,
    address: [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:city']].filter(Boolean).join(', '),
    phone: t.phone || t['contact:phone'] || '', website: t.website || t['contact:website'] || t.url || '',
    brand: t.brand || '', hours: parseOpeningHours(t.opening_hours), hoursText: t.opening_hours || '',
    features: {
      outdoor: yes(t.outdoor_seating), takeaway: yes(t.takeaway) || (t.takeaway === 'only' ? true : undefined), delivery: yes(t.delivery),
      driveThru: yes(t.drive_through), wheelchair: t.wheelchair === 'yes' ? true : t.wheelchair === 'no' ? false : undefined,
      vegan: /^(yes|only)$/.test(t['diet:vegan'] || '') ? true : t['diet:vegan'] === 'no' ? false : undefined,
      vegetarian: /^(yes|only)$/.test(t['diet:vegetarian'] || '') ? true : t['diet:vegetarian'] === 'no' ? false : undefined,
      glutenFree: /^(yes|only)$/.test(t['diet:gluten_free'] || '') ? true : t['diet:gluten_free'] === 'no' ? false : undefined,
      tvs: yes(t.television) || undefined, beer: kind === 'bar' || kind === 'pub' ? true : undefined
    },
    description: t.description || ''
  };
}


  root.FMOSM = { overpassBox: overpassBox, parseOpeningHours: parseOpeningHours };
})(window);
