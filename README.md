# Food Mania

Find the exact food you're craving near you: "spicy chicken sandwich at a sports bar", "iced caramel coffee and vanilla latte", "hibachi with noodles near my hotel". One score blended from Google and Tripadvisor, drive times instead of miles, Hidden Gems, head-to-head Compare, and a Decision Wheel.

It's a website that can be added to a phone's home screen to act like an app. It runs free on Cloudflare Pages.

## How it works

- `public/`: the app itself (plain HTML, CSS and JavaScript, no build step)
  - `logic.js`: search understanding, item matching, scoring, hours, drive time
  - `app.js`: the screens
  - `sample-data.js`: made-up places around Paramus, NJ, used in demo mode
- `functions/api/`: small server pieces that call outside services and keep the keys secret
- `lib/fm.js`: shared server helpers

**Free layer (always on):** every food place from OpenStreetMap, menus read from restaurants' own websites, built-in menus for big chains, and a memory database (Cloudflare D1, set in `wrangler.toml`) that saves everything so repeat searches cost nothing.

**Bonus layer:** Google adds ratings and photos for places not already saved, under a daily cap (`GOOGLE_DAILY_CAP`, default 25 searches; `GOOGLE_PHOTO_DAILY_CAP`, default 30 photos). When the cap is hit, the app keeps working on the free layer and links each place to its reviews. Menu reading by AI has its own daily cap (`AI_MENU_DAILY`, default 80).

## Services and their settings

Add these in Cloudflare: **Workers & Pages → food-mania → Settings → Variables and Secrets** (type "Secret").

| Setting | Service | What it adds | Required |
| --- | --- | --- | --- |
| `GOOGLE_PLACES_KEY` | Google Places API (New) | Ratings, photos, 5 reviews per place | No, but recommended |
| `TRIPADVISOR_KEY` | Tripadvisor Content API | Second rating in the Food Mania Score | No |
| `ORS_KEY` | OpenRouteService | Real drive and walk times | No (estimates used) |
| `FOURSQUARE_KEY` | Foursquare Places API | Dish tips on place pages | No |
| `TICKETMASTER_KEY` | Ticketmaster Discovery | "Concert tonight, eat nearby" | No |
| `USDA_KEY` | USDA FoodData Central | Calories on chain menu items | No |
| `THESPORTSDB_KEY` | TheSportsDB | "Games today" on sports bar searches | No |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile | Blocks bots from burning the free quota | No |
| (built in) | Cloudflare Workers AI | Review summaries | Set in `wrangler.toml` |
| (no key) | OpenStreetMap, Nager.Date, Open-Meteo | Extra places, holiday warnings, rain tips | — |

**Keep Google at $0:** in Google Cloud → APIs & Services → Places API (New) → Quotas, set *Text Search* requests per day to about 150. Google stops at the cap instead of charging.

## Run it locally (optional)

```
npx wrangler pages dev
```

Put keys in a `.dev.vars` file (never commit it).

## Not in this version yet

Reading local restaurant websites for menus (Cloudflare Browser Rendering), city health grades, and Advanced Search with AI. See the product plan.
