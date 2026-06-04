/*
 * Curated Okanagan content for the /area page.
 * Real spots, real coordinates. Distance is computed in the component via
 * haversine from tokens.LISTING_LAT / LISTING_LNG.
 *
 * Restaurants are flagged `local: true` if the business is independently
 * owned + operated in the Okanagan; sorted by `rating` descending so
 * highly-rated local businesses surface first.
 */

export type NearbyCategory =
  | 'schools'
  | 'grocery'
  | 'recreation'
  | 'healthcare'
  | 'wineries'
  | 'lake-beach'
  | 'restaurants'
  | 'hikes'
  | 'family'
  | 'coffee';

export type NearbyItem = {
  name: string;
  blurb: string;
  url: string;
  lat: number;
  lng: number;
  category: NearbyCategory;
  rating?: number;        // 1-5 stars, where available
  local?: boolean;        // independently owned + operated locally
  icon?: string;          // icon key
};

export const NEARBY_GROUPS: { id: NearbyCategory; label: string; intro: string; icon: string }[] = [
  { id: 'schools',      label: 'Schools',                   intro: 'Top-rated public schools in the Westside SD23 catchment — walkable or a short drive.', icon: 'school' },
  { id: 'grocery',      label: 'Grocery & Pharmacy',        intro: 'Daily essentials handled. Major grocery chains and pharmacies minutes away on Hwy 97.', icon: 'shop' },
  { id: 'recreation',   label: 'Recreation & Fitness',      intro: 'Community pools, arenas, and fitness centres — your family will have no excuse not to be active.', icon: 'pool' },
  { id: 'healthcare',   label: 'Healthcare',                intro: 'From walk-in clinics to the region\'s main hospital, Okanagan healthcare is close at hand.', icon: 'medical' },
  { id: 'lake-beach',   label: 'Lake & Beach',              intro: 'Okanagan Lake is practically your backyard — beaches, paddleboarding, and summer evenings on the water.', icon: 'pool' },
  { id: 'restaurants',  label: 'Restaurants',               intro: 'Award-winning estate dining and beloved local spots — the Okanagan food scene punches well above its weight.', icon: 'kitchen' },
  { id: 'wineries',     label: 'Wineries & Tasting Rooms',  intro: 'World-class wineries literally steps from your door — you\'re in the middle of one of Canada\'s best wine regions.', icon: 'fire' },
  { id: 'hikes',        label: 'Hikes & Trails',            intro: 'From easy lakeside paths to summit climbs with mountain views — trail access is one of West Kelowna\'s great perks.', icon: 'mountain' },
  { id: 'family',       label: 'Family & Activities',       intro: 'Zip lines, water parks, and mini golf for rainy afternoons — this area keeps families busy year-round.', icon: 'games' },
  { id: 'coffee',       label: 'Coffee & Bakeries',         intro: 'Independent roasters and wood-fired bakeries — the kind of neighbourhood institutions that make a place feel like home.', icon: 'coffee' }
];

