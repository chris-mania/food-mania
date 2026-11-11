import { json, cached, fetchJson } from '../../lib/fm.js';

// Chain menus from Spoonacular (US chains). Cached 30 days per chain.
export async function onRequestPost({ request, env }) {
  if (!env.SPOONACULAR_KEY) return json({ menus: {} });
  let body; try { body = await request.json(); } catch (e) { return json({ menus: {} }); }
  const chains = (body.chains || []).slice(0, 5).map((c) => String(c).slice(0, 60));
  const menus = {};
  await Promise.all(chains.map(async (name) => {
    try {
      menus[name] = await cached('menu|' + name.toLowerCase(), 86400 * 30, async () => {
        const d = await fetchJson('https://api.spoonacular.com/food/menuItems/search?number=40&query=' + encodeURIComponent(name) + '&apiKey=' + env.SPOONACULAR_KEY);
        const want = name.toLowerCase().replace(/[^a-z]/g, '');
        return (d.menuItems || [])
          .filter((m) => String(m.restaurantChain || '').toLowerCase().replace(/[^a-z]/g, '') === want)
          .map((m) => ({ name: m.title, price: 0, image: m.image || '' }));
      });
    } catch (e) { menus[name] = []; }
  }));
  return json({ menus });
}
