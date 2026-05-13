/**
 * Shared menu items for all 5 concept components.
 * Single source of truth — change here, every concept updates.
 */
export type MenuItem = {
  label: string;
  href?: string;
  dataAction?: string;
  soon?: boolean;
};

export const MENU_ITEMS: MenuItem[] = [
  { label: 'The Stay', href: '/#stay' },
  { label: 'The Area', href: '/area' },
  { label: 'On The Radar', href: '#', soon: true },
  { label: 'Book', href: '#book', dataAction: 'open-booking' }
];

export const MENU_CONCEPTS = [
  { id: 'hexpulse', label: 'Hex Pulse', number: 1 },
  { id: 'compassbloom', label: 'Compass Bloom', number: 2 },
  { id: 'honeycombbloom', label: 'Honeycomb Bloom', number: 3 },
  { id: 'particleconstellation', label: 'Particle Constellation', number: 4 },
  { id: 'commandcursor', label: 'Command Cursor', number: 5 }
] as const;
