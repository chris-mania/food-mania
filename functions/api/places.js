import { json, bad, num, googleTextSearch, normalizeGoogle, kmBetween, similarName } from '../../lib/fm.js';
import { ensureSchema, cellsFor, box, missingCells, markCells, placesInBox, menusFor, upsertStatements, useBudget, budgetLeft, DAY_MS } from '../../lib/db.js';
import { overpassBox } from '../../lib/osm.js';
import { CHAIN_MENUS, chainKey } from '../../lib/chains.js';
import { readAndSave } from '../../lib/menu.js';

// The main search. Free layer: every place from OpenStreetMap, saved menus, memory.
// Bonus layer: Google ratings and photos, used only for things not already saved, under a daily cap.
export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const db = env.DB;
  let body; try { body = await request.json(); } catch (e) { return bad('Bad request'); }
  const lat = num(body.lat, -90, 90); const lng = num(body.lng, -180, 180);
  if (lat === null || lng === null) return bad('Missing location');
  const radiusKm = Math.min(num(body.radiusKm, 1, 40) || 12, 40);
  const queries = (Array.isArray(body.queries) ? body.queries : []).map((q) => String(q).trim().slice(0, 80)).filter(Boolean).slice(0, 5);
  const words = (Array.isArray(body.words) ? body.words : []).map((w) => String(w).toLowerCase()).slice(0, 12);
  const notes = [];
  let googleLimited = false;

  if (!db) return bad('The memory database is not connected', 503);
  await ensureSchema(db);

  // 1) Load every food place in the area from OpenStreetMap (once every 60 days per area)
  const loadKm = Math.min(radiusKm, 15);
  const cells = cellsFor(lat, lng, loadKm);
  const missing = await missingCells(db, cells, 60);
  if (missing.length) {
    try {
      const b = box(lat, lng, loadKm);
      const osm = await overpassBox(b.s, b.w, b.n, b.e);
      const existing = await placesInBox(db, b, 5000);
      const byOsm = new Map(existing.filter((p) => p.osmId).map((p) => [p.osmId, p]));
      const fresh = osm.map((p) => {
        const old = byOsm.get(p.osmId);
        if (!old) return p;
        // keep Google data already learned for this place
        return Object.assign({}, p, pick(old, ['sources', 'reviews', 'photos', 'priceLevel', 'priceRange', 'googleMapsUri', 'googleId', 'description']), { id: old.id, googleAt: old.googleAt, hours: old.googleAt ? old.hours : p.hours, website: p.website || old.website });
      });
      for (let i = 0; i < fresh.length; i += 80) await db.batch(upsertStatements(db, fresh.slice(i, i + 80), (p) => chainKey(p.brand || p.name)));
      await markCells(db, missing);
    } catch (e) {
      notes.push('The free map service was busy, so some places may be missing this time.');
    }
  }

  // 2) Google, only for searches not done here in the last 30 days, under the daily cap
  if (env.GOOGLE_PLACES_KEY && queries.length) {
    const cap = Number(env.GOOGLE_DAILY_CAP || 25);
    const cell = Math.round(lat / 0.05) + '_' + Math.round(lng / 0.05);
    for (const q of queries) {
      const key = q.toLowerCase() + '|' + cell;
      const seen = await db.prepare('SELECT at FROM gq WHERE key = ?').bind(key).first();
      if (seen && Date.now() - seen.at < 30 * DAY_MS) continue;
      if (!(await useBudget(db, 'google-search', cap))) { googleLimited = true; break; }
      try {
        const res = await googleTextSearch(env, { textQuery: q, pageSize: 20, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusKm * 1000, 50000) } } });
        const gplaces = (res.places || []).map(normalizeGoogle).filter((p) => !p.closedPermanently);
        await mergeGoogle(db, gplaces);
        await db.prepare('INSERT INTO gq (key, at) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET at = excluded.at').bind(key, Date.now()).run();
      } catch (e) {
        if (e.status === 429 || e.status === 403) { googleLimited = true; break; }
      }
    }
  }
  if (googleLimited) notes.push('Ratings for brand-new places are paused until tomorrow. Saved ratings still show, and every place links to its reviews.');

  // 3) Everything in range from memory, with saved menus and chain menus
  const all = (await placesInBox(db, box(lat, lng, radiusKm), 1500)).filter((p) => !p.closedPermanently && kmBetween({ lat, lng }, p) <= radiusKm * 1.05);
  const menus = await menusFor(db, all.filter((p) => p.menuStatus === 'ok').map((p) => p.id));
  all.forEach((p) => {
    const chain = chainKey(p.brand || p.name);
    p.chain = !!chain;
    if (menus[p.id] && menus[p.id].length) { p.menu = menus[p.id]; p.menuComplete = menus[p.id].length >= 12; p.menuSource = 'website'; }
    else if (chain) { p.menu = CHAIN_MENUS[chain].map((n) => ({ name: n, price: 0 })); p.menuComplete = true; p.chainMenu = true; p.menuSource = 'chain'; }
    else p.menu = [];
    if (p.reviews) p.reviews = p.reviews.slice(0, 5).map((r) => ({ rating: r.rating, text: String(r.text || '').slice(0, 500) }));
  });

  // 4) Read a few unread menus in the background, most relevant first
  const relevant = (p) => words.reduce((s, w) => s + ((p.name + ' ' + (p.types || []).join(' ') + ' ' + (p.cuisine || '')).toLowerCase().includes(w) ? 1 : 0), 0);
  const toRead = all.filter((p) => p.website && !p.chain && (!p.menuStatus || (p.menuAt && Date.now() - p.menuAt > 90 * DAY_MS && p.menuStatus !== 'blocked')))
    .sort((a, b) => relevant(b) - relevant(a) || ((b.sources && b.sources.google ? b.sources.google.count : 0) - (a.sources && a.sources.google ? a.sources.google.count : 0)))
    .slice(0, 3);
  if (toRead.length) ctx.waitUntil(Promise.all(toRead.map((p) => readAndSave(env, p))));

  const aiLeft = await budgetLeft(db, 'ai-menu', Number(env.AI_MENU_DAILY || 80));
  return json({ places: all, notes, googleLimited, readingMenus: toRead.length, aiLeft });
}

function pick(o, keys) { const r = {}; keys.forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; }); return r; }

// Attach Google's data to the matching saved place (same Google ID, or same name within 150 m), or add it new.
async function mergeGoogle(db, gplaces) {
  if (!gplaces.length) return;
  const lats = gplaces.map((p) => p.lat); const lngs = gplaces.map((p) => p.lng);
  const nearby = await placesInBox(db, { s: Math.min(...lats) - 0.01, n: Math.max(...lats) + 0.01, w: Math.min(...lngs) - 0.01, e: Math.max(...lngs) + 0.01 }, 5000);
  const now = Date.now();
  const merged = gplaces.map((g) => {
    const match = nearby.find((p) => p.googleId === g.googleId) ||
      nearby.filter((p) => !p.googleId && kmBetween(p, g) < 0.15 && similarName(p.name, g.name)).sort((a, b) => kmBetween(a, g) - kmBetween(b, g))[0];
    const base = match || {};
    return Object.assign({}, base, g, {
      id: match ? match.id : g.id, osmId: base.osmId, googleAt: now,
      website: g.website || base.website || '', types: [...new Set([...(base.types || []), ...(g.types || [])])],
      hours: g.hours && g.hours.length ? g.hours : base.hours || [], description: base.description || ''
    });
  });
  await db.batch(upsertStatements(db, merged, (p) => chainKey(p.name)));
}
