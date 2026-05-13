/*
 * Sample events — shown by the OnTheRadar component when no LIVE_FEED_URL
 * is configured (i.e., the operator hasn't deployed the Cloudflare Worker
 * yet). Lets the section LOOK populated for the design preview while
 * gracefully waiting for real data.
 *
 * Schema matches the frozen contract in feed/docs/live-feed-schema.md.
 */

// Build ISO strings ~7-21 days in the future so the dates always look fresh.
function fromNow(daysAhead: number, hour = 18): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  // Return as ISO with offset
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = `${sign}${pad(offset / 60 | 0)}:${pad(offset % 60)}`;
  return d.toISOString().slice(0, 19) + off;
}

export type Event = {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceIcon: string;
  url: string;
  startsAt: string;
  endsAt: string;
  imageUrl: string | null;
  distanceMiles: number;
  category: 'music' | 'food-drink' | 'wine' | 'outdoor' | 'family' | 'arts' | 'market' | 'sport' | 'other';
};

export const SAMPLE_EVENTS: Event[] = [
  {
    id: 'sample-mission-hill-sundowner',
    title: 'Sunday Sundowner at Mission Hill',
    summary: 'Live jazz on the terrace, a glass of Quatrain in hand, the lake catching the last of the light.',
    source: 'Eventbrite',
    sourceIcon: 'eventbrite',
    url: 'https://www.missionhillwinery.com',
    startsAt: fromNow(5, 17),
    endsAt: fromNow(5, 20),
    imageUrl: null,
    distanceMiles: 2.1,
    category: 'wine'
  },
  {
    id: 'sample-westside-farmers-market',
    title: 'Westside Farmers + Crafters Market',
    summary: 'Local growers, makers, food trucks, and live music every Saturday morning through summer.',
    source: 'Tourism Kelowna',
    sourceIcon: 'other',
    url: 'https://www.westsidefarmersmarket.ca',
    startsAt: fromNow(3, 9),
    endsAt: fromNow(3, 13),
    imageUrl: null,
    distanceMiles: 0.8,
    category: 'market'
  },
  {
    id: 'sample-kelowna-prospera-show',
    title: 'Concert at Prospera Place',
    summary: 'Touring act at Kelowna\'s main arena. 9,000 seats, premium sound, free shuttle from downtown.',
    source: 'Ticketmaster',
    sourceIcon: 'ticketmaster',
    url: 'https://www.prosperaplace.com',
    startsAt: fromNow(12, 19),
    endsAt: fromNow(12, 22),
    imageUrl: null,
    distanceMiles: 9.3,
    category: 'music'
  },
  {
    id: 'sample-okanagan-wine-festival',
    title: 'Okanagan Spring Wine Festival',
    summary: 'Nine days of tastings, tours, and chef-paired dinners across 70+ wineries. Pass available.',
    source: 'PredictHQ',
    sourceIcon: 'predicthq',
    url: 'https://www.thewinefestivals.com',
    startsAt: fromNow(15, 11),
    endsAt: fromNow(24, 22),
    imageUrl: null,
    distanceMiles: 4.7,
    category: 'wine'
  },
  {
    id: 'sample-knox-trail-cleanup',
    title: 'Knox Mountain Trail Cleanup + Hike',
    summary: 'Community trail-care morning followed by a guided summit hike. Coffee + pastries on the city.',
    source: 'Eventbrite',
    sourceIcon: 'eventbrite',
    url: 'https://www.kelowna.ca',
    startsAt: fromNow(8, 8),
    endsAt: fromNow(8, 12),
    imageUrl: null,
    distanceMiles: 11.4,
    category: 'outdoor'
  },
  {
    id: 'sample-aquapark-glow-night',
    title: 'Aqua Park Glow Night',
    summary: 'After-hours session at the giant inflatable aqua park — neon, music, glow gear included.',
    source: 'Eventbrite',
    sourceIcon: 'eventbrite',
    url: 'https://www.h2oadventure.com/aquapark',
    startsAt: fromNow(10, 18),
    endsAt: fromNow(10, 21),
    imageUrl: null,
    distanceMiles: 9.8,
    category: 'family'
  }
];
