export type AmenityGroup = {
  group: 'Indoor' | 'Outdoor' | 'Kitchen' | 'Comfort';
  items: { label: string; icon: string }[];
};

export const AMENITIES: AmenityGroup[] = [
  {
    group: 'Indoor',
    items: [
      { label: 'Vaulted Ceilings', icon: 'ceiling' },
      { label: 'Smart Streaming TV', icon: 'projector' },
      { label: 'Oversized Open-Concept Living', icon: 'sofa' },
      { label: 'Games & Game Room', icon: 'games' },
      { label: 'Laundry On Site', icon: 'washer' }
    ]
  },
  {
    group: 'Outdoor',
    items: [
      { label: 'Covered Deck', icon: 'umbrella' },
      { label: 'Outdoor Movie Theatre', icon: 'projector' },
      { label: 'Mountain Views', icon: 'mountain' },
      { label: '5 Parking Stalls', icon: 'parking-grid' },
      { label: 'RV Parking', icon: 'rv' }
    ]
  },
  {
    group: 'Kitchen',
    items: [
      { label: 'Full Kitchen', icon: 'kitchen' },
      { label: 'Refrigerator', icon: 'fridge' },
      { label: 'Dishwasher', icon: 'dishwasher' },
      { label: 'Gas Range', icon: 'stove' },
      { label: 'Microwave', icon: 'microwave' }
    ]
  },
  {
    group: 'Comfort',
    items: [
      { label: 'Central Air Conditioning', icon: 'ac' },
      { label: 'Forced-Air Heating', icon: 'heat' },
      { label: 'Quiet No-Through Road', icon: 'quiet' },
      { label: 'High-Speed Wi-Fi', icon: 'wifi' },
      { label: 'Linens & Towels Provided', icon: 'towel' }
    ]
  }
];
