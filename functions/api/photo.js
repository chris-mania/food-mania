import { bad, cached } from '../../lib/fm.js';
import { ensureSchema, useBudget } from '../../lib/db.js';

// Sends the browser to a Google photo without exposing the API key.
export async function onRequestGet({ request, env }) {
  const name = new URL(request.url).searchParams.get('name') || '';
  if (!env.GOOGLE_PLACES_KEY || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(name)) return bad('Bad photo', 404);
  try {
    const d = await cached('photo|' + name, 86400 * 7, async () => {
      // photos count against Google's free amount too, so they get their own daily cap
      if (env.DB) { await ensureSchema(env.DB); if (!(await useBudget(env.DB, 'google-photo', Number(env.GOOGLE_PHOTO_DAILY_CAP || 30)))) return null; }
      const r = await fetch('https://places.googleapis.com/v1/' + name + '/media?maxWidthPx=800&skipHttpRedirect=true&key=' + env.GOOGLE_PLACES_KEY);
      return r.ok ? r.json() : null;
    });
    if (!d || !d.photoUri) return bad('No photo', 404);
    return new Response(null, { status: 302, headers: { location: d.photoUri, 'cache-control': 'public, max-age=604800' } });
  } catch (e) {
    return bad('No photo', 404);
  }
}
