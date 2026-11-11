import { json, num, cached, fetchJson, similarName } from '../../lib/fm.js';

// Short dish tips from Foursquare for one place. Cached for a week.
export async function onRequestGet({ request, env }) {
  if (!env.FOURSQUARE_KEY) return json({ tips: [] });
  const u = new URL(request.url);
  const name = (u.searchParams.get('name') || '').slice(0, 80);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  if (!name || lat === null || lng === null) return json({ tips: [] });
  // Newer Foursquare keys use the places-api host with a Bearer token; older "fsq3" keys use v3.
  const legacy = /^fsq3/.test(env.FOURSQUARE_KEY);
  const host = legacy ? 'https://api.foursquare.com/v3/places/' : 'https://places-api.foursquare.com/places/';
  const headers = legacy ? { authorization: env.FOURSQUARE_KEY, accept: 'application/json' }
    : { authorization: 'Bearer ' + env.FOURSQUARE_KEY, accept: 'application/json', 'X-Places-Api-Version': '2025-06-17' };
  try {
    const tips = await cached('fsq|' + name.toLowerCase() + '|' + lat.toFixed(3) + ',' + lng.toFixed(3), 86400 * 7, async () => {
      const s = await fetchJson(host + 'search?limit=3&radius=300&ll=' + lat + ',' + lng + '&query=' + encodeURIComponent(name), { headers });
      const hit = (s.results || []).find((r) => similarName(name, r.name));
      if (!hit) return [];
      const id = hit.fsq_place_id || hit.fsq_id;
      const t = await fetchJson(host + id + '/tips?limit=5&sort=POPULAR', { headers });
      return (Array.isArray(t) ? t : t.results || []).map((x) => String(x.text || '').slice(0, 200)).filter(Boolean);
    });
    return json({ tips });
  } catch (e) {
    return json({ tips: [] });
  }
}
