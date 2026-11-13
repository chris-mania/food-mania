import { json } from '../../lib/fm.js';

// Tells the app which services are switched on. Never returns secret keys.
export function onRequestGet({ env }) {
  return json({
    live: !!env.DB,
    google: !!env.GOOGLE_PLACES_KEY,
    turnstileSiteKey: env.TURNSTILE_SECRET_KEY ? (env.TURNSTILE_SITE_KEY || null) : null,
    services: {
      memory: !!env.DB, google: !!env.GOOGLE_PLACES_KEY, tripadvisor: !!env.TRIPADVISOR_KEY, routing: true, chainMenus: !!env.SPOONACULAR_KEY,
      foursquare: !!env.FOURSQUARE_KEY, ai: !!env.AI, events: !!env.TICKETMASTER_KEY, calories: !!env.USDA_KEY, sports: !!env.THESPORTSDB_KEY,
      openStreetMap: true, holidays: true, weather: true
    }
  });
}
