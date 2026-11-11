import { json, cached, fetchJson } from '../../lib/fm.js';

// Today's NFL, NBA, NHL and MLB games (TheSportsDB) for sports bar searches.
export async function onRequestGet({ env }) {
  if (!env.THESPORTSDB_KEY) return json({ games: [] });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const leagues = ['4391', '4387', '4380', '4424']; // NFL, NBA, NHL, MLB
  try {
    const games = await cached('games|' + today, 3600, async () => {
      const all = await Promise.allSettled(leagues.map((id) => fetchJson('https://www.thesportsdb.com/api/v1/json/' + env.THESPORTSDB_KEY + '/eventsday.php?d=' + today + '&l=' + id)));
      const out = [];
      all.forEach((r) => {
        if (r.status !== 'fulfilled') return;
        (r.value.events || []).forEach((e) => out.push({ name: e.strEvent, league: e.strLeague, time: e.strTimestamp || e.strTime || '' }));
      });
      return out.slice(0, 12);
    });
    return json({ games });
  } catch (e) {
    return json({ games: [] });
  }
}
