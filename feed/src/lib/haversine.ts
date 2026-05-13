/**
 * Haversine great-circle distance.
 *
 * Returns the distance in MILES between two lat/lng pairs. Accurate enough
 * for "is this event within 50 miles of the listing?" — not for navigation.
 *
 * Earth radius constant chosen as the mean radius in miles (3958.7613).
 */
const EARTH_RADIUS_MILES = 3958.7613;

const toRad = (deg: number): number => (deg * Math.PI) / 180;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_MILES * c;
}

/** Round to 2 decimals for the public payload (per the frozen schema). */
export function roundMiles(miles: number): number {
  return Math.round(miles * 100) / 100;
}
