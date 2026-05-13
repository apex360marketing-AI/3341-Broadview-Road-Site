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
  { id: 'wineries',     label: 'Wineries & Tasting Rooms', intro: 'World-class wineries within a 10-minute drive.', icon: 'fire' },
  { id: 'lake-beach',   label: 'Lake & Beach',              intro: 'Beaches, swim spots, and on-water adventures on Okanagan Lake.', icon: 'pool' },
  { id: 'restaurants',  label: 'Restaurants',               intro: 'Local-first. Sorted by guest rating — the best of the Okanagan plate.', icon: 'kitchen' },
  { id: 'hikes',        label: 'Hikes & Trails',            intro: 'From easy lakeside paths to summit climbs with mountain views.', icon: 'mountain' },
  { id: 'family',       label: 'Family & Activities',       intro: 'Zip lines, petting zoos, water parks, mini golf — for every age.', icon: 'games' },
  { id: 'coffee',       label: 'Coffee & Bakeries',         intro: 'Where the locals start their day.', icon: 'coffee' }
];

export const NEARBY: NearbyItem[] = [
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
