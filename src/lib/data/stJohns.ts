/**
 * Last Bite - St. John's, Newfoundland & Labrador demo data
 * Single source of truth for the 10 downtown demo restaurants, their kitchen
 * terminal PINs and preset rescue menus. Mirrors supabase/seed.sql.
 */

import type { DietaryTag, Merchant } from '@/src/lib/types/database';

// Downtown St. John's, NL — default map centre when live location is unavailable
export const ST_JOHNS_CENTER = {
  lat: 47.5615,
  lng: -52.7126,
};

export interface StJohnsRestaurantInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  pin: string;
  latitude: number;
  longitude: number;
  category: string;
  emoji: string;
  photoUrl: string;
}

const photo = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;

export const ST_JOHNS_RESTAURANTS: StJohnsRestaurantInfo[] = [
  {
    id: 'a1111111-1111-4111-a111-111111111111',
    name: 'No. 4 Restaurant & Bar',
    address: "4 Cathedral St, St. John's, NL",
    phone: '(709) 753-6600',
    email: 'contact@no4cathedral.com',
    pin: '1111',
    latitude: 47.5641,
    longitude: -52.7071,
    category: 'Cocktail Bar',
    emoji: '🍸',
    photoUrl: photo('1517248135467-4c7edcad34c4', 400),
  },
  {
    id: 'a2222222-2222-4222-a222-222222222222',
    name: 'The Merchant Tavern',
    address: "291 Water St, St. John's, NL",
    phone: '(709) 722-5050',
    email: 'bookings@themerchanttavern.ca',
    pin: '2222',
    latitude: 47.5623,
    longitude: -52.7094,
    category: 'Tavern',
    emoji: '🥂',
    photoUrl: photo('1550966871-3ed3cdb5ed0c', 400),
  },
  {
    id: 'a3333333-3333-4333-a333-333333333333',
    name: 'Blue on Water',
    address: "319 Water St, St. John's, NL",
    phone: '(709) 754-2583',
    email: 'info@blueonwater.com',
    pin: '3333',
    latitude: 47.5628,
    longitude: -52.7087,
    category: 'Upscale Bar',
    emoji: '🍷',
    photoUrl: photo('1555396273-367ea4eb4db5', 400),
  },
  {
    id: 'a4444444-4444-4444-a444-444444444444',
    name: 'YellowBelly Brewery',
    address: "288 Water St, St. John's, NL",
    phone: '(709) 757-3784',
    email: 'yellowbellygm@gmail.com',
    pin: '4444',
    latitude: 47.5620,
    longitude: -52.7100,
    category: 'Pub Fare',
    emoji: '🍺',
    photoUrl: photo('1544025162-d76694265947', 400),
  },
  {
    id: 'a5555555-5555-4555-a555-555555555555',
    name: "Oliver's Restaurant",
    address: "160 Water St, St. John's, NL",
    phone: '(709) 754-6444',
    email: 'c.vincent@nl.rogers.com',
    pin: '5555',
    latitude: 47.5607,
    longitude: -52.7125,
    category: 'Bistro',
    emoji: '🍝',
    photoUrl: photo('1525059696034-4967a8e1dca2', 400),
  },
  {
    id: 'a6666666-6666-4666-a666-666666666666',
    name: 'Black Cat Pizzeria',
    address: "13 LeMarchant Rd, St. John's, NL",
    phone: '(709) 687-0709',
    email: 'blackcatpizzeria@gmail.com',
    pin: '6666',
    latitude: 47.5584,
    longitude: -52.7168,
    category: 'Pizza',
    emoji: '🍕',
    photoUrl: photo('1513104890138-7c749659a591', 400),
  },
  {
    id: 'a7777777-7777-4777-a777-777777777777',
    name: 'Rocket Bakery & Fresh Food',
    address: "294 Water St, St. John's, NL",
    phone: '(709) 700-1336',
    email: 'inquiries@rocketfood.ca',
    pin: '7777',
    latitude: 47.5622,
    longitude: -52.7097,
    category: 'Bakery',
    emoji: '🥐',
    photoUrl: photo('1509440159596-0249088772ff', 400),
  },
  {
    id: 'a8888888-8888-4888-a888-888888888888',
    name: 'Chinched Restaurant',
    address: "5 Bates Hill, St. John's, NL",
    phone: '(709) 722-3100',
    email: 'info@chinched.com',
    pin: '8888',
    latitude: 47.5631,
    longitude: -52.7092,
    category: 'Charcuterie',
    emoji: '🥓',
    photoUrl: photo('1546069901-ba9599a7e63c', 400),
  },
  {
    id: 'a9999999-9999-4999-a999-999999999999',
    name: 'The Adelaide Oyster House',
    address: "334 Water St, St. John's, NL",
    phone: '(709) 722-7222',
    email: 'info@theadelaideoysterhouse.com',
    pin: '9999',
    latitude: 47.5631,
    longitude: -52.7083,
    category: 'Seafood',
    emoji: '🦪',
    photoUrl: photo('1579208570378-8c970854bc23', 400),
  },
  {
    id: 'a0000000-0000-4000-a000-000000000000',
    name: 'Terre Restaurant & Cafe',
    address: "125 Water St, St. John's, NL",
    phone: '(709) 383-2136',
    email: 'info@terrerestaurant.com',
    pin: '0000',
    latitude: 47.5601,
    longitude: -52.7136,
    category: 'Farm-to-Table',
    emoji: '🌿',
    photoUrl: photo('1540420773420-3366772f4999', 400),
  },
];

