import { json, cached, fetchJson } from '../../lib/fm.js';

// US public holiday today? (Nager.Date, free, no key) Hours are often different on holidays.
export async function onRequestGet() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  try {
    const list = await cached('hol|' + today.slice(0, 4), 86400, () => fetchJson('https://date.nager.at/api/v3/PublicHolidays/' + today.slice(0, 4) + '/US'));
    const hit = (list || []).find((h) => h.date === today && (h.global || !h.counties));
    return json({ today: hit ? hit.name : null });
  } catch (e) {
    return json({ today: null });
  }
}