export const NEARBY: NearbyItem[] = [

  // ───── Schools ─────
  {
    name: 'George Pringle Secondary',
    blurb: 'West Kelowna\'s principal Grade 8–12 school. Strong academics, arts, and athletics programs within SD23.',
    url: 'https://gps.sd23.bc.ca',
    lat: 49.8512, lng: -119.6157,
    category: 'schools', icon: 'school'
  },
  {
    name: 'Mount Boucherie Secondary',
    blurb: 'Grade 8–12 school on the slopes of Mt. Boucherie. Known for its IB programme and outdoor education.',
    url: 'https://mbs.sd23.bc.ca',
    lat: 49.8554, lng: -119.6254,
    category: 'schools', icon: 'school'
  },
  {
    name: 'Chief Tomat Elementary',
    blurb: 'K–7 elementary school just minutes from the property. Welcoming community and dedicated staff.',
    url: 'https://cte.sd23.bc.ca',
    lat: 49.8418, lng: -119.6183,
    category: 'schools', icon: 'school'
  },
  {
    name: 'Westbank Elementary',
    blurb: 'Established K–7 school in the heart of Westbank with a strong French Immersion option.',
    url: 'https://we.sd23.bc.ca',
    lat: 49.8470, lng: -119.6103,
    category: 'schools', icon: 'school'
  },
  {
    name: 'Shannon Lake Elementary',
    blurb: 'K–7 school in the Shannon Lake neighbourhood. Surrounded by parks and forest trails.',
    url: 'https://sle.sd23.bc.ca',
    lat: 49.8755, lng: -119.6018,
    category: 'schools', icon: 'school'
  },

  // ───── Grocery & Pharmacy ─────
  {
    name: 'Save-On-Foods Westbank',
    blurb: 'Full-service grocery with pharmacy, bakery, and deli. Open late — the everyday anchor for West Kelowna.',
    url: 'https://www.saveonfoods.com',
    lat: 49.8589, lng: -119.5988,
    category: 'grocery', icon: 'shop'
  },
  {
    name: 'Real Canadian Superstore',
    blurb: 'Large-format grocery + general merchandise. Great for big stock-ups and competitive weekly prices.',
    url: 'https://www.realcanadiansuperstore.ca',
    lat: 49.8608, lng: -119.5947,
    category: 'grocery', icon: 'shop'
  },
  {
    name: 'Shoppers Drug Mart',
    blurb: 'Full-service pharmacy, beauty, and health — open until midnight. Prescription and walk-in convenience.',
    url: 'https://www1.shoppersdrugmart.ca',
    lat: 49.8580, lng: -119.6010,
    category: 'grocery', icon: 'medical'
  },
  {
    name: 'London Drugs Westbank',
    blurb: 'Pharmacy, electronics, and household essentials. A one-stop-shop that locals rely on year-round.',
    url: 'https://www.londondrugs.com',
    lat: 49.8573, lng: -119.5960,
    category: 'grocery', icon: 'shop'
  },

  // ───── Recreation & Fitness ─────
  {
    name: 'Shannon Lake Recreation Centre',
    blurb: 'Community pool, fitness centre, and arena in the Shannon Lake district. Year-round programming for all ages.',
    url: 'https://www.westkelownacity.ca/en/things-to-do/recreation.aspx',
    lat: 49.8750, lng: -119.6054,
    category: 'recreation', icon: 'pool'
  },
  {
    name: 'Gellatly Bay Nut Farm Regional Park',
    blurb: 'Lakefront park with picnic areas, beach access, and a marina. A favourite for families and dog owners.',
    url: 'https://rdco.com/parks/gellatly-nut-farm-regional-park',
    lat: 49.8285, lng: -119.6135,
    category: 'recreation', icon: 'mountain'
  },
  {
    name: 'Memorial Park',
    blurb: 'Community green space with sports fields, playgrounds, and seasonal events. Right in the West Kelowna core.',
    url: 'https://www.westkelownacity.ca/en/things-to-do/parks-and-trails.aspx',
    lat: 49.8617, lng: -119.5843,
    category: 'recreation', icon: 'pool'
  },

  // ───── Healthcare ─────
  {
    name: 'Kelowna General Hospital',
    blurb: 'The Okanagan\'s main regional hospital — full emergency, surgical, and specialist care. 12 minutes east.',
    url: 'https://www.interiorhealth.ca/location/kelowna-general-hospital',
    lat: 49.8853, lng: -119.4893,
    category: 'healthcare', icon: 'medical'
  },
  {
    name: 'West Kelowna Medical Clinic',
    blurb: 'Primary care and walk-in clinic on Hwy 97. Family physicians and same-day appointments available.',
    url: 'https://www.westkelownamedicalclinic.ca',
    lat: 49.8581, lng: -119.6019,
    category: 'healthcare', icon: 'medical'
  },
  {
    name: 'Okanagan Urgent Care',
    blurb: 'Urgent (non-emergency) walk-in care in Kelowna. Minor injuries, illness, and diagnostic imaging.',
    url: 'https://www.interiorhealth.ca',
    lat: 49.8843, lng: -119.4962,
    category: 'healthcare', icon: 'medical'
  },

  // ───── Wineries ─────
  {
    name: 'Mission Hill Family Estate',
    blurb: 'Architecturally stunning estate with award-winning wines and panoramic lake views.',
    url: 'https://www.missionhillwinery.com',
    lat: 49.8523, lng: -119.6041,
    category: 'wineries', rating: 4.7, icon: 'fire'
  },
  {
    name: "Quails' Gate Estate Winery",
    blurb: 'One of the Okanagan\'s most celebrated wineries — home to Old Vines Restaurant.',
    url: 'https://www.quailsgate.com',
    lat: 49.8462, lng: -119.6149,
    category: 'wineries', rating: 4.7, icon: 'fire'
  },
  {
    name: 'Frind Estate Winery',
    blurb: 'Lakefront winery on a 100-year-old farm. Beach-side tasting, family-friendly grounds.',
    url: 'https://www.frindwinery.com',
    lat: 49.8541, lng: -119.6238,
    category: 'wineries', rating: 4.6, icon: 'fire'
  },
  {
    name: 'Volcanic Hills Estate Winery',
    blurb: 'Boutique winery on the slopes of Mt. Boucherie. Stunning patio for sunset tastings.',
    url: 'https://www.volcanichillswinery.com',
    lat: 49.8508, lng: -119.6172,
    category: 'wineries', rating: 4.6, icon: 'fire'
  },
  {
    name: 'Indigenous World Winery',
    blurb: 'Award-winning Indigenous-owned winery. Stunning estate, exceptional reds.',
    url: 'https://www.indigenousworldwinery.com',
    lat: 49.8419, lng: -119.5917,
    category: 'wineries', rating: 4.7, local: true, icon: 'fire'
  },

  // ───── Lake & Beach ─────
  {
    name: 'Gellatly Bay Beach',
    blurb: 'Wide sandy beach with grassy park, swim area, and shaded picnic spots. Walk to the marina.',
    url: 'https://www.westkelownacity.ca/en/things-to-do/parks-and-trails.aspx',
    lat: 49.8290, lng: -119.6119,
    category: 'lake-beach', rating: 4.6, icon: 'pool'
  },
  {
    name: 'Kalamoir Regional Park',
    blurb: 'Quiet pebble coves, cliff-walks, and some of the clearest swim spots on the lake.',
    url: 'https://rdco.com/parks/kalamoir-regional-park',
    lat: 49.8694, lng: -119.5775,
    category: 'lake-beach', rating: 4.7, icon: 'pool'
  },
  {
    name: 'Aqua Park at Tugboat Beach',
    blurb: 'The giant inflatable obstacle course on the lake — guaranteed family chaos in the best way.',
    url: 'https://www.h2oadventure.com/aquapark',
    lat: 49.8804, lng: -119.4898,
    category: 'lake-beach', rating: 4.5, icon: 'pool'
  },
  {
    name: 'Pritchard Park Beach',
    blurb: 'Hidden local beach with shallow swim area — perfect for younger kids.',
    url: 'https://www.westkelownacity.ca/en/things-to-do/parks-and-trails.aspx',
    lat: 49.8351, lng: -119.6088,
    category: 'lake-beach', rating: 4.5, icon: 'pool'
  },
  {
    name: 'Powers Creek Boat Launch',
    blurb: 'Public boat launch + paddleboard rentals nearby. Calm-water bay for SUP and kayak beginners.',
    url: 'https://www.westkelownacity.ca',
    lat: 49.8420, lng: -119.6112,
    category: 'lake-beach', rating: 4.4, icon: 'pool'
  },

  // ───── Restaurants (sorted by rating — local-first) ─────
  {
    name: 'Old Vines Restaurant',
    blurb: 'Modern Pacific Northwest cooking with terrace views at Quails\' Gate. Reservation essential.',
    url: 'https://www.quailsgate.com/restaurant',
    lat: 49.8462, lng: -119.6149,
    category: 'restaurants', rating: 4.7, local: true, icon: 'kitchen'
  },
  {
    name: 'Terrace Restaurant at Mission Hill',
    blurb: 'Award-winning estate dining with sweeping vineyard + lake views. Open seasonally.',
    url: 'https://www.missionhillwinery.com/the-terrace-restaurant',
    lat: 49.8523, lng: -119.6041,
    category: 'restaurants', rating: 4.7, local: true, icon: 'kitchen'
  },
  {
    name: 'Waterfront Restaurant + Wine Bar',
    blurb: 'Locally-owned waterfront spot. West Kelowna favourite for date nights.',
    url: 'https://www.waterfrontwineries.com',
    lat: 49.8285, lng: -119.6068,
    category: 'restaurants', rating: 4.6, local: true, icon: 'kitchen'
  },
  {
    name: 'The Hatching Post Restaurant',
    blurb: 'Local farm-to-table breakfast + brunch institution. Get there early on weekends.',
    url: 'https://www.facebook.com/hatchingpostwk',
    lat: 49.8401, lng: -119.5934,
    category: 'restaurants', rating: 4.6, local: true, icon: 'kitchen'
  },
  {
    name: 'Mosaic Books Café',
    blurb: 'Independent bookstore + café in downtown Kelowna. Soup, sandwiches, the best chai latte.',
    url: 'https://www.mosaicbooks.ca',
    lat: 49.8859, lng: -119.4965,
    category: 'restaurants', rating: 4.6, local: true, icon: 'kitchen'
  },
  {
    name: 'Bouchons Bistro',
    blurb: 'Classic French bistro in downtown Kelowna. Steak frites + an exceptional wine list.',
    url: 'https://www.bouchonsbistro.com',
    lat: 49.8861, lng: -119.4980,
    category: 'restaurants', rating: 4.5, local: true, icon: 'kitchen'
  },

  // ───── Hikes & Trails ─────
  {
    name: 'Mt. Boucherie Trail',
    blurb: 'Short summit hike with 360° views of Lake Okanagan + vineyards. ~1 hour round trip.',
    url: 'https://www.alltrails.com/trail/canada/british-columbia/mount-boucherie-trail',
    lat: 49.8546, lng: -119.6303,
    category: 'hikes', rating: 4.6, icon: 'mountain'
  },
  {
    name: 'Knox Mountain Park',
    blurb: 'Kelowna\'s iconic urban hike. Drive or walk up — paved viewpoints + downtown panoramas.',
    url: 'https://www.kelowna.ca/parks-recreation/parks-hiking-trails/knox-mountain-park',
    lat: 49.9105, lng: -119.4992,
    category: 'hikes', rating: 4.7, icon: 'mountain'
  },
  {
    name: 'Pincushion Mountain',
    blurb: 'Steep summit hike near Peachland — wildflowers in spring, wide lake views.',
    url: 'https://www.alltrails.com/trail/canada/british-columbia/pincushion-mountain',
    lat: 49.7672, lng: -119.7437,
    category: 'hikes', rating: 4.5, icon: 'mountain'
  },
  {
    name: 'Rose Valley Regional Park',
    blurb: 'Forested loop trails with waterfall in spring. Easy enough for kids + dogs.',
    url: 'https://rdco.com/parks/rose-valley-regional-park',
    lat: 49.8807, lng: -119.5577,
    category: 'hikes', rating: 4.6, icon: 'mountain'
  },
  {
    name: 'Kalamoir Cliff Walk',
    blurb: 'Easy oceanside-feeling cliff path along the lake. Hidden coves, dramatic views, low effort.',
    url: 'https://rdco.com/parks/kalamoir-regional-park',
    lat: 49.8694, lng: -119.5775,
    category: 'hikes', rating: 4.7, icon: 'mountain'
  },

  // ───── Family & Activities ─────
  {
    name: 'H2O Adventure + Fitness Centre',
    blurb: 'Massive indoor waterpark + climbing wall + slides. Whole-day family fun in any weather.',
    url: 'https://www.h2ocentre.ca',
    lat: 49.8458, lng: -119.4153,
    category: 'family', rating: 4.5, icon: 'pool'
  },
  {
    name: 'Myra Canyon Trestles',
    blurb: 'Ride 18 historic train trestles + tunnels through the Myra-Bellevue forest. Bike rental on site.',
    url: 'https://www.myratrestles.com',
    lat: 49.8055, lng: -119.3392,
    category: 'family', rating: 4.8, icon: 'mountain'
  },
  {
    name: 'ZipZone Adventure Park',
    blurb: 'Tree-top zip line course with 6 lines and a 1,300-ft mega-zip over the canyon. Booking required.',
    url: 'https://www.zipzonecanada.com',
    lat: 49.7634, lng: -119.7287,
    category: 'family', rating: 4.7, icon: 'mountain'
  },
  {
    name: 'Kangaroo Creek Farm',
    blurb: 'Walk among kangaroos, parrots, and lemurs. Surprisingly delightful. Open seasonally.',
    url: 'https://www.kangaroocreekfarm.com',
    lat: 49.9921, lng: -119.4221,
    category: 'family', rating: 4.5, local: true, icon: 'paw'
  },
  {
    name: 'Energyplex Mini Golf',
    blurb: 'Indoor glow-in-the-dark mini golf + arcade. Backup plan for rainy afternoons.',
    url: 'https://www.energyplex.ca',
    lat: 49.8801, lng: -119.4853,
    category: 'family', rating: 4.4, local: true, icon: 'games'
  },

  // ───── Coffee & Bakeries ─────
  {
    name: 'Sprout Bread',
    blurb: 'Wood-fired sourdough + organic pastries. Lineup is part of the experience.',
    url: 'https://www.sproutbread.ca',
    lat: 49.8842, lng: -119.4938,
    category: 'coffee', rating: 4.8, local: true, icon: 'coffee'
  },
  {
    name: 'Bliss Bakery + Bistro',
    blurb: 'West Kelowna staple. Pastries, scratch breakfasts, sandwich lunches.',
    url: 'https://www.blissbakery.ca',
    lat: 49.8313, lng: -119.6175,
    category: 'coffee', rating: 4.6, local: true, icon: 'coffee'
  },
  {
    name: 'Pulp Fiction Coffee House',
    blurb: 'Beloved indie roaster + café. Best espresso in the South Okanagan.',
    url: 'https://www.pulpfictioncoffee.ca',
    lat: 49.8835, lng: -119.4910,
    category: 'coffee', rating: 4.7, local: true, icon: 'coffee'
  },
  {
    name: 'The Sunshine Café',
    blurb: 'Sunny brunch spot in downtown Kelowna. Pancakes the size of dinner plates.',
    url: 'https://www.facebook.com/sunshinecafekelowna',
    lat: 49.8884, lng: -119.4969,
    category: 'coffee', rating: 4.5, local: true, icon: 'kitchen'
  }
];
