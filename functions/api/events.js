import { json, num, cached, fetchJson } from '../../lib/fm.js';

// Concerts and games happening near you tonight (Ticketmaster Discovery).
export async function onRequestGet({ request, env }) {
  if (!env.TICKETMASTER_KEY) return json({ events: [] });
  const u = new URL(request.url);
  const lat = num(u.searchParams.get('lat'), -90, 90); const lng = num(u.searchParams.get('lng'), -180, 180);
  if (lat === null || lng === null) return json({ events: [] });
  const start = new Date(); const end = new Date(start.getTime() + 12 * 3600 * 1000);
  const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  try {
    const events = await cached('tm|' + lat.toFixed(1) + ',' + lng.toFixed(1) + '|' + iso(start).slice(0, 13), 3600, async () => {
      const d = await fetchJson('https://app.ticketmaster.com/discovery/v2/events.json?size=5&sort=date,asc&radius=10&unit=miles&apikey=' + env.TICKETMASTER_KEY +
        '&latlong=' + lat + ',' + lng + '&startDateTime=' + iso(start) + '&endDateTime=' + iso(end));
      return ((d._embedded && d._embedded.events) || []).map((e) => ({
        name: e.name, venue: (e._embedded && e._embedded.venues && e._embedded.venues[0] && e._embedded.venues[0].name) || '',
        time: (e.dates && e.dates.start && e.dates.start.localTime) || ''
      })).filter((e) => e.venue);
    });
    return json({ events });
  } catch (e) {
    return json({ events: [] });
  }
}