export function findRestaurant(id: string): StJohnsRestaurantInfo | undefined {
  return ST_JOHNS_RESTAURANTS.find((r) => r.id === id);
}

/** Build the Merchant record the realtime store and listings expect. */
export function toMerchant(r: StJohnsRestaurantInfo): Merchant {
  return {
    id: r.id,
    business_name: r.name,
    address: r.address,
    latitude: r.latitude,
    longitude: r.longitude,
    phone: r.phone,
    stripe_account_id: `acct_${r.id.slice(0, 8)}_connect`,
    verified: true,
    terminal_pin: r.pin,
    avatar_url: r.photoUrl,
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  };
}

export interface PresetCatalogItem {
  id: string;
  merchantId: string;
  title: string;
  description: string;
  category: string;
  originalPriceCents: number;
  discountedPriceCents: number;
  allergens: string[];
  dietaryTags: DietaryTag[];
  photoUrl: string;
}

const dish = (
  merchantId: string,
  id: string,
  title: string,
  description: string,
  category: string,
  originalPriceCents: number,
  allergens: string[],
  dietaryTags: DietaryTag[],
  photoId: string
): PresetCatalogItem => ({
  id,
  merchantId,
  title,
  description,
  category,
  originalPriceCents,
  discountedPriceCents: originalPriceCents / 2, // Strict 50% rescue rule
  allergens,
  dietaryTags,
  photoUrl: photo(photoId),
});

const [NO4, MERCHANT, BLUE, YELLOWBELLY, OLIVERS, BLACKCAT, ROCKET, CHINCHED, ADELAIDE, TERRE] =
  ST_JOHNS_RESTAURANTS.map((r) => r.id);

