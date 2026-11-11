import { json, bad, cached, num, googleTextSearch, normalizeGoogle } from '../../lib/fm.js';

// Google Places text search near a point. Results cached for an hour to save quota.
export async function onRequestPost({ request, env }) {
  if (!env.GOOGLE_PLACES_KEY) return bad('Google is not connected', 503);
  let body;
  try { body = await request.json(); } catch (e) { return bad('Bad request'); }
  const q = String(body.textQuery || '').trim().slice(0, 120);
  const lat = num(body.lat, -90, 90); const lng = num(body.lng, -180, 180);
  const radius = num(body.radius, 500, 50000) || 20000;
  if (!q || lat === null || lng === null) return bad('Missing search or location');
  const key = ['search', q.toLowerCase(), lat.toFixed(3), lng.toFixed(3), Math.round(radius / 1000)].join('|');
  try {
    const data = await cached(key, 3600, async () => {
      const res = await googleTextSearch(env, {
        textQuery: q, pageSize: 20, rankPreference: 'RELEVANCE',
        locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radius } }
      });
      return { places: (res.places || []).map(normalizeGoogle).filter((p) => !p.closedPermanently) };
    });
    return json(data);
  } catch (e) {
    return json({ error: 'google', status: e.status || 0 }, e.status === 429 ? 429 : 502);
  }
}
