import { json, num, cached, fetchJson } from '../../lib/fm.js';

// Is it raining right now? (Open-Meteo, free, no key)
export async function onRequestGet({ request }) {
  const u = new URL(request.url);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  if (lat === null || lng === null) return json({});
  try {
    const d = await cached('wx|' + lat.toFixed(1) + ',' + lng.toFixed(1), 1800, () =>
      fetchJson('https://api.open-meteo.com/v1/forecast?current=precipitation,weather_code,temperature_2m&temperature_unit=fahrenheit&latitude=' + lat + '&longitude=' + lng));
    const c = d.current || {};
    const code = Number(c.weather_code);
    const raining = (c.precipitation || 0) > 0.1 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
    const snowing = (code >= 71 && code <= 77) || code === 85 || code === 86;
    return json({ raining: raining || snowing, snowing, tempF: c.temperature_2m });
  } catch (e) {
    return json({});
  }
}
