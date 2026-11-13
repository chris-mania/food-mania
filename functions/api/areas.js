import { json, bad, num, kmBetween, similarName } from '../../lib/fm.js';
import { ensureSchema, cellsFor, cellBox, cellCenterDist, missingCells, markCells, insertNewStatements, placesInBox, DAY_MS } from '../../lib/db.js';
import { breweriesNear } from '../../lib/osm.js';
import { chainKey } from '../../lib/chains.js';

// GET: which neighborhoods near a point still need loading (nearest first).
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  const km = Math.min(num(u.searchParams.get('km'), 1, 15) || 6, 15);
  if (lat === null || lng === null) return bad('Missing location');
  if (!env.DB) return bad('No database', 503);
  await ensureSchema(env.DB);
  const cells = cellsFor(lat, lng, km).sort((a, b) => cellCenterDist(a, lat, lng) - cellCenterDist(b, lat, lng));
  const missing = await missingCells(env.DB, cells, 60);
  return json({ missing: missing.map((c) => ({ cell: c, box: cellBox(c) })) });
}

// POST: the app sends the places it loaded from OpenStreetMap for one neighborhood; save the new ones.
const S = (v, n) => String(v == null ? '' : v).slice(0, n);
export async function onRequestPost(ctx) {
  const { request, env } = ctx;
  if (!env.DB) return bad('No database', 503);
  let body; try { body = await request.json(); } catch (e) { return bad('Bad request'); }
  const cell = S(body.cell, 20);
  if (!/^-?\d+_-?\d+$/.test(cell)) return bad('Bad area');
  const b = cellBox(cell);
  const list = (Array.isArray(body.places) ? body.places : []).slice(0, 2000);
  const clean = [];
  for (const p of list) {
    if (!p || !/^osm-[nwr]\d{1,15}$/.test(String(p.id)) || !p.name) continue;
    const lat = Number(p.lat); const lng = Number(p.lng);
    if (!(lat >= b.s - 0.01 && lat <= b.n + 0.01 && lng >= b.w - 0.01 && lng <= b.e + 0.01)) continue;
    const f = p.features || {}; const feats = {};
    ['outdoor', 'takeaway', 'delivery', 'driveThru', 'wheelchair', 'vegan', 'vegetarian', 'glutenFree', 'tvs', 'beer'].forEach((k) => { if (f[k] === true || f[k] === false) feats[k] = f[k]; });
    const hours = Array.isArray(p.hours) && p.hours.length === 7 ? p.hours.map((h) => (Array.isArray(h) && h.length === 2 && h.every((x) => Number.isFinite(x) && x >= 0 && x <= 2880) ? [h[0], h[1]] : null)) : [];
    const site = S(p.website, 200);
    clean.push({
      id: p.id, osmId: S(p.osmId, 30), name: S(p.name, 120), cuisine: S(p.cuisine, 40), types: (Array.isArray(p.types) ? p.types : []).slice(0, 6).map((t) => S(t, 30)),
      lat, lng, address: S(p.address, 120), phone: S(p.phone, 30), website: /^https?:\/\//i.test(site) || /^[\w.-]+\.[a-z]{2,}/i.test(site) ? site : '',
      brand: S(p.brand, 60), hours, features: feats, description: S(p.description, 300)
    });
  }
  await ensureSchema(env.DB);
  for (let i = 0; i < clean.length; i += 80) await env.DB.batch(insertNewStatements(env.DB, clean.slice(i, i + 80), (p) => chainKey(p.brand || p.name)));
  await markCells(env.DB, [cell]);
  // breweries for this neighborhood's area, once (small, quick)
  const key = 'brew_' + cell;
  if ((await missingCells(env.DB, [key], 60)).length) {
    ctx.waitUntil((async () => {
      try {
        const c = { lat: (b.s + b.n) / 2, lng: (b.w + b.e) / 2 };
        const brews = (await breweriesNear(c.lat, c.lng)).filter((x) => x.lat >= b.s && x.lat <= b.n && x.lng >= b.w && x.lng <= b.e);
        if (brews.length) {
          const near = await placesInBox(env.DB, { s: b.s - 0.01, n: b.n + 0.01, w: b.w - 0.01, e: b.e + 0.01 }, 2000);
          const add = brews.filter((x) => !near.some((p) => kmBetween(p, x) < 0.15 && similarName(p.name, x.name)));
          if (add.length) await env.DB.batch(insertNewStatements(env.DB, add, () => null));
        }
        await markCells(env.DB, [key]);
      } catch (e) { /* optional */ }
    })());
  }
  return json({ saved: clean.length });
}
