import { json, num, fetchJson } from '../../lib/fm.js';

// Real drive or walk times from OpenRouteService, one request for up to 40 places.
export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch (e) { return json({ minutes: {} }); }
  const o = body.origin || {};
  const lat = num(o.lat, -90, 90); const lng = num(o.lng, -180, 180);
  const places = (body.places || []).slice(0, 40).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (lat === null || lng === null || !places.length) return json({ minutes: {} });
  if (!env.ORS_KEY) return osrm(lat, lng, places, body.mode);
  const profile = body.mode === 'walk' ? 'foot-walking' : 'driving-car';
  try {
    const d = await fetchJson('https://api.openrouteservice.org/v2/matrix/' + profile, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: env.ORS_KEY },
      body: JSON.stringify({ locations: [[lng, lat]].concat(places.map((p) => [p.lng, p.lat])), sources: [0], metrics: ['duration'] })
    }, 8000);
    const row = (d.durations && d.durations[0]) || [];
    const minutes = {};
    places.forEach((p, i) => { const s = row[i + 1]; if (Number.isFinite(s)) minutes[p.id] = Math.max(1, Math.round(s / 60)); });
    return json({ minutes });
  } catch (e) {
    return json({ minutes: {} });
  }
}

// Free backup: the public OSRM server (light use only, best effort). Results are cached a day per origin.
async function osrm(lat, lng, places, mode) {
  if (mode === 'walk') return json({ minutes: {} });
  const key = 'https://fm-cache.internal/osrm/' + lat.toFixed(3) + ',' + lng.toFixed(3) + '/' + places.map((p) => p.id).join('|').slice(0, 1500);
  const hit = await caches.default.match(key);
  if (hit) return json(await hit.json());
  try {
    const coords = [[lng, lat]].concat(places.slice(0, 40).map((p) => [p.lng, p.lat])).map((c) => c[0].toFixed(5) + ',' + c[1].toFixed(5)).join(';');
    const d = await fetchJson('https://router.project-osrm.org/table/v1/driving/' + coords + '?sources=0&annotations=duration', { headers: { 'User-Agent': 'FoodMania/1.1 (food search app)' } }, 6000);
    const row = (d.durations && d.durations[0]) || [];
    const minutes = {};
    places.slice(0, 40).forEach((p, i) => { const s = row[i + 1]; if (Number.isFinite(s)) minutes[p.id] = Math.max(1, Math.round(s / 60)); });
    const out = { minutes, source: 'osrm' };
    await caches.default.put(key, new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=86400' } }));
    return json(out);
  } catch (e) {
    return json({ minutes: {} });
  }
}
