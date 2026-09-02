/** Seed listings for the RealtyChain catalog. Source of truth until admin origination exists. */
const properties = [
  {
    id: '1',
    title: 'Luxury Downtown Apartment',
    description:
      'A stunning luxury apartment in the heart of the city. This property features floor-to-ceiling windows, premium finishes, and access to exclusive amenities including a rooftop pool, fitness center, and 24/7 concierge service.',
    imageUrl:
      'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    location: 'New York, NY',
    price: 450000,
    tokenPrice: 0.5,
    totalTokens: 1000,
    tokensSold: 650,
    status: 'Available',
    features: ['3 Bedrooms', '2 Bathrooms', '1,800 sq ft', 'Built in 2020', 'Doorman', 'Gym'],
    bedrooms: 3,
    bathrooms: 2,
    documents: [
      { name: 'Property Deed', url: '#' },
      { name: 'Financial Projections', url: '#' },
      { name: 'Inspection Report', url: '#' },
    ],
    returnRate: 8.2,
  },
  {
    id: '2',
    title: 'Beachfront Villa',
    description:
      'Luxurious beachfront property with direct access to pristine white sand beaches. This villa offers panoramic ocean views, a private infinity pool, and meticulously landscaped gardens.',
    imageUrl:
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    location: 'Miami, FL',
    price: 1200000,
    tokenPrice: 1.2,
    totalTokens: 1000,
    tokensSold: 1000,
    status: 'Sold Out',
    features: ['5 Bedrooms', '6 Bathrooms', '4,500 sq ft', 'Private Pool', 'Beach Access', 'Smart Home'],
    bedrooms: 5,
    bathrooms: 6,
    documents: [
      { name: 'Property Deed', url: '#' },
      { name: 'Financial Projections', url: '#' },
      { name: 'Inspection Report', url: '#' },
    ],
    returnRate: 10.5,
  },
  {
    id: '3',
    title: 'Modern Office Building',
    description:
      'Prime commercial real estate in the central business district. This modern office building features state-of-the-art facilities, energy-efficient design, and is fully leased to AAA-rated corporate tenants on long-term contracts.',
    imageUrl:
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    location: 'Chicago, IL',
    price: 3500000,
    tokenPrice: 3.5,
    totalTokens: 1000,
    tokensSold: 300,
    status: 'Available',
    features: ['25,000 sq ft', '10 Floors', 'Parking Garage', 'LEED Certified', 'Conference Center', '24/7 Security'],
    bedrooms: null,
    bathrooms: null,
    documents: [
      { name: 'Property Deed', url: '#' },
      { name: 'Tenant Agreements', url: '#' },
      { name: 'Financial Projections', url: '#' },
    ],
    returnRate: 7.8,
  },
  {
    id: '4',
    title: 'Mountain Retreat',
    description:
      'Secluded luxury cabin nestled in the mountains with breathtaking views. This property combines rustic charm with modern amenities, featuring exposed wooden beams, a stone fireplace, and a private hot tub.',
    imageUrl:
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=1530&q=80',
    location: 'Aspen, CO',
    price: 875000,
    tokenPrice: 0.875,
    totalTokens: 1000,
    tokensSold: 0,
    status: 'Coming Soon',
    features: ['4 Bedrooms', '3 Bathrooms', '2,800 sq ft', 'Hot Tub', 'Fireplace', '2-Car Garage'],
    bedrooms: 4,
    bathrooms: 3,
    documents: [
      { name: 'Property Deed', url: '#' },
      { name: 'Financial Projections', url: '#' },
      { name: 'Inspection Report', url: '#' },
    ],
    returnRate: 9.1,
  },
  {
    id: '5',
    title: 'Urban Retail Space',
    description:
      'High-traffic retail location in a trendy urban neighborhood. This corner unit features large display windows, modern interior, and is surrounded by complementary businesses that drive consistent foot traffic.',
    imageUrl:
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1374&q=80',
    location: 'Austin, TX',
    price: 680000,
    tokenPrice: 0.68,
    totalTokens: 1000,
    tokensSold: 520,
    status: 'Available',
    features: ['2,000 sq ft', 'Corner Location', 'High Foot Traffic', 'Recently Renovated', 'Storage Space', 'Outdoor Seating'],
    bedrooms: null,
    bathrooms: null,
    documents: [
      { name: 'Property Deed', url: '#' },
      { name: 'Market Analysis', url: '#' },
      { name: 'Financial Projections', url: '#' },
    ],
    returnRate: 8.7,
  },
  {
    id: '6',
    title: 'Historic Brownstone',
    description:
      'Beautifully restored historic brownstone in a prestigious neighborhood. This property combines classic architectural details with modern updates in one of the most sought-after locations.',
    imageUrl:
      'https://images.unsplash.com/photo-1448630360428-65456885c650?ixlib=rb-4.0.3&auto=format&fit=crop&w=1467&q=80',
    location: 'Boston, MA',
    price: 1850000,
    tokenPrice: 1.85,
    totalTokens: 1000,
    tokensSold: 780,
    status: 'Available',
    features: ['4 Bedrooms', '3.5 Bathrooms', '3,200 sq ft', 'Original Hardwood Floors', 'Garden', 'Finished Basement'],
    bedrooms: 4,
    bathrooms: 3.5,
    documents: [
      { name: 'Property Deed', url: '#' },
      { name: 'Historic Designation', url: '#' },
      { name: 'Renovation Permits', url: '#' },
    ],
    returnRate: 6.9,
  },
];

