import { json, bad, cached, num, googleTextSearch } from '../../lib/fm.js';

// Turns "Omni Nashville" or "Paramus, NJ" into a point on the map.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const q = (u.searchParams.get('q') || '').trim().slice(0, 120);
  if (!q) return bad('Missing place');
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  try {
    if (env.GOOGLE_PLACES_KEY) {
      const data = await cached('geo|' + q.toLowerCase(), 86400 * 7, async () => {
        const body = { textQuery: q, pageSize: 1 };
        if (lat !== null && lng !== null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
        const res = await googleTextSearch(env, body, 'places.displayName,places.location,places.formattedAddress');
        const p = res.places && res.places[0];
        return p ? { name: p.displayName.text, address: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude } : { name: null };
      });
      return json(data);
    }
    // Free fallback: OpenStreetMap's Nominatim (light use only, one request at a time)
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'FoodMania/1.0' } });
    const d = await r.json();
    if (!d[0]) return json({ name: null });
    return json({ name: d[0].display_name.split(',').slice(0, 2).join(','), lat: Number(d[0].lat), lng: Number(d[0].lon) });
  } catch (e) {
    return json({ error: 'geocode' }, 502);
  }
}
