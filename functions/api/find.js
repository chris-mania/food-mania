import { json, bad, num, googleTextSearch, normalizeGoogle, kmBetween } from '../../lib/fm.js';
import { ensureSchema, box, upsertStatements, useBudget, placesInBox } from '../../lib/db.js';
import { chainKey, CHAIN_MENUS } from '../../lib/chains.js';

// Find a place by name (for Compare). Memory first, which is free; Google only if nothing is saved.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const q = (u.searchParams.get('q') || '').trim().slice(0, 80);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  if (!q || lat === null || lng === null) return bad('Missing name or location');
  if (!env.DB) return bad('No database', 503);
  await ensureSchema(env.DB);
  const b = box(lat, lng, 40);
  const like = '%' + q.toLowerCase().replace(/[%_]/g, '') + '%';
  const rows = await env.DB.prepare('SELECT id FROM places WHERE lower(name) LIKE ? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? LIMIT 40').bind(like, b.s, b.n, b.w, b.e).all();
  let found = [];
  if ((rows.results || []).length) {
    const ids = new Set(rows.results.map((r) => r.id));
    found = (await placesInBox(env.DB, b, 5000)).filter((p) => ids.has(p.id));
  } else if (env.GOOGLE_PLACES_KEY && await useBudget(env.DB, 'google-search', Number(env.GOOGLE_DAILY_CAP || 25))) {
    try {
      const res = await googleTextSearch(env, { textQuery: q, pageSize: 5, locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 40000 } } });
      found = (res.places || []).map(normalizeGoogle).map((p) => Object.assign(p, { googleAt: Date.now() }));
      if (found.length) await env.DB.batch(upsertStatements(env.DB, found, (p) => chainKey(p.name)));
    } catch (e) { /* nothing found */ }
  }
  found.forEach((p) => {
    const c = chainKey(p.brand || p.name);
    if (c) { p.chain = true; p.chainMenu = true; p.menuComplete = true; p.menu = CHAIN_MENUS[c].map((n) => ({ name: n, price: 0 })); } else p.menu = p.menu || [];
  });
  found.sort((a, b2) => kmBetween({ lat, lng }, a) - kmBetween({ lat, lng }, b2));
  return json({ places: found.slice(0, 6) });
}