// Demo rescue menus: two preset dishes per restaurant (illustrative, not official menus)
export const ST_JOHNS_CATALOG_PRESETS: Record<string, PresetCatalogItem[]> = {
  [NO4]: [
    dish(NO4, 'dish_n4_codtacos', 'Crispy Cod Tacos', 'Beer-battered Atlantic cod, lime crema, pickled red onion and cabbage slaw on soft corn tortillas.', 'Cocktail Bar', 1900, ['Seafood', 'Dairy'], [], '1565299585323-38d6b0865b47'),
    dish(NO4, 'dish_n4_burger', 'No. 4 Smash Burger', 'Double smashed beef patty, aged cheddar, house pickles and secret sauce with hand-cut fries.', 'Cocktail Bar', 2200, ['Gluten', 'Dairy'], [], '1568901346375-23c9450c58cd'),
  ],
  [MERCHANT]: [
    dish(MERCHANT, 'dish_mt_cod', 'Pan-Seared Atlantic Cod', 'Local cod loin, brown butter, crushed new potatoes, capers and seasonal greens.', 'Tavern', 3200, ['Seafood', 'Dairy'], ['Gluten-Free'], '1580217593608-61931cefc821'),
    dish(MERCHANT, 'dish_mt_pasta', 'Tavern Rigatoni', 'Slow-cooked pork ragù, San Marzano tomato, parmesan and fresh basil.', 'Tavern', 2600, ['Gluten', 'Dairy'], [], '1621996346565-e3d5d6281699'),
  ],
  [BLUE]: [
    dish(BLUE, 'dish_bw_trufflefries', 'Truffle Fries', 'Crispy hand-cut fries tossed in white truffle oil, grated aged Parmigiano Reggiano and rosemary aioli.', 'Upscale Bar', 1600, ['Dairy'], ['Vegetarian'], '1573080496219-bb080dd4f877'),
    dish(BLUE, 'dish_bw_duckblt', 'Duck BLT', 'Smoked duck breast, thick-cut double smoked bacon, heirloom tomato, baby greens and roasted garlic aioli on brioche.', 'Upscale Bar', 2600, ['Gluten', 'Eggs'], [], '1550547660-d9450f859349'),
  ],
  [YELLOWBELLY]: [
    dish(YELLOWBELLY, 'dish_yb_shortrib', "St. John's Stout Braised Short Rib", "Slow-braised in house-brewed St. John's Stout with Yukon gold potato purée, glazed heritage carrots and pan jus.", 'Pub Fare', 3600, ['Dairy'], ['Gluten-Free'], '1544025162-d76694265947'),
    dish(YELLOWBELLY, 'dish_yb_fishchips', 'YellowBelly Fish & Chips (1 pc)', 'Crispy ale-battered Atlantic cod, hand-cut Kennebec fries, house tartar sauce and lemon wedge.', 'Pub Fare', 1700, ['Gluten', 'Seafood'], [], '1579208570378-8c970854bc23'),
  ],
  [OLIVERS]: [
    dish(OLIVERS, 'dish_ol_chickenparm', 'Chicken Parmesan Sandwich', 'Breaded chicken cutlet, San Marzano marinara, melted fior di latte and basil pesto on toasted ciabatta.', 'Bistro', 2200, ['Dairy', 'Gluten'], [], '1525059696034-4967a8e1dca2'),
    dish(OLIVERS, 'dish_ol_pate', 'Chickpea & Walnut Pâté', 'Roasted walnut and herb chickpea spread with marinated olives, pickled shallots and house crostini.', 'Bistro', 1800, ['Nuts', 'Gluten'], ['Vegetarian', 'Vegan'], '1540420773420-3366772f4999'),
  ],
  [BLACKCAT]: [
    dish(BLACKCAT, 'dish_bc_chickenbacon', 'Chicken Bacon Ranch Pizza', 'Sourdough crust, roasted garlic chicken, crispy bacon, house buttermilk ranch and scallions.', 'Pizza', 2300, ['Dairy', 'Gluten'], [], '1513104890138-7c749659a591'),
    dish(BLACKCAT, 'dish_bc_hothoney', 'Hot Honey Pepperoni Pizza', 'Cup & char pepperoni, whipped ricotta, Calabrian chili oil and hot wildflower honey drizzle.', 'Pizza', 2200, ['Dairy', 'Gluten'], [], '1534308983496-4fabb1a015ee'),
  ],
  [ROCKET]: [
    dish(ROCKET, 'dish_rb_breakfast', 'Best Kind Breakfast Sandwich', 'Free-run egg, country ham, aged cheddar and maple dijon butter on a freshly baked cheddar biscuit.', 'Bakery', 1200, ['Dairy', 'Gluten', 'Eggs'], [], '1555507036-ab1f4038808a'),
    dish(ROCKET, 'dish_rb_pastries', 'Day-End Pastry Box (4)', "Assorted croissants, scones and sweet buns from today's bake.", 'Bakery', 1600, ['Gluten', 'Dairy', 'Eggs'], ['Vegetarian'], '1509440159596-0249088772ff'),
  ],
  [CHINCHED]: [
    dish(CHINCHED, 'dish_ch_board', 'House Charcuterie Board', 'Chef-cured meats, house pickles, grainy mustard and grilled sourdough.', 'Charcuterie', 2800, ['Gluten', 'Mustard'], [], '1546069901-ba9599a7e63c'),
    dish(CHINCHED, 'dish_ch_porkbelly', 'Crispy Pork Belly', 'Twice-cooked pork belly, apple purée, charred greens and cider jus.', 'Charcuterie', 2600, [], ['Gluten-Free', 'Dairy-Free'], '1544025162-d76694265947'),
  ],
  [ADELAIDE]: [
    dish(ADELAIDE, 'dish_ao_oysters', 'Fresh Oysters (Half Dozen)', 'Shucked East Coast oysters with mignonette, horseradish and lemon.', 'Seafood', 2100, ['Shellfish'], ['Gluten-Free', 'Dairy-Free'], '1579871494447-9811cf80d66c'),
    dish(ADELAIDE, 'dish_ao_fishtacos', 'Fish Tacos (3)', 'Crispy fried fish, chipotle mayo, pickled jalapeño and cabbage slaw.', 'Seafood', 1800, ['Seafood', 'Gluten', 'Eggs'], [], '1565299585323-38d6b0865b47'),
  ],
  [TERRE]: [
    dish(TERRE, 'dish_te_bowl', 'Seasonal Grain Bowl', 'Roasted root vegetables, farro, local greens, pickled beets and herb vinaigrette.', 'Farm-to-Table', 1800, [], ['Vegan', 'Vegetarian', 'Dairy-Free'], '1540420773420-3366772f4999'),
    dish(TERRE, 'dish_te_codcakes', 'Newfoundland Cod Cakes', 'Salt cod and potato cakes, tartar sauce, mustard pickles and dressed greens.', 'Farm-to-Table', 1600, ['Seafood', 'Gluten', 'Eggs'], [], '1580217593608-61931cefc821'),
  ],
};
