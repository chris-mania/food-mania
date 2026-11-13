import { json, bad } from '../../lib/fm.js';
import { ensureSchema, getPlace, menusFor, DAY_MS } from '../../lib/db.js';
import { readAndSave } from '../../lib/menu.js';
import { CHAIN_MENUS, chainKey } from '../../lib/chains.js';

// A place's menu: saved copy if recent, otherwise read it from the website right now.
export async function onRequestGet({ request, env }) {
  if (!env.DB) return bad('No database', 503);
  await ensureSchema(env.DB);
  const id = new URL(request.url).searchParams.get('id') || '';
  const p = await getPlace(env.DB, id);
  if (!p) return bad('Unknown place', 404);
  const chain = chainKey(p.brand || p.name);
  if (chain) return json({ status: 'ok', source: 'chain', items: CHAIN_MENUS[chain].map((n) => ({ name: n, price: 0 })), complete: true });
  const fresh = p.menuAt && Date.now() - p.menuAt < 90 * DAY_MS;
  if (p.menuStatus === 'ok' && fresh) {
    const m = await menusFor(env.DB, [id]);
    return json({ status: 'ok', source: 'website', items: m[id] || [], checkedAt: p.menuAt, complete: (m[id] || []).length >= 12 });
  }
  if (fresh && p.menuStatus && p.menuStatus !== 'failed') return json({ status: p.menuStatus, items: [], checkedAt: p.menuAt });
  const res = await readAndSave(env, p);
  return json({ status: res.status, source: res.source || '', items: res.items || [], description: res.description || '', image: res.image || '', checkedAt: Date.now(), complete: (res.items || []).length >= 12 });
}
