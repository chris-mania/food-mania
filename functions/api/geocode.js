import { json, bad, cached, num, googleTextSearch } from '../../lib/fm.js';
import { ensureSchema, useBudget } from '../../lib/db.js';

// Turns a typed place ("Paramus, NJ", "07652", "Omni Nashville") into a point, or GPS coordinates into a town name.
// Free OpenStreetMap lookup first; Google only for things like hotels that the free one can't find.
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  const reverse = u.searchParams.get('reverse') === '1';
  try {
    if (reverse) {
      if (lat === null || lng === null) return bad('Missing location');
      const d = await cached('rev|' + lat.toFixed(3) + ',' + lng.toFixed(3), 86400 * 30, async () => {
        const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=14&addressdetails=1&lat=' + lat + '&lon=' + lng, { headers: { 'User-Agent': 'FoodMania/1.1 (food search app)' } });
        if (!r.ok) return null;
        const j = await r.json(); const a = j.address || {};
        const town = a.city || a.town || a.village || a.borough || a.suburb || a.hamlet || a.county || '';
        const st = a['ISO3166-2-lvl4'] ? a['ISO3166-2-lvl4'].split('-')[1] : (a.state || '');
        return { name: [town, st].filter(Boolean).join(', ') || 'Your location' };
      });
      return json(d || { name: 'Your location' });
    }
    const q = (u.searchParams.get('q') || '').trim().slice(0, 120);
    if (!q) return bad('Missing place');
    const free = await cached('nom|' + q.toLowerCase(), 86400 * 30, async () => {
      const near = lat !== null && lng !== null ? '&viewbox=' + (lng - 1) + ',' + (lat + 1) + ',' + (lng + 1) + ',' + (lat - 1) : '';
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=us' + near + '&q=' + encodeURIComponent(q), { headers: { 'User-Agent': 'FoodMania/1.1 (food search app)' } });
      if (!r.ok) return { name: null };
      const d = await r.json();
      if (!d[0]) return { name: null };
      const a = d[0].address || {};
      const town = a.city || a.town || a.village || a.borough || a.suburb || '';
      const st = a['ISO3166-2-lvl4'] ? a['ISO3166-2-lvl4'].split('-')[1] : '';
      const label = d[0].name && d[0].name !== town ? d[0].name + (town ? ', ' + town : '') : [town, st].filter(Boolean).join(', ');
      return { name: label || d[0].display_name.split(',').slice(0, 2).join(','), lat: Number(d[0].lat), lng: Number(d[0].lon) };
    });
    if (free && free.lat) return json(free);
    if (env.GOOGLE_PLACES_KEY && env.DB) {
      await ensureSchema(env.DB);
      if (await useBudget(env.DB, 'google-search', Number(env.GOOGLE_DAILY_CAP || 25))) {
        const body = { textQuery: q, pageSize: 1 };
        if (lat !== null && lng !== null) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
        const res = await googleTextSearch(env, body, 'places.displayName,places.location,places.formattedAddress');
        const p = res.places && res.places[0];
        if (p) return json({ name: p.displayName.text, address: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude });
      }
    }
    return json({ name: null });
  } catch (e) {
    return json({ error: 'geocode' }, 502);
  }
}
