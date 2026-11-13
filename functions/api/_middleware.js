import { json } from '../../lib/fm.js';

// Runs before every /api call: bot check on paid searches, and a safety net for errors.
export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  if (env.TURNSTILE_SECRET_KEY && request.method === 'POST' && url.pathname === '/api/places') {
    const token = request.headers.get('x-turnstile-token');
    if (!token) return json({ error: 'bot-check' }, 403);
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET_KEY);
    form.append('response', token);
    form.append('remoteip', request.headers.get('CF-Connecting-IP') || '');
    try {
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
      const d = await r.json();
      if (!d.success) return json({ error: 'bot-check' }, 403);
    } catch (e) { /* if the check service is down, let the search through */ }
  }
  try {
    return await ctx.next();
  } catch (e) {
    return json({ error: 'server', detail: String(e && e.message || e).slice(0, 200) }, 500);
  }
}
