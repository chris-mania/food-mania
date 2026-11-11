import { json } from '../../lib/fm.js';

// Tells the app which services are switched on. Never returns secret keys.
export function onRequestGet({ env }) {
  return json({
    live: !!env.GOOGLE_PLACES_KEY,
    turnstileSiteKey: env.TURNSTILE_SECRET_KEY ? (env.TURNSTILE_SITE_KEY || null) : null,
    services: {
      google: !!env.GOOGLE_PLACES_KEY, tripadvisor: !!env.TRIPADVISOR_KEY, routing: !!env.ORS_KEY, chainMenus: !!env.SPOONACULAR_KEY,
      foursquare: !!env.FOURSQUARE_KEY, ai: !!env.AI, events: !!env.TICKETMASTER_KEY, calories: !!env.USDA_KEY, sports: !!env.THESPORTSDB_KEY,
      openStreetMap: true, holidays: true, weather: true
    }
  });
}
