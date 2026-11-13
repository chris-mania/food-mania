import { json, bad, num, kmBetween, similarName } from '../../lib/fm.js';
import { ensureSchema, missingCells, markCells, placesInBox, upsertStatements } from '../../lib/db.js';
import { notableNear } from '../../lib/osm.js';
import { chainKey } from '../../lib/chains.js';

// Wikidata extras for an area (Michelin, famous spots, opening years, photos), once a month per area.
// Runs after results show, so a slow Wikidata never holds up a search.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  if (lat === null || lng === null) return bad('Missing location');
  if (!env.DB) return json({ wiki: {} });
  await ensureSchema(env.DB);
  const key = 'wd_' + Math.floor(lat / 0.1) + '_' + Math.floor(lng / 0.1);
  const box = { s: lat - 0.12, n: lat + 0.12, w: lng - 0.16, e: lng + 0.16 };
  if ((await missingCells(env.DB, [key], 30)).length) {
    try {
      const found = await notableNear(lat, lng, 12);
      const places = await placesInBox(env.DB, box, 3000);
      const changed = [];
      found.forEach((m) => {
        const same = places.find((p) => kmBetween(p, m) < 0.25 && similarName(p.name, m.name));
        if (same) { same.wiki = m.wiki; changed.push(same); }
      });
      if (changed.length) await env.DB.batch(upsertStatements(env.DB, changed, (p) => chainKey(p.brand || p.name)));
      await markCells(env.DB, [key]);
    } catch (e) { return json({ wiki: {} }); }
  }
  const rows = await env.DB.prepare("SELECT id, data FROM places WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND data LIKE '%\"wiki\"%' LIMIT 200").bind(box.s, box.n, box.w, box.e).all();
  const wiki = {};
  (rows.results || []).forEach((r) => { try { const d = JSON.parse(r.data); if (d.wiki) wiki[r.id] = d.wiki; } catch (e) { /* skip */ } });
  return json({ wiki });
}
