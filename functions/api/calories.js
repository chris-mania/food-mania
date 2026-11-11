import { json, cached, fetchJson } from '../../lib/fm.js';

// Calories per serving for a chain menu item (USDA FoodData Central, branded foods).
export async function onRequestGet({ request, env }) {
  if (!env.USDA_KEY) return json({ calories: null });
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 100);
  if (!q) return json({ calories: null });
  try {
    const d = await cached('cal|' + q.toLowerCase(), 86400 * 30, async () => {
      const s = await fetchJson('https://api.nal.usda.gov/fdc/v1/foods/search?pageSize=1&dataType=Branded&api_key=' + env.USDA_KEY + '&query=' + encodeURIComponent(q));
      const f = s.foods && s.foods[0];
      if (!f) return { calories: null };
      const det = await fetchJson('https://api.nal.usda.gov/fdc/v1/food/' + f.fdcId + '?api_key=' + env.USDA_KEY);
      const cal = det.labelNutrients && det.labelNutrients.calories && det.labelNutrients.calories.value;
      return { calories: cal ? Math.round(cal) : null, item: f.description };
    });
    return json(d);
  } catch (e) {
    return json({ calories: null });
  }
}
