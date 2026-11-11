import { json, num, cached } from '../../lib/fm.js';

// Extra places from OpenStreetMap (free, no ratings) for when Google finds very few.
export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  const radius = Math.min(num(u.searchParams.get('radius'), 200, 20000) || 5000, 8000);
  const q = (u.searchParams.get('q') || '').toLowerCase().slice(0, 80);
  if (lat === null || lng === null) return json({ places: [] });
  const words = q.split(/\s+/).filter((w) => w.length > 2);
  try {
    const places = await cached('osm|' + lat.toFixed(2) + ',' + lng.toFixed(2) + '|' + radius, 86400, async () => {
      const query = '[out:json][timeout:15];(nwr["amenity"~"^(restaurant|fast_food|cafe|bar|pub|ice_cream|food_court)$"]["name"](around:' + radius + ',' + lat + ',' + lng + '););out center 120;';
      const r = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'content-type': 'application/x-www-form-urlencoded', 'User-Agent': 'FoodMania/1.0' } });
      if (!r.ok) return [];
      const d = await r.json();
      return (d.elements || []).map((e) => {
        const t = e.tags || {};
        const cuisine = String(t.cuisine || '').split(';')[0].replace(/_/g, ' ');
        return {
          id: 'osm-' + e.type + e.id, name: t.name, cuisine: cuisine ? cuisine[0].toUpperCase() + cuisine.slice(1) : t.amenity.replace('_', ' '),
          types: [t.amenity.replace('_', ' '), cuisine].filter(Boolean), lat: e.lat || (e.center && e.center.lat), lng: e.lon || (e.center && e.center.lon),
          address: [t['addr:housenumber'], t['addr:street'], t['addr:city']].filter(Boolean).join(' '), phone: t.phone || '', website: t.website || '',
          priceLevel: 0, sources: {}, hours: [], features: { outdoor: t.outdoor_seating === 'yes' || undefined }, menu: [], reviews: [], photos: [], osm: true, tint: '#E2D9CF'
        };
      }).filter((p) => p.name && p.lat);
    });
    const filtered = words.length ? places.filter((p) => words.some((w) => (p.name + ' ' + p.types.join(' ')).toLowerCase().includes(w))) : places;
    return json({ places: filtered.slice(0, 20) });
  } catch (e) {
    return json({ places: [] });
  }
}
