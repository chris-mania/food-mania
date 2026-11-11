// Sample places around Paramus, NJ. Names, ratings, menus and reviews are made up.
// Used when the live Google connection isn't set up (demo mode).
window.FM_SAMPLE = {
  origin: { name: 'Paramus, NJ', lat: 40.9445, lng: -74.0754 },
  places: [
    {
      id: 'hot-hen', name: 'Hot Hen Kitchen', cuisine: 'Chicken', types: ['chicken', 'fast food', 'restaurant'],
      lat: 40.9512, lng: -74.0689, address: 'Route 4, Paramus, NJ', phone: '+12015550101', website: '',
      priceLevel: 1, priceRange: [10, 16], chain: false,
      sources: { google: { rating: 4.6, count: 1020 }, tripadvisor: { rating: 4.5, count: 194 } },
      hours: [[660, 1380], [660, 1380], [660, 1380], [660, 1380], [660, 1380], [660, 1440], [660, 1440]],
      features: { kids: true, beer: false },
      menuComplete: true,
      menu: [
        { name: 'Nashville Hot Chicken Sandwich', price: 9.49 }, { name: 'Classic Fried Chicken Sandwich', price: 8.49 },
        { name: 'Honey Butter Tenders', price: 8.99 }, { name: 'Fried Pickles', price: 4.99 },
        { name: 'Mac and Cheese', price: 3.99 }, { name: 'Wings (8)', price: 11.99 }, { name: 'Sweet Tea', price: 2.49 }
      ],
      reviews: [
        { rating: 5, text: 'The Nashville hot chicken sandwich is crispy with real heat, huge portion.' },
        { rating: 5, text: 'Honey butter tenders are sweet and salty, my kids love them.' },
        { rating: 4, text: 'Fried pickles were great. Mac and cheese is the best side here.' },
        { rating: 2, text: 'Long wait on Friday night.' }
      ],
      rave: 0.7, tint: '#EED7C8'
    },
    {
      id: 'casa-birria', name: 'Casa Birria', cuisine: 'Mexican', types: ['mexican', 'tacos', 'restaurant'],
      lat: 40.9301, lng: -74.0701, address: 'Main St, Maywood, NJ', phone: '+12015550102', website: '',
      priceLevel: 1, priceRange: [12, 18], chain: false,
      sources: { google: { rating: 4.9, count: 58 } },
      hours: [null, [690, 1320], [690, 1320], [690, 1320], [690, 1350], [690, 1350], [690, 1260]],
      features: { kids: true, outdoor: true },
      menuComplete: false,
      menu: [{ name: 'Birria Tacos (3)', price: 14 }, { name: 'Quesabirria', price: 15 }, { name: 'Chipotle Chicken Torta', price: 13 }],
      reviews: [
        { rating: 5, text: 'I drive 40 minutes for these birria tacos. Dripping, rich, the consomme is unreal.' },
        { rating: 5, text: 'Chipotle chicken torta, so good. Tiny place, huge flavor.' },
        { rating: 5, text: 'Best quesabirria in North Jersey, no contest.' },
        { rating: 5, text: 'Family run, everything made fresh. Salsa verde is amazing.' }
      ],
      rave: 0.95, tint: '#E5DCC5'
    },
    {
      id: 'taqueria-sol', name: 'Taqueria Sol', cuisine: 'Mexican', types: ['mexican', 'tacos', 'restaurant'],
      lat: 40.9655, lng: -74.0412, address: 'Kinderkamack Rd, River Edge, NJ', phone: '+12015550103', website: '',
      priceLevel: 1, priceRange: [10, 15], chain: false,
      sources: { google: { rating: 4.5, count: 1650 }, tripadvisor: { rating: 4.4, count: 240 } },
      hours: [[660, 1500], [660, 1500], [660, 1500], [660, 1500], [660, 1560], [660, 1560], [660, 1560]],
      features: { beer: true, kids: true },
      menuComplete: true,
      menu: [
        { name: 'Al Pastor Tacos (3)', price: 10 }, { name: 'Beef Tacos (3)', price: 11 }, { name: 'Chicken Burrito', price: 12 },
        { name: 'Elote', price: 5 }, { name: 'Horchata', price: 4 }
      ],
      reviews: [
        { rating: 5, text: 'Al pastor tacos are perfect, open late which is clutch.' },
        { rating: 4, text: 'Beef tacos were good, a little dry.' },
        { rating: 4, text: 'Great late-night spot, horchata is legit.' }
      ],
      rave: 0.55, tint: '#F0D6C4'
    },
    {
      id: 'route17-diner', name: 'Route 17 Diner', cuisine: 'Diner', types: ['diner', 'american', 'restaurant', 'breakfast'],
      lat: 40.9583, lng: -74.0812, address: 'Route 17, Paramus, NJ', phone: '+12015550104', website: '',
      priceLevel: 2, priceRange: [15, 25], chain: false,
      sources: { google: { rating: 4.3, count: 2031 }, tripadvisor: { rating: 4.0, count: 310 } },
      hours: [[0, 1440], [0, 1440], [0, 1440], [0, 1440], [0, 1440], [0, 1440], [0, 1440]],
      features: { kids: true, beer: true },
      menuComplete: false, menu: [],
      reviews: [
        { rating: 4, text: 'Classic Jersey diner, open 24 hours. Disco fries hit at 2am.' },
        { rating: 4, text: 'Huge menu, the chicken francese was solid.' },
        { rating: 3, text: 'Coffee is just ok.' }
      ],
      rave: 0.35, tint: '#DCE4D3'
    },
    {
      id: 'bird-bun', name: 'Bird & Bun', cuisine: 'Chicken', types: ['chicken', 'fast food', 'restaurant'],
      lat: 40.9255, lng: -74.0631, address: 'Spring Valley Rd, Paramus, NJ', phone: '+12015550105', website: '',
      priceLevel: 1, priceRange: [9, 14], chain: false,
      sources: { google: { rating: 4.4, count: 640 } },
      hours: [[660, 1290], [660, 1290], [660, 1290], [660, 1290], [660, 1320], [660, 1320], [720, 1260]],
      features: { kids: true },
      menuComplete: true,
      menu: [
        { name: 'Firecracker Spicy Chicken Sandwich', price: 8.79 }, { name: 'Buttermilk Chicken Sandwich', price: 8.29 },
        { name: 'Chicken Tenders', price: 7.99 }, { name: 'Waffle Fries', price: 3.49 }, { name: 'Iced Coffee', price: 2.99 }
      ],
      reviews: [
        { rating: 4, text: 'Firecracker sandwich is crunchy, a bit salty.' },
        { rating: 5, text: 'Waffle fries are addictive.' }
      ],
      rave: 0.45, tint: '#E9DFCB'
    },
    {
      id: 'gs-sports-grill', name: 'Garden State Sports Grill', cuisine: 'Sports bar', types: ['sports bar', 'bar', 'american', 'restaurant'],
      lat: 40.9398, lng: -74.0498, address: 'Forest Ave, Paramus, NJ', phone: '+12015550106', website: '',
      priceLevel: 2, priceRange: [18, 30], chain: false,
      sources: { google: { rating: 4.4, count: 1210 }, tripadvisor: { rating: 4.3, count: 180 } },
      hours: [[690, 1500], [690, 1440], [690, 1440], [690, 1440], [690, 1500], [690, 1560], [690, 1560]],
      features: { tvs: true, beer: true, cocktails: true, kids: true },
      menuComplete: false,
      menu: [{ name: 'Buffalo Wings', price: 15 }, { name: 'Loaded Nachos', price: 14 }],
      reviews: [
        { rating: 5, text: 'TVs everywhere, perfect for Sunday football. Wings are great.' },
        { rating: 4, text: 'Good beer list, burgers are solid. Kids menu too.' },
        { rating: 4, text: 'Fried pickles and wings for the game, great vibe.' }
      ],
      rave: 0.5, tint: '#E2D9CF'
    },
    {
      id: 'kumo-hibachi', name: 'Kumo Hibachi', cuisine: 'Japanese', types: ['japanese', 'hibachi', 'sushi', 'restaurant'],
      lat: 40.9178, lng: -74.0812, address: 'Route 4, Hackensack, NJ', phone: '+12015550107', website: '',
      priceLevel: 3, priceRange: [30, 50], chain: false,
      sources: { google: { rating: 4.5, count: 890 }, tripadvisor: { rating: 4.5, count: 150 } },
      hours: [[720, 1320], [720, 1320], [720, 1320], [720, 1320], [720, 1380], [720, 1380], [720, 1320]],
      features: { kids: true, cocktails: true, reservable: true },
      menuComplete: false, menu: [{ name: 'Hibachi Chicken', price: 26 }, { name: 'Hibachi Steak', price: 32 }],
      reviews: [
        { rating: 5, text: 'Great show at the grill, kids loved it. Fried rice is the best.' },
        { rating: 4, text: 'Hibachi chicken was perfect, yum yum sauce on everything.' }
      ],
      rave: 0.5, tint: '#E6D6E4'
    },
    {
      id: 'bean-barrel', name: 'Bean & Barrel Coffee', cuisine: 'Coffee', types: ['cafe', 'coffee shop', 'bakery'],
      lat: 40.9489, lng: -74.0601, address: 'Midland Ave, Paramus, NJ', phone: '+12015550108', website: '',
      priceLevel: 1, priceRange: [5, 12], chain: false,
      sources: { google: { rating: 4.7, count: 230 } },
      hours: [[390, 1140], [390, 1140], [390, 1140], [390, 1140], [390, 1140], [420, 1080], [420, 1020]],
      features: { outdoor: true, quiet: true },
      menuComplete: true,
      menu: [
        { name: 'Iced Caramel Latte', price: 5.75 }, { name: 'Vanilla Latte', price: 5.25 }, { name: 'Frozen Coffee', price: 5.95 },
        { name: 'Cold Brew', price: 4.5 }, { name: 'Almond Croissant', price: 4.25 }
      ],
      reviews: [
        { rating: 5, text: 'Iced caramel latte is perfect, not too sweet.' },
        { rating: 5, text: 'Their frozen coffee is better than any chain. Almond croissant is a must.' },
        { rating: 4, text: 'Cozy and quiet, good place to work.' }
      ],
      rave: 0.75, tint: '#E3D3C3'
    },
    {
      id: 'scoops', name: 'Scoops on Main', cuisine: 'Ice cream', types: ['ice cream', 'dessert'],
      lat: 40.9361, lng: -74.0911, address: 'Main St, Rochelle Park, NJ', phone: '+12015550109', website: '',
      priceLevel: 1, priceRange: [5, 10], chain: false,
      sources: { google: { rating: 4.8, count: 140 } },
      hours: [[780, 1380], [780, 1380], [780, 1380], [780, 1380], [780, 1410], [720, 1440], [720, 1410]],
      features: { outdoor: true, kids: true },
      menuComplete: false, menu: [{ name: 'Coffee Ice Cream', price: 5 }, { name: 'Milkshakes', price: 7 }],
      reviews: [
        { rating: 5, text: 'Coffee Oreo flavor is incredible. Open late in the summer.' },
        { rating: 5, text: 'Homemade flavors that rotate every week. The coffee ice cream is the best I have had.' },
        { rating: 5, text: 'Cute spot, huge scoops.' }
      ],
      rave: 0.9, tint: '#F2DDE3'
    },
    {
      id: 'trattoria-lucia', name: 'Trattoria Lucia', cuisine: 'Italian', types: ['italian', 'restaurant'],
      lat: 40.9724, lng: -74.0699, address: 'Paramus Rd, Paramus, NJ', phone: '+12015550110', website: '',
      priceLevel: 3, priceRange: [35, 60], chain: false,
      sources: { google: { rating: 4.6, count: 520 }, tripadvisor: { rating: 4.5, count: 120 } },
      hours: [null, [1020, 1320], [1020, 1320], [1020, 1320], [1020, 1380], [1020, 1380], [960, 1260]],
      features: { reservable: true, cocktails: true, quiet: true, romantic: true },
      menuComplete: true,
      menu: [
        { name: 'Chicken Francese', price: 26 }, { name: 'Chicken Marsala', price: 26 }, { name: 'Burrata', price: 16 },
        { name: 'Penne Vodka', price: 22 }, { name: 'Tiramisu', price: 11 }
      ],
      reviews: [
        { rating: 5, text: 'Perfect date night, candlelit and quiet. Chicken francese was lemony and perfect.' },
        { rating: 5, text: 'The burrata is creamy and amazing. Book a reservation on weekends.' },
        { rating: 4, text: 'Penne vodka is classic. Pricey but worth it for a special night.' }
      ],
      rave: 0.7, tint: '#EADBC8'
    },
    {
      id: 'skyline-terrace', name: 'Skyline Terrace', cuisine: 'American', types: ['american', 'bar', 'restaurant'],
      lat: 40.9032, lng: -74.0353, address: 'River St, Hackensack, NJ', phone: '+12015550111', website: '',
      priceLevel: 4, priceRange: [60, 100], chain: false,
      sources: { google: { rating: 4.5, count: 760 }, tripadvisor: { rating: 4.4, count: 210 } },
      hours: [null, null, [1020, 1380], [1020, 1380], [1020, 1440], [1020, 1440], [960, 1320]],
      features: { view: true, rooftop: true, outdoor: true, cocktails: true, reservable: true, romantic: true, liveMusic: true },
      menuComplete: false, menu: [{ name: 'Truffle Mac and Cheese', price: 18 }, { name: 'Ribeye', price: 58 }],
      reviews: [
        { rating: 5, text: 'Rooftop with an amazing view of the city skyline. Perfect for a date.' },
        { rating: 4, text: 'Cocktails are great, live music on Fridays. Truffle mac and cheese is so cheesy.' },
        { rating: 4, text: 'Expensive, dress up a little.' }
      ],
      rave: 0.6, tint: '#D9DEE6'
    },
    {
      id: 'slice-society', name: 'Slice Society', cuisine: 'Pizza', types: ['pizza', 'italian', 'restaurant'],
      lat: 40.9555, lng: -74.0988, address: 'Ridgewood Ave, Paramus, NJ', phone: '+12015550112', website: '',
      priceLevel: 1, priceRange: [8, 15], chain: false,
      sources: { google: { rating: 4.5, count: 880 } },
      hours: [[660, 1320], [660, 1320], [660, 1320], [660, 1320], [660, 1380], [660, 1410], [660, 1320]],
      features: { kids: true, beer: false },
      menuComplete: true,
      menu: [
        { name: 'Plain Slice', price: 3.5 }, { name: 'Vodka Slice', price: 4.5 }, { name: 'Buffalo Chicken Slice', price: 4.75 },
        { name: 'Garlic Knots', price: 4 }, { name: 'Wings (10)', price: 13 }, { name: 'Mozzarella Sticks', price: 7 }
      ],
      reviews: [
        { rating: 5, text: 'Vodka slice is elite. Garlic knots are buttery.' },
        { rating: 4, text: 'Buffalo chicken slice is spicy and cheesy, great late snack.' }
      ],
      rave: 0.6, tint: '#EFDCC2'
    },
    {
      id: 'cluck-express', name: 'Cluck Express', cuisine: 'Fast food', types: ['fast food', 'chicken', 'restaurant'],
      lat: 40.9463, lng: -74.0712, address: 'Garden State Plaza, Paramus, NJ', phone: '', website: '',
      priceLevel: 1, priceRange: [8, 13], chain: true,
      sources: { google: { rating: 4.4, count: 3100 } },
      hours: [[390, 1320], [390, 1320], [390, 1320], [390, 1320], [390, 1320], [390, 1320], null],
      features: { kids: true },
      menuComplete: true, chainMenu: true,
      menu: [
        { name: 'Spicy Chicken Sandwich', price: 0 }, { name: 'Chicken Sandwich', price: 0 }, { name: 'Nuggets', price: 0 },
        { name: 'Waffle Fries', price: 0 }, { name: 'Frozen Coffee', price: 0 }, { name: 'Milkshakes', price: 0 }
      ],
      reviews: [{ rating: 4, text: 'Fast drive-thru, spicy deluxe is consistent.' }],
      rave: 0.3, tint: '#F3D9C9'
    }
  ]
};