const OPS = {
  1: {
    occupancyPercent: 96,
    capRate: 5.8,
    grossRentMonthly: 3200,
    opexMonthly: 900,
    reservesMonthly: 200,
    nextAppraisalAt: '2026-12-01',
    appraisals: [{ date: '2026-06-01', valueUsd: 465000, note: 'Mid-year desktop appraisal' }],
  },
  2: {
    occupancyPercent: 88,
    capRate: 6.1,
    grossRentMonthly: 8500,
    opexMonthly: 2800,
    reservesMonthly: 400,
    nextAppraisalAt: '2026-11-15',
    appraisals: [{ date: '2026-05-20', valueUsd: 1250000, note: 'Seasonal rental appraisal' }],
  },
  3: {
    occupancyPercent: 100,
    capRate: 6.4,
    grossRentMonthly: 22000,
    opexMonthly: 7000,
    reservesMonthly: 1500,
    nextAppraisalAt: '2027-01-10',
    appraisals: [{ date: '2026-01-15', valueUsd: 3600000, note: 'Year-end MAI appraisal' }],
  },
  4: {
    occupancyPercent: 0,
    capRate: 5.5,
    grossRentMonthly: 0,
    opexMonthly: 0,
    reservesMonthly: 0,
    nextAppraisalAt: '2026-10-15',
    appraisals: [],
  },
  5: {
    occupancyPercent: 94,
    capRate: 6.8,
    grossRentMonthly: 4800,
    opexMonthly: 1400,
    reservesMonthly: 300,
    nextAppraisalAt: '2026-09-30',
    appraisals: [{ date: '2026-03-01', valueUsd: 700000, note: 'Retail corridor update' }],
  },
  6: {
    occupancyPercent: 97,
    capRate: 5.2,
    grossRentMonthly: 11000,
    opexMonthly: 3600,
    reservesMonthly: 500,
    nextAppraisalAt: '2026-12-20',
    appraisals: [{ date: '2026-04-12', valueUsd: 1900000, note: 'Historic district comps' }],
  },
};

const CMS = {
  1: {
    lat: 40.758,
    lng: -73.9855,
    unitMix: '1× 3BR / 2BA condo, 1,800 sq ft',
    galleryUrls: [
      'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1470&q=80',
    ],
    comps: [
      { address: '210 W 55th St, New York, NY', soldDate: '2026-03-12', priceUsd: 465000, sqft: 1750, note: 'Same tower, lower floor' },
      { address: '45 W 54th St, New York, NY', soldDate: '2026-01-08', priceUsd: 438000, sqft: 1680, note: 'Illustrative nearby sale' },
      { address: '15 Columbus Cir, New York, NY', soldDate: '2025-11-20', priceUsd: 510000, sqft: 1920, note: 'Newer finish package' },
    ],
  },
  2: {
    lat: 25.7617,
    lng: -80.1918,
    unitMix: '1× 5BR / 6BA villa, 4,500 sq ft',
    galleryUrls: [
      'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    ],
    comps: [
      { address: '88 Ocean Dr, Miami Beach, FL', soldDate: '2026-02-02', priceUsd: 1180000, sqft: 4300, note: 'Waterfront comparable' },
      { address: '12 Palm Isle, Miami, FL', soldDate: '2025-10-15', priceUsd: 1095000, sqft: 4100, note: 'Illustrative sale' },
    ],
  },
  3: {
    lat: 41.8781,
    lng: -87.6298,
    unitMix: '10 floors, 25,000 sq ft office',
    galleryUrls: [
      'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80',
    ],
    comps: [
      { address: '200 S Wacker Dr, Chicago, IL', soldDate: '2026-04-01', priceUsd: 3400000, sqft: 24000, note: 'CBD office trade' },
      { address: '111 W Monroe St, Chicago, IL', soldDate: '2025-09-18', priceUsd: 3650000, sqft: 26000, note: 'Illustrative nearby' },
    ],
  },
  4: {
    lat: 39.1911,
    lng: -106.8175,
    unitMix: '1× 4BR / 3BA cabin, 2,800 sq ft',
    galleryUrls: [
      'https://images.unsplash.com/photo-1518780664697-55e3ad937233?ixlib=rb-4.0.3&auto=format&fit=crop&w=1530&q=80',
    ],
    comps: [
      { address: '412 Hunter Creek Rd, Aspen, CO', soldDate: '2026-01-22', priceUsd: 890000, sqft: 2700, note: 'Mountain comparable' },
    ],
  },
  5: {
    lat: 30.2672,
    lng: -97.7431,
    unitMix: '1× 2,000 sq ft corner retail',
    galleryUrls: [
      'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=1374&q=80',
    ],
    comps: [
      { address: '1400 S Congress Ave, Austin, TX', soldDate: '2026-03-04', priceUsd: 695000, sqft: 1900, note: 'South Congress retail' },
      { address: '501 Barton Springs Rd, Austin, TX', soldDate: '2025-12-09', priceUsd: 640000, sqft: 1850, note: 'Illustrative sale' },
    ],
  },
  6: {
    lat: 42.3601,
    lng: -71.0589,
    unitMix: '1× 4BR / 3.5BA brownstone, 3,200 sq ft',
    galleryUrls: [
      'https://images.unsplash.com/photo-1448630360428-65456885c650?ixlib=rb-4.0.3&auto=format&fit=crop&w=1467&q=80',
    ],
    comps: [
      { address: '22 Beacon St, Boston, MA', soldDate: '2026-02-14', priceUsd: 1790000, sqft: 3100, note: 'Historic district sale' },
      { address: '8 Pinckney St, Boston, MA', soldDate: '2025-08-30', priceUsd: 1920000, sqft: 3300, note: 'Illustrative nearby' },
    ],
  },
};

for (const property of properties) {
  Object.assign(property, OPS[property.id] || {}, CMS[property.id] || {});
}

module.exports = { properties };
