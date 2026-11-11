import { json, num, fetchJson } from '../../lib/fm.js';

// Real drive or walk times from OpenRouteService, one request for up to 40 places.
export async function onRequestPost({ request, env }) {
  if (!env.ORS_KEY) return json({ minutes: {} });
  let body; try { body = await request.json(); } catch (e) { return json({ minutes: {} }); }
  const o = body.origin || {};
  const lat = num(o.lat, -90, 90); const lng = num(o.lng, -180, 180);
  const places = (body.places || []).slice(0, 40).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (lat === null || lng === null || !places.length) return json({ minutes: {} });
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
