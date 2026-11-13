// Food Mania core logic: search parsing, item matching, scoring, hours, drive time.
// Pure functions with no page access, so they can be tested in Node too.
(function (root) {
  'use strict';

  // ---------- text helpers ----------
  const TYPOS = {
    chiken: 'chicken', chikn: 'chicken', chickn: 'chicken', chicen: 'chicken', chickin: 'chicken', chicekn: 'chicken', chcken: 'chicken',
    sandwhich: 'sandwich', sandwitch: 'sandwich', sanwich: 'sandwich', sandwhiches: 'sandwiches', sammich: 'sandwich', sandwiche: 'sandwich', sandwic: 'sandwich',
    fransay: 'francese', francaise: 'francese', fransese: 'francese', franchise: 'francese', francese: 'francese', fransaise: 'francese',
    coffe: 'coffee', cofee: 'coffee', cofe: 'coffee', coffie: 'coffee', carmel: 'caramel', caramal: 'caramel', carmal: 'caramel',
    vaniella: 'vanilla', vanila: 'vanilla', vannila: 'vanilla', vanilia: 'vanilla',
    spcy: 'spicy', spicey: 'spicy', spici: 'spicy', sprots: 'sports', sport: 'sports', spots: 'spots',
    pickels: 'pickles', pickel: 'pickle', buritto: 'burrito', burito: 'burrito', burritto: 'burrito', piza: 'pizza', pizzza: 'pizza',
    wingz: 'wings', hibatchi: 'hibachi', habachi: 'hibachi', noodels: 'noodles', nooodles: 'noodles', expresso: 'espresso',
    icecream: 'ice cream', tv: 'tvs', "tv's": 'tvs', tacoes: 'tacos', tacco: 'taco', burgr: 'burger', burgur: 'burger',
    cheeze: 'cheese', cheezy: 'cheesy', desert: 'dessert', deserts: 'desserts', resturant: 'restaurant', restraunt: 'restaurant', resteraunt: 'restaurant',
    late: 'late', boba: 'bubble tea', brunch: 'brunch', parm: 'parmesan', parmigiana: 'parmesan'
  };

  const COMPOUNDS = ['mac and cheese', 'fish and chips', 'chips and salsa', 'rice and beans', 'chicken and waffles', 'ice cream', 'cold brew',
    'bubble tea', 'hot dog', 'hot dogs', 'pad thai', 'lo mein', 'fried rice', 'egg roll', 'egg rolls', 'cheese steak', 'french fries', 'pork roll', 'taylor ham'];

  function normalize(text) {
    let t = ' ' + String(text || '').toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' &,+-]/g, ' ') + ' ';
    t = t.replace(/\s+/g, ' ');
    t = t.split(' ').map((w) => (TYPOS[w] !== undefined ? TYPOS[w] : w)).join(' ');
    t = t.replace(/\bice (coffee|latte|tea|mocha|matcha|chai|americano|macchiato|cappuccino)\b/g, 'iced $1');
    return t.replace(/\s+/g, ' ').trim();
  }

  function singular(w) {
    if (w.length <= 3) return w;
    if (/(ss|us|is)$/.test(w)) return w;
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/(ch|sh|x)es$/.test(w)) return w.slice(0, -2);
    if (/oes$/.test(w)) return w.slice(0, -2);
    if (/s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  function words(text) {
    return normalize(text).split(/[^a-z0-9_]+/).filter(Boolean).map(singular);
  }

  // ---------- search parsing ----------
  const FILLER = [
    'where can i get', 'where can i find', 'where do i get', 'where is', "where's", 'i want', 'i need', "i'm craving", 'im craving', 'craving',
    'looking for', 'find me', 'show me', 'give me', 'get me', 'is there', 'are there', 'any good', 'near me', 'nearby', 'around here',
    'close by', 'closest', 'pls', 'please', 'something', 'somewhere', 'in the mood for', 'mood for'
  ];
  const TYPES = [
    ['sports bar', 'sports bar'], ['sport bar', 'sports bar'], ['wine bar', 'bar'], ['bar', 'bar'], ['pub', 'bar'], ['brewery', 'bar'],
    ['coffee shop', 'cafe'], ['cafe', 'cafe'], ['café', 'cafe'], ['diner', 'diner'], ['pizzeria', 'pizza'], ['pizza place', 'pizza'],
    ['taco place', 'mexican'], ['taco spot', 'mexican'], ['taqueria', 'mexican'], ['mexican place', 'mexican'], ['mexican restaurant', 'mexican'],
    ['hibachi place', 'hibachi'], ['hibachi spot', 'hibachi'], ['hibachi', 'hibachi'], ['steakhouse', 'steakhouse'], ['steak house', 'steakhouse'],
    ['bakery', 'bakery'], ['ice cream shop', 'ice cream'], ['ice cream place', 'ice cream'], ['ice cream spot', 'ice cream'],
    ['sushi place', 'sushi'], ['sushi spot', 'sushi'], ['chinese place', 'chinese'], ['chinese restaurant', 'chinese'], ['italian place', 'italian'],
    ['italian restaurant', 'italian'], ['thai place', 'thai'], ['fast food', 'fast food'], ['deli', 'deli'], ['bagel shop', 'bakery']
  ];
  const FEATURES = [
    [/\b(lots of |many |a lot of )?tvs\b|\btelevisions?\b|\bwatch(ing)? the game\b|\bgame on\b/, 'tvs', 'TVs'],
    [/\bdrinks?\b|\bbeers?\b|\bcocktails?\b|\balcohol\b|\bbooze\b|\bwine\b/, 'drinks', 'Drinks'],
    [/\bkids?\b|\bkid friendly\b|\bmy son\b|\bmy daughter\b|\bmy kids\b|\bfamily\b|\bchildren\b/, 'kids', 'Kid-friendly'],
    [/\bnice views?\b|\bviews?\b|\bscenic\b|\bwaterfront\b/, 'view', 'Nice view'],
    [/\brooftop\b|\bbalcony\b|\bterrace\b/, 'rooftop', 'Rooftop or balcony'],
    [/\boutdoor( seating)?\b|\boutside\b|\bpatio\b/, 'outdoor', 'Outdoor seating'],
    [/\bdate night\b|\bromantic\b|\bfor a date\b|\bdate\b|\bcandle ?lit\b/, 'romantic', 'Date night'],
    [/\bquiet\b|\bcalm\b/, 'quiet', 'Quiet'],
    [/\blive music\b/, 'liveMusic', 'Live music'],
    [/\breservations?\b|\breserve\b|\bbook a table\b/, 'reservable', 'Takes reservations'],
    [/\bcheap\b|\binexpensive\b|\bbudget\b|\baffordable\b|\bnot expensive\b/, 'cheap', 'Inexpensive'],
    [/\bfancy\b|\bexpensive\b|\bupscale\b|\bgo big\b|\bnice dinner\b/, 'fancy', 'Go big'],
    [/\bopen now\b|\bright now\b|\bopen\b/, 'openNow', 'Open now'],
    [/\blate night\b|\blate\b|\bafter midnight\b|\b24 ?(hours|hr|\/7)\b/, 'late', 'Open late']
  ];
  const DROP = new Set(['at', 'with', 'that', 'has', 'have', 'having', 'serves', 'serving', 'serve', 'for', 'my', 'me', 'i', 'to', 'of', 'in', 'on',
    'a', 'an', 'the', 'some', 'place', 'places', 'spot', 'spots', 'restaurant', 'restaurants', 'joint', 'food', 'good', 'great', 'best', 'top',
    'any', 'kind', 'type', 'dish', 'dishes', 'style', 'get', 'eat', 'grab', 'want', 'where', 'can', 'and', 'or', 'also', 'plus', 'too', 'who', 'which',
    'like', 'really', 'super', 'decent', 'one', 'it', 'is', 'are', 'be', 'that', 'thing', 'things', 'stuff', 'eats', 'go', 'lets', "let's", 'we', 'us', 'our', 'to-go', 'now', 'tonight', 'today', 'hungry']);

  function parseQuery(raw) {
    const out = { raw: raw, items: [], types: [], features: [], anchor: null, notes: [] };
    let t = ' ' + normalize(raw) + ' ';
    // anchor: "near the Omni Nashville", "by my hotel"
    const anchorRe = /\b(?:near|by|around|next to|close to|walking distance (?:to|from))\s+(?!me\b|here\b)((?:the |my )?[a-z0-9' &-]+?)(?=\s+(?:with|that|and|for|open|which|who|has|serving)\b|\s*,|\s*$)/;
    const am = t.match(anchorRe);
    if (am && am[1].trim().length > 2) {
      out.anchor = am[1].replace(/^(the|my)\s+/, '').trim();
      t = t.replace(am[0], ' ');
    }
    FILLER.forEach((f) => { t = t.split(' ' + f + ' ').join(' '); });
    FEATURES.forEach(([re, key, label]) => {
      if (re.test(t)) {
        if (!out.features.some((f) => f.key === key)) out.features.push({ key: key, label: label });
        t = t.replace(new RegExp(re.source, 'g'), ' ');
      }
    });
    if (out.features.some((f) => f.key === 'cheap') && out.features.some((f) => f.key === 'fancy')) {
      out.notes.push('You asked for cheap and fancy, so we kept both and show the closest fits.');
    }
    TYPES.forEach(([phrase, key]) => {
      const re = new RegExp('\\b' + phrase.replace(/ /g, '\\s+') + 's?\\b', 'g');
      if (re.test(t)) {
        if (!out.types.includes(key)) out.types.push(key);
        t = t.replace(re, ' ');
      }
    });
    // protect compound dishes from being split on "and"
    COMPOUNDS.forEach((c) => { t = t.split(c).join(c.replace(/ /g, '_')); });
    const parts = t.split(/\s*(?:,|&|\+|\band\b|\bplus\b|\balso\b|\bor\b|\bwith\b)\s*/);
    parts.forEach((p) => {
      const kept = p.split(' ').filter((w) => w && !DROP.has(w)).join(' ').trim();
      if (kept && kept.length > 1 && !/^\d+$/.test(kept)) {
        const name = kept.replace(/_/g, ' ');
        if (!out.items.some((i) => i.name === name)) out.items.push({ name: name });
      }
    });
    // hibachi on its own is a place type, not an item
    out.items = out.items.slice(0, 4);
    return out;
  }

  // ---------- item matching ----------
  const ALTS = {
    spicy: ['spicy', 'hot', 'firecracker', 'nashville', 'buffalo', 'jalapeno', 'chipotle', 'sriracha', 'diablo', 'fire'],
    sandwich: ['sandwich', 'sub', 'hero', 'hoagie', 'torta', 'wrap'],
    coffee: ['coffee', 'latte', 'cold brew', 'cold_brew', 'espresso', 'cappuccino', 'americano', 'frappe', 'macchiato', 'mocha'],
    iced: ['iced', 'cold'],
    frozen: ['frozen', 'frappe', 'blended', 'frosted'],
    cheese: ['cheese', 'cheesy', 'burrata', 'mozzarella', 'quesabirria', 'queso', 'fondue', 'parmesan'],
    cheesy: ['cheese', 'cheesy', 'burrata', 'mozzarella', 'quesabirria', 'queso', 'fondue', 'parmesan'],
    noodle: ['noodle', 'lo mein', 'lo_mein', 'ramen', 'udon', 'pad thai', 'pad_thai', 'yakisoba', 'pho', 'soba', 'lo'],
    'ice cream': ['ice cream', 'ice_cream', 'gelato', 'scoop', 'sundae', 'soft serve', 'flavor'],
    dessert: ['dessert', 'cake', 'tiramisu', 'ice cream', 'ice_cream', 'cookie', 'brownie', 'cannoli', 'pie', 'gelato'],
    pizza: ['pizza', 'slice', 'pie'],
    burger: ['burger', 'cheeseburger', 'smashburger'],
    wing: ['wing'],
    taco: ['taco'],
    fry: ['fry', 'fries'],
    parmesan: ['parmesan', 'parm', 'parmigiana']
  };
  const FAMILY_ONLY = { chicken: ['chicken', 'wing', 'tender', 'nugget', 'francese', 'marsala', 'piccata'] };
  const LIKELY = {
    wing: ['sports bar', 'bar', 'pizza', 'chicken'], pickle: ['sports bar', 'bar', 'chicken'],
    noodle: ['hibachi', 'japanese', 'chinese', 'thai', 'vietnamese', 'ramen'], coffee: ['cafe', 'coffee shop', 'coffee', 'diner', 'donut'],
    latte: ['cafe', 'coffee shop'], sandwich: ['fast food', 'chicken', 'diner', 'deli'], chicken: ['chicken', 'diner', 'american', 'fast food', 'sports bar'],
    taco: ['mexican'], burrito: ['mexican'], quesadilla: ['mexican'], pizza: ['pizza'], 'ice cream': ['ice cream', 'dessert'],
    burger: ['diner', 'american', 'sports bar', 'bar', 'fast food'], cheese: ['italian', 'pizza', 'diner'], francese: ['italian', 'diner'],
    marsala: ['italian', 'diner'], dessert: ['ice cream', 'dessert', 'bakery', 'italian'], sushi: ['sushi', 'japanese'],
    fry: ['fast food', 'diner', 'sports bar', 'chicken', 'american'], salad: ['diner', 'american', 'italian', 'cafe'], bagel: ['bakery', 'cafe', 'deli'],
    'bubble tea': ['cafe', 'tea', 'bubble tea'], steak: ['steakhouse', 'american'], pancake: ['diner', 'breakfast'], 'fried rice': ['hibachi', 'japanese', 'chinese']
  };
  const GENERIC = new Set(['classic', 'fried', 'regular', 'special', 'house', 'homemade', 'fresh', 'big', 'small', 'large', 'crispy']);

  function itemTokens(name) {
    let n = normalize(name);
    COMPOUNDS.forEach((c) => { n = n.split(c).join(c.replace(/ /g, '_')); });
    return n.split(' ').filter((w) => w && !DROP.has(w)).map((w) => (w.includes('_') ? w.replace(/_/g, ' ') : singular(w)));
  }

  function textHas(textNorm, textWords, alt) {
    if (alt.includes(' ') || alt.includes('_')) return textNorm.includes(alt.replace(/_/g, ' '));
    return textWords.has(singular(alt));
  }

  // how well does a piece of text match the item? returns {full, hits, total, headHit}
  function scoreText(tokens, text) {
    const textNorm = ' ' + normalize(text) + ' ';
    const tw = new Set(words(text));
    const only = tokens.length === 1 && FAMILY_ONLY[tokens[0]];
    let hits = 0; let headHit = false;
    tokens.forEach((tok, i) => {
      const alts = only ? FAMILY_ONLY[tokens[0]] : (ALTS[tok] || [tok]);
      const ok = alts.some((a) => textHas(textNorm, tw, a));
      if (ok) { hits++; if (i === tokens.length - 1) headHit = true; }
    });
    const required = tokens.filter((t) => !GENERIC.has(t)).length || tokens.length;
    return { full: hits >= required && headHit, hits: hits, total: tokens.length, headHit: headHit };
  }

  function likelyFor(tokens, place) {
    const types = (place.types || []).concat([String(place.cuisine || '').toLowerCase()]);
    const head = tokens[tokens.length - 1];
    const keys = [head].concat(tokens);
    for (const k of keys) {
      const list = LIKELY[k];
      if (list && list.some((ty) => types.some((pt) => pt.includes(ty)))) return true;
    }
    return false;
  }

  // label one item for one place
  function matchItem(item, place) {
    const tokens = itemTokens(item.name);
    if (!tokens.length) return { label: 'unconfirmed', rank: 0 };
    let best = null; let partial = null;
    (place.menu || []).forEach((m) => {
      const s = scoreText(tokens, m.name);
      if (s.full && !best) best = m;
      else if (s.headHit && s.hits >= Math.max(1, Math.ceil(s.total / 2)) && !partial) partial = m;
    });
    const mentions = (place.reviews || []).filter((r) => scoreText(tokens, r.text).full);
    const positive = mentions.filter((r) => (r.rating || 5) >= 4);
    const quote = positive[0] ? shortQuote(positive[0].text, tokens) : '';
    if (best) {
      const lit = tokens.filter((t) => words(best.name).includes(singular(t))).length / tokens.length;
      return { label: 'menu', rank: 4 + 0.4 * lit, text: best.name, price: best.price || 0, mentions: mentions.length, positive: positive.length, quote: quote, chainMenu: !!place.chainMenu };
    }
    if (false) return { label: 'menu', rank: 4, text: best.name, price: best.price || 0, mentions: mentions.length, positive: positive.length, quote: quote, chainMenu: !!place.chainMenu };
    if (positive.length) return { label: 'reviews', rank: 3, text: quote, mentions: mentions.length, positive: positive.length, quote: quote };
    // the place itself is known for it: "bagel" at a bagel shop, "pizza" at a pizzeria
    const kind = place.name + ' ' + (place.cuisine || '') + ' ' + (place.types || []).join(' ');
    if (scoreText(tokens, kind).full) return { label: 'specialty', rank: 3.5, text: 'It\u2019s what they do', mentions: mentions.length, positive: positive.length, quote: quote };
    if (partial) return { label: 'closest', rank: 2, text: partial.name, price: partial.price || 0, mentions: 0, positive: 0, quote: '' };
    // a full menu was read and the item isn't on it
    if (place.menuComplete && (place.menu || []).length) {
      return { label: 'no', rank: place.chainMenu ? -1 : -2, text: place.chainMenu ? 'Not on their usual menu' : 'Not on their menu', mentions: 0, positive: 0, quote: '' };
    }
    if (likelyFor(tokens, place)) return { label: 'likely', rank: 1.5, text: '', mentions: 0, positive: 0, quote: '' };
    return { label: 'unconfirmed', rank: 0.3, text: '', mentions: 0, positive: 0, quote: '' };
  }

  function shortQuote(text, tokens) {
    const sentences = String(text).split(/(?<=[.!?])\s+/);
    const s = sentences.find((x) => scoreText(tokens, x).hits > 0) || sentences[0] || '';
    return s.length > 90 ? s.slice(0, 87).trim() + '…' : s;
  }

  // ---------- features and types ----------
  const FEATURE_WORDS = {
    tvs: ['tvs', 'tv', 'screens', 'football', 'the game', 'games on'], drinks: ['beer', 'cocktail', 'drinks', 'bar', 'wine'],
    kids: ['kids', 'kid', 'family', 'children'], view: ['view', 'views', 'skyline', 'waterfront', 'scenic'], rooftop: ['rooftop', 'balcony', 'terrace'],
    outdoor: ['outdoor', 'patio', 'outside'], romantic: ['date', 'romantic', 'candlelit', 'anniversary'], quiet: ['quiet', 'cozy', 'calm'],
    liveMusic: ['live music', 'band'], reservable: ['reservation', 'book']
  };

  function checkFeature(key, place, now) {
    const f = place.features || {};
    const revText = ' ' + normalize((place.reviews || []).map((r) => r.text).join(' ')) + ' ';
    const inReviews = (FEATURE_WORDS[key] || []).some((w) => revText.includes(' ' + w));
    const types = place.types || [];
    switch (key) {
      case 'tvs': return f.tvs ? 'yes' : inReviews ? 'reviews' : types.includes('sports bar') ? 'likely' : f.tvs === false ? 'no' : 'unknown';
      case 'drinks': return (f.beer || f.cocktails || f.wine) ? 'yes' : types.includes('bar') || types.includes('sports bar') ? 'yes' : inReviews ? 'reviews' : (f.beer === false && f.cocktails === false) ? 'no' : 'unknown';
      case 'kids': return f.kids ? 'yes' : inReviews ? 'reviews' : 'unknown';
      case 'romantic': return f.romantic ? 'yes' : inReviews ? 'reviews' : (place.priceLevel >= 3 && (f.reservable || f.quiet)) ? 'likely' : 'unknown';
      case 'cheap': return place.priceLevel ? (place.priceLevel <= 1 ? 'yes' : place.priceLevel === 2 ? 'likely' : 'no') : 'unknown';
      case 'fancy': return place.priceLevel ? (place.priceLevel >= 3 ? 'yes' : 'no') : 'unknown';
      case 'openNow': { const o = openInfo(place, now); return o.known ? (o.open ? 'yes' : 'no') : 'unknown'; }
      case 'late': { const c = closeTimeToday(place, now); return c === null ? 'unknown' : c >= 23 * 60 ? 'yes' : 'no'; }
      default: return f[key] ? 'yes' : inReviews ? 'reviews' : f[key] === false ? 'no' : 'unknown';
    }
  }
  const FEATURE_RANK = { yes: 2, reviews: 1.5, likely: 1, unknown: 0.2, no: -3 };

  function typeMatches(type, place) {
    const types = (place.types || []).concat([String(place.cuisine || '').toLowerCase()]);
    // the free map data often lists sports bars as plain bars or pubs
    if (type === 'sports bar') return types.some((t) => t.includes('bar') || t.includes('pub'));
    if (type === 'bar') return types.some((t) => t.includes('bar') || t.includes('pub'));
    if (type === 'cafe') return types.some((t) => t.includes('cafe') || t.includes('coffee'));
    return types.some((t) => t.includes(type));
  }

  // ---------- hours ----------
  // hours[day] = [openMinute, closeMinute] with close past 1440 meaning after midnight; null = closed
  function minsNow(now) { return now.getHours() * 60 + now.getMinutes(); }

  function openInfo(place, now) {
    const h = place.hours;
    if (!h || !h.length) return { known: false, open: false, label: 'Hours not listed', cls: 'muted' };
    const d = now.getDay(); const m = minsNow(now);
    const today = h[d]; const prev = h[(d + 6) % 7];
    let closeAt = null;
    if (today && m >= today[0] && m < today[1]) closeAt = today[1];
    else if (prev && prev[1] > 1440 && m < prev[1] - 1440) closeAt = prev[1] - 1440;
    if (closeAt !== null) {
      const all24 = h.every((x) => x && x[0] === 0 && x[1] >= 1440);
      if (all24) return { known: true, open: true, label: 'Open 24 hours', cls: 'open', closeAt: 2880 };
      const left = closeAt - m;
      if (left <= 60) return { known: true, open: true, label: 'Closes in ' + left + ' min', cls: 'closing', closeAt: closeAt };
      return { known: true, open: true, label: 'Open until ' + fmtTime(closeAt), cls: 'open', closeAt: closeAt };
    }
    // closed: find next opening
    for (let i = 0; i < 7; i++) {
      const day = h[(d + i) % 7];
      if (day && (i > 0 || day[0] > m)) {
        const when = i === 0 ? 'today' : i === 1 ? 'tomorrow' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(d + i) % 7];
        return { known: true, open: false, label: 'Closed · opens ' + fmtTime(day[0]) + (i === 0 ? '' : ' ' + when), cls: 'closed' };
      }
    }
    return { known: true, open: false, label: 'Closed', cls: 'closed' };
  }

  function closeTimeToday(place, now) {
    const h = place.hours; if (!h || !h.length) return null;
    const day = h[now.getDay()]; return day ? day[1] : 0;
  }

  function fmtTime(min) {
    let m = min % 1440; const h24 = Math.floor(m / 60); const mm = m % 60;
    if (min >= 1440 && m === 0) return 'midnight';
    if (h24 === 12 && mm === 0) return 'noon';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return h12 + (mm ? ':' + String(mm).padStart(2, '0') : '') + (h24 < 12 ? ' AM' : ' PM');
  }

  // ---------- distance ----------
  function km(a, b) {
    const R = 6371; const toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR; const dLng = (b.lng - a.lng) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function estimateMinutes(origin, place, mode) {
    const d = km(origin, place);
    if (mode === 'walk') return Math.max(1, Math.round((d * 1.25) / 4.8 * 60));
    return Math.max(1, Math.round((d * 1.35) / 38 * 60 + 2));
  }
  function miles(origin, place) { return km(origin, place) * 0.621371; }

  // ---------- scoring ----------
  function blend(place) {
    let sum = 0; let n = 0; const parts = [];
    Object.keys(place.sources || {}).forEach((k) => {
      const s = place.sources[k];
      if (s && s.rating && s.count) { sum += s.rating * s.count; n += s.count; parts.push({ source: k, rating: s.rating, count: s.count }); }
    });
    return { rating: n ? sum / n : 0, count: n, parts: parts };
  }
  function fmScore(place, areaAvg) {
    const b = blend(place); const m = 50; const C = areaAvg || 4.3;
    if (!b.count) return { score: 0, rating: 0, count: 0, parts: [] };
    const score = (b.count / (b.count + m)) * b.rating + (m / (b.count + m)) * C;
    return { score: score, rating: b.rating, count: b.count, parts: b.parts };
  }
  const RAVE_WORDS = ['best', 'amazing', 'incredible', 'unreal', 'must', 'obsessed', 'drive', 'perfect', 'insane', 'elite', 'favorite', 'legit',
    'addictive', 'no contest', 'to die for', 'blown away', 'every week', 'hidden gem', 'gem', 'outstanding', 'phenomenal', 'love'];
  function raveScore(place) {
    if (typeof place.rave === 'number') return place.rave;
    const rs = (place.reviews || []).filter((r) => r.text && r.text.length > 20);
    if (!rs.length) return 0;
    const per = rs.map((r) => {
      const t = ' ' + normalize(r.text) + ' ';
      const hits = RAVE_WORDS.filter((w) => t.includes(' ' + w)).length;
      return Math.min(1, hits / 2 + Math.min(r.text.length, 300) / 1200);
    });
    return per.reduce((a, b) => a + b, 0) / per.length;
  }
  function gemScore(place) {
    const b = blend(place);
    const written = (place.reviews || []).filter((r) => r.text && r.text.length > 20);
    if (place.chain || b.rating < 4.7 || written.length < 4 || b.count > 400) return null;
    const rave = raveScore(place);
    const ratingPart = Math.min(1, Math.max(0, (b.rating - 4.5) / 0.5));
    const consistency = written.filter((r) => (r.rating || 5) >= 4).length / written.length;
    const trust = written.length >= 4 ? 0.85 : 0.6;
    return Math.round(100 * (0.4 * rave + 0.25 * ratingPart + 0.2 * consistency + 0.15 * trust));
  }

  const CHAINS = ["mcdonald's", 'mcdonalds', 'burger king', "wendy's", 'wendys', 'chick-fil-a', 'chick fil a', 'popeyes', 'kfc', 'taco bell', 'chipotle',
    'subway', 'starbucks', 'dunkin', "domino's", 'dominos', 'pizza hut', "papa john's", 'five guys', 'shake shack', 'panera', "applebee's", "chili's",
    'olive garden', 'buffalo wild wings', 'wingstop', "raising cane's", 'sonic', "arby's", "jersey mike's", "jimmy john's", 'dairy queen',
    'baskin-robbins', 'panda express', 'ihop', "denny's", 'tgi fridays', 'red robin', 'cheesecake factory', "p.f. chang's", 'benihana', 'qdoba',
    "moe's", 'white castle', 'jack in the box', 'carvel', 'cold stone', 'tim hortons', "dave's hot chicken", 'cava', 'sweetgreen', 'wawa', 'quickchek'];
  function isChain(name) { const n = String(name || '').toLowerCase(); return CHAINS.some((c) => n.startsWith(c) || n === c); }

  // ---------- the main ranking ----------
  function rank(places, parsed, ctx) {
    const now = ctx.now || new Date();
    const origin = ctx.origin;
    const valid = places.filter((p) => blend(p).count > 0);
    const areaAvg = valid.length ? valid.reduce((a, p) => a + blend(p).rating, 0) / valid.length : 4.3;
    let rows = places.map((p) => {
      const s = fmScore(p, areaAvg);
      const minutes = (ctx.driveMinutes && ctx.driveMinutes[p.id]) || estimateMinutes(origin, p, ctx.mode);
      const exact = !!(ctx.driveMinutes && ctx.driveMinutes[p.id]);
      const items = parsed.items.map((it) => Object.assign({ item: it.name }, matchItem(it, p)));
      const feats = parsed.features.map((f) => ({ key: f.key, label: f.label, state: checkFeature(f.key, p, now) }));
      const typeOk = parsed.types.every((t) => typeMatches(t, p));
      const open = openInfo(p, now);
      const gem = gemScore(p);
      let match = 0;
      items.forEach((i) => { match += i.rank; });
      if (parsed.types.includes('sports bar') && ((p.types || []).includes('sports bar') || (p.features && p.features.tvs))) match += 1.5;
      feats.forEach((f) => { match += FEATURE_RANK[f.state]; });
      return { place: p, score: s, minutes: minutes, exactMinutes: exact, miles: miles(origin, p), items: items, feats: feats, typeOk: typeOk, open: open, gem: gem, match: match };
    });
    rows = rows.filter((r) => r.typeOk && !(r.place.closedPermanently));
    if (ctx.gemsOnly) rows = rows.filter((r) => r.gem !== null && r.gem >= 70);
    // distance with auto-widen
    let radius = ctx.radius || 15; let widened = null;
    const goodCount = (rad) => rows.filter((r) => r.minutes <= rad && isGood(r)).length;
    if (radius < 999 && !ctx.fixedRadius) {
      const steps = [radius, 25, 40, 999].filter((x, i, a) => x >= radius && a.indexOf(x) === i);
      for (const st of steps) { radius = st; if (goodCount(st) >= (ctx.minGood || 6)) break; }
      if (radius !== (ctx.radius || 15)) widened = radius;
    }
    rows = rows.filter((r) => r.minutes <= radius);
    // a hard "no" on open now hides the place
    if (parsed.features.some((f) => f.key === 'openNow')) rows = rows.filter((r) => !r.feats.some((f) => f.key === 'openNow' && f.state === 'no'));
    const ruledOut = rows.filter((r) => r.items.length && r.items.every((i) => i.label === 'no'));
    rows = rows.filter((r) => !ruledOut.includes(r));
    let others = [];
    if (parsed.items.length) {
      const weak = rows.filter((r) => r.items.every((i) => i.label === 'unconfirmed'));
      if (rows.length - weak.length >= 1) { others = weak; rows = rows.filter((r) => !weak.includes(r)); }
    }
    const sortKey = ctx.sort || 'best';
    rows.sort((a, b) => {
      if (sortKey === 'score') return b.score.score - a.score.score;
      if (sortKey === 'closest') return a.minutes - b.minutes;
      if (sortKey === 'gems') return (b.gem || 0) - (a.gem || 0) || b.score.score - a.score.score;
      if (b.match !== a.match) return b.match - a.match;
      const sa = a.score.score - a.minutes * 0.01; const sb = b.score.score - b.minutes * 0.01;
      return sb - sa;
    });
    // groups for multi-item searches
    let groups = null;
    if (parsed.items.length > 1) {
      const strong = (i) => i.label === 'menu' || i.label === 'reviews' || i.label === 'specialty';
      const all = rows.filter((r) => r.items.every(strong));
      const some = rows.filter((r) => !all.includes(r) && r.items.some(strong));
      const rest = rows.filter((r) => !all.includes(r) && !some.includes(r) && r.items.some((i) => i.rank >= 1.5));
      groups = [
        { key: 'all', title: 'Has all ' + parsed.items.length, rows: all },
        { key: 'some', title: 'Has some of them', rows: some },
        { key: 'rest', title: 'Probably has them · check the menu', rows: rest }
      ];
    }
    return { rows: rows, groups: groups, others: others, ruledOut: ruledOut, radius: radius, widened: widened, areaAvg: areaAvg };
  }
  function isGood(r) {
    if (!r.items.length) return r.score.score >= 4.0;
    return r.items.some((i) => i.rank >= 1.5);
  }

  // rank inside its own kind of place: "Top 10% of chicken spots nearby"
  function typeRank(row, allRows) {
    const c = String(row.place.cuisine || '').toLowerCase();
    const same = allRows.filter((r) => String(r.place.cuisine || '').toLowerCase() === c);
    if (same.length < 3) return null;
    const sorted = same.map((r) => r.score.score).sort((a, b) => b - a);
    const pos = sorted.indexOf(row.score.score);
    const pct = Math.max(1, Math.round(((pos + 1) / sorted.length) * 100));
    return { pct: pct <= 10 ? 10 : pct <= 25 ? 25 : pct <= 50 ? 50 : null, cuisine: c };
  }

  // "what to order": menu items people mention most
  function whatToOrder(place) {
    const out = [];
    (place.menu || []).forEach((m) => {
      const tokens = itemTokens(m.name).filter((t) => !GENERIC.has(t));
      if (!tokens.length) return;
      const all = itemTokens(m.name);
      const ms = (place.reviews || []).filter((r) => { const s = scoreText(all, r.text); return s.hits === s.total; });
      if (ms.length) out.push({ name: m.name, price: m.price, mentions: ms.length, quote: shortQuote(ms[0].text, all) });
    });
    const seen = new Set();
    return out.sort((a, b) => b.mentions - a.mentions).filter((o) => { if (seen.has(o.quote)) return false; seen.add(o.quote); return true; }).slice(0, 3);
  }

  const api = { normalize, words, parseQuery, matchItem, itemTokens, scoreText, checkFeature, typeMatches, openInfo, fmtTime, estimateMinutes,
    miles, blend, fmScore, gemScore, raveScore, rank, typeRank, whatToOrder, isChain, km };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FMLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
