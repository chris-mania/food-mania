// Food Mania's memory (Cloudflare D1). Everything learned is saved so repeat searches cost nothing.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS places (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
    osm_id TEXT, google_id TEXT, website TEXT, chain TEXT,
    data TEXT NOT NULL, google_at INTEGER, menu_status TEXT, menu_at INTEGER, updated INTEGER)`,
  'CREATE INDEX IF NOT EXISTS places_lat ON places(lat)',
  'CREATE INDEX IF NOT EXISTS places_google ON places(google_id)',
  'CREATE INDEX IF NOT EXISTS places_osm ON places(osm_id)',
  `CREATE TABLE IF NOT EXISTS menu_items (place_id TEXT NOT NULL, name TEXT NOT NULL, price REAL, source TEXT, PRIMARY KEY (place_id, name))`,
  'CREATE TABLE IF NOT EXISTS areas (cell TEXT PRIMARY KEY, loaded_at INTEGER)',
  'CREATE TABLE IF NOT EXISTS gq (key TEXT PRIMARY KEY, at INTEGER)',
  'CREATE TABLE IF NOT EXISTS usage (day TEXT NOT NULL, service TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, service))'
];

let ready = false;
export async function ensureSchema(db) {
  if (ready || !db) return;
  await db.batch(SCHEMA.map((s) => db.prepare(s)));
  ready = true;
}

export const DAY_MS = 86400000;
export function today() { return new Date().toISOString().slice(0, 10); }

// ---- daily budgets so free amounts are never exceeded ----
export async function useBudget(db, service, cap) {
  if (!db) return true;
  const day = today();
  const row = await db.prepare('SELECT n FROM usage WHERE day = ? AND service = ?').bind(day, service).first();
  if (row && row.n >= cap) return false;
  await db.prepare('INSERT INTO usage (day, service, n) VALUES (?, ?, 1) ON CONFLICT(day, service) DO UPDATE SET n = n + 1').bind(day, service).run();
  return true;
}
export async function budgetLeft(db, service, cap) {
  if (!db) return cap;
  const row = await db.prepare('SELECT n FROM usage WHERE day = ? AND service = ?').bind(today(), service).first();
  return Math.max(0, cap - (row ? row.n : 0));
}

// ---- areas: 0.05-degree cells (about 5 km) ----
export function cellsFor(lat, lng, km) {
  const dLat = km / 111; const dLng = km / (111 * Math.cos(lat * Math.PI / 180));
  const out = [];
  for (let a = Math.floor((lat - dLat) / 0.05); a <= Math.floor((lat + dLat) / 0.05); a++) {
    for (let b = Math.floor((lng - dLng) / 0.05); b <= Math.floor((lng + dLng) / 0.05); b++) out.push(a + '_' + b);
  }
  return out;
}
export function cellBox(cell) {
  const [a, b] = cell.split('_').map(Number);
  return { s: a * 0.05, n: (a + 1) * 0.05, w: b * 0.05, e: (b + 1) * 0.05 };
}
export function cellCenterDist(cell, lat, lng) { const c = cellBox(cell); return Math.hypot((c.s + c.n) / 2 - lat, ((c.w + c.e) / 2 - lng) * Math.cos(lat * Math.PI / 180)); }

// Nearest places first, plus any whose name or details mention the search words. Capped so each request stays light.
export async function placesNear(db, lat, lng, km, words, limit = 350) {
  const b = box(lat, lng, km);
  const k = Math.cos(lat * Math.PI / 180) ** 2;
  const near = await db.prepare('SELECT * FROM places WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? ORDER BY (lat - ?) * (lat - ?) + (lng - ?) * (lng - ?) * ? LIMIT ?')
    .bind(b.s, b.n, b.w, b.e, lat, lat, lng, lng, k, limit).all();
  const rows = near.results || [];
  const have = new Set(rows.map((r) => r.id));
  const ws = (words || []).filter((w) => w && w.length > 2).slice(0, 6);
  if (ws.length) {
    const cond = ws.map(() => '(lower(name) LIKE ? OR lower(data) LIKE ?)').join(' OR ');
    const args = []; ws.forEach((w) => { args.push('%' + w + '%', '%' + w + '%'); });
    const more = await db.prepare('SELECT * FROM places WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND (' + cond + ') LIMIT 150').bind(b.s, b.n, b.w, b.e, ...args).all();
    (more.results || []).forEach((r) => { if (!have.has(r.id)) { rows.push(r); have.add(r.id); } });
  }
  return rows.map(rowToPlace);
}

export function box(lat, lng, km) {
  const dLat = km / 111; const dLng = km / (111 * Math.cos(lat * Math.PI / 180));
  return { s: lat - dLat, n: lat + dLat, w: lng - dLng, e: lng + dLng };
}
export async function missingCells(db, cells, maxAgeDays) {
  if (!db) return cells;
  const since = Date.now() - maxAgeDays * DAY_MS;
  const rows = await db.prepare('SELECT cell FROM areas WHERE loaded_at > ? AND cell IN (' + cells.map(() => '?').join(',') + ')').bind(since, ...cells).all();
  const have = new Set((rows.results || []).map((r) => r.cell));
  return cells.filter((c) => !have.has(c));
}
export async function markCells(db, cells) {
  if (!db || !cells.length) return;
  const now = Date.now();
  await db.batch(cells.map((c) => db.prepare('INSERT INTO areas (cell, loaded_at) VALUES (?, ?) ON CONFLICT(cell) DO UPDATE SET loaded_at = excluded.loaded_at').bind(c, now)));
}

// ---- places ----
function rowToPlace(r) {
  const d = JSON.parse(r.data || '{}');
  return Object.assign(d, { id: r.id, name: r.name, lat: r.lat, lng: r.lng, website: r.website || d.website || '', menuStatus: r.menu_status || null, menuAt: r.menu_at || null, googleAt: r.google_at || null });
}

export async function placesInBox(db, b, limit = 900) {
  const rows = await db.prepare('SELECT * FROM places WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? LIMIT ?').bind(b.s, b.n, b.w, b.e, limit).all();
  return (rows.results || []).map(rowToPlace);
}

export async function getPlace(db, id) {
  const r = await db.prepare('SELECT * FROM places WHERE id = ?').bind(id).first();
  return r ? rowToPlace(r) : null;
}

export async function menusFor(db, ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const rows = await db.prepare('SELECT place_id, name, price, source FROM menu_items WHERE place_id IN (' + chunk.map(() => '?').join(',') + ')').bind(...chunk).all();
    (rows.results || []).forEach((m) => { (out[m.place_id] = out[m.place_id] || []).push({ name: m.name, price: m.price || 0, source: m.source }); });
  }
  return out;
}

const KEEP = ['cuisine', 'types', 'address', 'phone', 'website', 'brand', 'hours', 'hoursText', 'features', 'description', 'sources', 'reviews', 'photos',
  'priceLevel', 'priceRange', 'googleMapsUri', 'googleId', 'osmId', 'tripadvisorUrl', 'closedPermanently', 'webPhoto', 'wiki'];
function pack(p) { const d = {}; KEEP.forEach((k) => { if (p[k] !== undefined) d[k] = p[k]; }); return JSON.stringify(d); }

export function upsertStatements(db, places, chainOf) {
  const now = Date.now();
  return places.map((p) => db.prepare(
    `INSERT INTO places (id, name, lat, lng, osm_id, google_id, website, chain, data, google_at, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lng = excluded.lng, osm_id = COALESCE(excluded.osm_id, places.osm_id),
       google_id = COALESCE(excluded.google_id, places.google_id), website = COALESCE(NULLIF(excluded.website, ''), places.website),
       chain = COALESCE(excluded.chain, places.chain), data = excluded.data, google_at = COALESCE(excluded.google_at, places.google_at), updated = excluded.updated`
  ).bind(p.id, p.name, p.lat, p.lng, p.osmId || null, p.googleId || null, p.website || '', chainOf(p) || null, pack(p), p.googleAt || null, now));
}

export function insertNewStatements(db, places, chainOf) {
  const now = Date.now();
  return places.map((p) => db.prepare('INSERT INTO places (id, name, lat, lng, osm_id, website, chain, data, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind(p.id, p.name, p.lat, p.lng, p.osmId || null, p.website || '', chainOf(p) || null, pack(p), now));
}

export async function saveMenu(db, placeId, items, status, source) {
  const stmts = [db.prepare('DELETE FROM menu_items WHERE place_id = ?').bind(placeId)];
  items.slice(0, 150).forEach((m) => stmts.push(db.prepare('INSERT OR IGNORE INTO menu_items (place_id, name, price, source) VALUES (?, ?, ?, ?)').bind(placeId, m.name.slice(0, 80), m.price || null, source)));
  stmts.push(db.prepare('UPDATE places SET menu_status = ?, menu_at = ? WHERE id = ?').bind(status, Date.now(), placeId));
  await db.batch(stmts);
}
