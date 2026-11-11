import { json, cached, fetchJson, kmBetween, similarName } from '../../lib/fm.js';

// Adds Tripadvisor's rating and count for up to 6 places. Each place is cached for a week.
export async function onRequestPost({ request, env }) {
  if (!env.TRIPADVISOR_KEY) return json({ results: {} });
  let body; try { body = await request.json(); } catch (e) { return json({ results: {} }); }
  const places = (body.places || []).slice(0, 6).filter((p) => p && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const base = 'https://api.content.tripadvisor.com/api/v1/location/';
  const results = {};
  await Promise.all(places.map(async (p) => {
    try {
      const d = await cached('ta|' + p.name.toLowerCase() + '|' + p.lat.toFixed(3) + ',' + p.lng.toFixed(3), 86400 * 7, async () => {
        const s = await fetchJson(base + 'search?language=en&category=restaurants&key=' + env.TRIPADVISOR_KEY +
          '&searchQuery=' + encodeURIComponent(p.name) + '&latLong=' + p.lat + ',' + p.lng, { headers: { accept: 'application/json' } });
        const hit = (s.data || []).find((x) => similarName(p.name, x.name));
        if (!hit) return { none: true };
        const det = await fetchJson(base + hit.location_id + '/details?language=en&currency=USD&key=' + env.TRIPADVISOR_KEY, { headers: { accept: 'application/json' } });
        if (det.latitude && kmBetween(p, { lat: Number(det.latitude), lng: Number(det.longitude) }) > 0.4) return { none: true };
        return { rating: Number(det.rating) || 0, count: Number(det.num_reviews) || 0, url: det.web_url || '' };
      });
      if (d && !d.none && d.rating) results[p.id] = d;
    } catch (e) { /* skip this place */ }
  }));
  return json({ results });
}
