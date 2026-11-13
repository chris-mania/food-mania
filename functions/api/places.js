import { json, bad, num, googleTextSearch, normalizeGoogle, kmBetween, similarName } from '../../lib/fm.js';
import { ensureSchema, cellsFor, missingCells, placesInBox, placesNear, menusFor, upsertStatements, useBudget, DAY_MS } from '../../lib/db.js';
import { CHAIN_MENUS, chainKey } from '../../lib/chains.js';
import { readAndSave } from '../../lib/menu.js';

// The main search. Free layer: every place from OpenStreetMap, saved menus, memory.
// Bonus layer: Google ratings and photos, only for things not already saved, under a daily cap.
// Each request does a small amount of work (Cloudflare's free plan allows little processing per request),
// so a new area loads a couple of neighborhoods at a time and the app asks again for the rest.
export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  const db = env.DB;
  let body; try { body = await request.json(); } catch (e) { return bad('Bad request'); }
  const lat = num(body.lat, -90, 90); const lng = num(body.lng, -180, 180);
  if (lat === null || lng === null) return bad('Missing location');
  const radiusKm = Math.min(num(body.radiusKm, 1, 40) || 12, 40);
  const queries = (Array.isArray(body.queries) ? body.queries : []).map((q) => String(q).trim().slice(0, 80)).filter(Boolean).slice(0, 4);
  const words = (Array.isArray(body.words) ? body.words : []).map((w) => String(w).toLowerCase().slice(0, 30)).slice(0, 8);
  const notes = [];
  let googleLimited = false;

  if (!db) return bad('The memory database is not connected', 503);
  await ensureSchema(db);

  // 1) Neighborhood loading happens in the app (see /api/areas); here we only report what's still missing
  const missing = await missingCells(db, cellsFor(lat, lng, Math.min(radiusKm, 6)), 60);
  const stillMissing = missing.length; const loadFailed = false;

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
  if (googleLimited) notes.push('Google ratings for brand-new places are paused until tomorrow (free daily limit). Saved ratings still show, and every place links to its reviews.');

  // 3) Nearest places from memory (plus any matching the search words), with saved menus and chain menus
  const all = (await placesNear(db, lat, lng, radiusKm, words, 250)).filter((p) => !p.closedPermanently);
  const menus = await menusFor(db, all.filter((p) => p.menuStatus === 'ok').map((p) => p.id));
  all.forEach((p) => {
    const chain = chainKey(p.brand || p.name);
    p.chain = !!chain || !!p.brand;
    if (menus[p.id] && menus[p.id].length) { p.menu = menus[p.id]; p.menuComplete = menus[p.id].length >= 12; p.menuSource = 'website'; }
    else if (chain) { p.menu = CHAIN_MENUS[chain].map((n) => ({ name: n, price: 0 })); p.menuComplete = true; p.chainMenu = true; p.menuSource = 'chain'; }
    else p.menu = [];
    if (p.reviews) p.reviews = p.reviews.slice(0, 5).map((r) => ({ rating: r.rating, text: String(r.text || '').slice(0, 400) }));
  });

  // 4) Menus are read by the app one place at a time through /api/menu (keeps this request small)
  const toRead = [];
  return json({ places: all, notes, googleLimited, readingMenus: toRead.length, moreToLoad: stillMissing, loadFailed });
}

function pick(o, keys) { const r = {}; keys.forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; }); return r; }

// Attach Google's data to the matching saved place (same Google ID, or same name within 150 m), or add it new.
async function mergeGoogle(db, gplaces) {
  if (!gplaces.length) return;
  const lats = gplaces.map((p) => p.lat); const lngs = gplaces.map((p) => p.lng);
  const nearby = await placesInBox(db, { s: Math.min(...lats) - 0.005, n: Math.max(...lats) + 0.005, w: Math.min(...lngs) - 0.005, e: Math.max(...lngs) + 0.005 }, 3000);
  const now = Date.now();
  const merged = gplaces.map((g) => {
    const match = nearby.find((p) => p.googleId === g.googleId) ||
      nearby.filter((p) => !p.googleId && kmBetween(p, g) < 0.15 && similarName(p.name, g.name)).sort((a, b) => kmBetween(a, g) - kmBetween(b, g))[0];
    const base = match || {};
    return Object.assign({}, base, g, {
      id: match ? match.id : g.id, osmId: base.osmId, googleAt: now,
      website: g.website || base.website || '', types: [...new Set([...(base.types || []), ...(g.types || [])])],
      hours: g.hours && g.hours.length ? g.hours : base.hours || [], description: base.description || '', wiki: base.wiki, webPhoto: base.webPhoto
    });
  });
  await db.batch(upsertStatements(db, merged, (p) => chainKey(p.name)));
}
