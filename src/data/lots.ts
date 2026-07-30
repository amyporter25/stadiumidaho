export type LotStatus = 'Available' | 'Under Contract' | 'Sold' | 'Coming Soon'

export type LotType = 'Vacant Lot' | 'Model Home' | 'Spec Home' | 'Custom Home'

export interface LotHome {
  beds: string
  baths: string
  livingArea: string
  builder: string
}

export interface Lot {
  id: string
  title: string
  phase: string
  status: LotStatus
  type: LotType
  img: string
  tagline: string
  description: string[]
  features: string[]
  price: string
  priceNote: string
  lotSize: string
  dimensions: string
  zoning: string
  utilities: string
  hoa: string
  home?: LotHome
  coordinates?: { lat: number; lng: number }
}

export const community = {
  name: 'Seaside Estates',
  // Approximate center of The Stadium subdivision, Caldwell, ID —
  // replace with surveyed coordinates when the real plat data lands.
  center: { lat: 43.68, lng: -116.67 },
  defaultZoom: 16,
  eyebrow: 'A Coastal Residential Community · Now Selling',
  tagline: 'Where the Coast\nBecomes Home',
  intro:
    'Seaside Estates is a gated coastal subdivision of 24 homesites set along a quiet stretch of shoreline — some offered as build-ready vacant lots, others with completed or under-construction homes. Every lot is a short walk from the water.',
}

// NOTE: Placeholder imagery and copy — replace with real lot data, photos,
// and pricing as it becomes available.
export const lots: Lot[] = [
  {
    id: '01',
  coordinates: { lat: 43.68000, lng: -116.66550 },
    title: 'Lot 01 — Breakers Point',
    phase: 'Phase I · Oceanfront',
    status: 'Available',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&h=900&fit=crop&q=80',
    tagline: 'A direct oceanfront parcel with nothing between you and the horizon.',
    description: [
      'Breakers Point sits at the eastern tip of Phase I, where the dune line opens to an unobstructed view of open water. The lot is cleared, graded, and build-ready, with a surveyed building envelope that protects the dune vegetation on either side.',
      'Sunrises here are unobstructed. The lot’s elevation — one of the highest on the oceanfront row — gives a future home a commanding view while keeping the structure well above the flood plain.',
    ],
    features: [
      'Direct ocean frontage, 105 ft of shoreline',
      'Cleared and graded, build-ready today',
      'Surveyed building envelope with dune protection',
      'Elevated lot, above the 100-year flood plain',
      'Underground utilities at the lot line',
      'Beach walkover directly adjacent',
    ],
    price: '$1,250,000',
    priceNote: 'list price, vacant land',
    lotSize: '0.42 acres',
    dimensions: '105 ft × 172 ft',
    zoning: 'Residential R-1',
    utilities: 'Water, sewer, electric, fiber at lot line',
    hoa: '$180 / month',
  },
  {
    id: '02',
  coordinates: { lat: 43.68509, lng: -116.66491 },
    title: 'Lot 02 — The Sandpiper',
    phase: 'Phase I · Oceanfront',
    status: 'Available',
    type: 'Model Home',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=900&fit=crop&q=80',
    tagline: 'A completed model home, two rows back with a rooftop ocean view.',
    description: [
      'The Sandpiper is the community’s first completed model — a four-bedroom coastal contemporary by our founding builder, offered fully furnished and ready for immediate occupancy. Wide porches on both levels face the water.',
      'The plan was designed for this lot: a great room oriented to the sunrise, a bunk room for grandchildren, and an outdoor shower tucked off the primary suite. The rooftop terrace is the signature — a full 360° view of ocean, marsh, and the community green.',
    ],
    features: [
      'Move-in ready, sold fully furnished',
      'Rooftop terrace with panoramic ocean view',
      'Two full-width covered porches',
      'Impact-rated windows and metal roof',
      'Outdoor shower and ground-level storage',
      'Golf cart included with purchase',
    ],
    price: '$2,895,000',
    priceNote: 'list price, home and lot included',
    lotSize: '0.38 acres',
    dimensions: '95 ft × 168 ft',
    zoning: 'Residential R-1',
    utilities: 'Water, sewer, electric, fiber connected',
    hoa: '$180 / month',
    home: {
      beds: '4 bedrooms',
      baths: '4 full, 1 half',
      livingArea: '3,400 sq ft',
      builder: 'Tidewater Building Co.',
    },
  },
  {
    id: '03',
  coordinates: { lat: 43.68450, lng: -116.67000 },
    title: 'Lot 03 — Dune Grass Parcel',
    phase: 'Phase I · Oceanfront',
    status: 'Under Contract',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1600&h=900&fit=crop&q=80',
    tagline: 'Oceanfront lot under contract — join the waitlist for similar parcels.',
    description: [
      'One of the original oceanfront parcels, Lot 03 went under contract shortly after Phase I released. Its wide, flat building pad and mature dune grasses made it one of the most requested lots in the community.',
      'If this is the kind of homesite you’re looking for, let us know — Phase III will release four comparable oceanfront parcels, and waitlisted buyers are notified before the public release.',
    ],
    features: [
      'Direct ocean frontage, 100 ft of shoreline',
      'Wide, level building pad',
      'Mature dune vegetation on both flanks',
      'Underground utilities at the lot line',
      'Similar lots releasing in Phase III',
      'Waitlist open for comparable parcels',
    ],
    price: '$1,195,000',
    priceNote: 'under contract — waitlist available',
    lotSize: '0.40 acres',
    dimensions: '100 ft × 170 ft',
    zoning: 'Residential R-1',
    utilities: 'Water, sewer, electric, fiber at lot line',
    hoa: '$180 / month',
  },
  {
    id: '04',
  coordinates: { lat: 43.68509, lng: -116.67509 },
    title: 'Lot 04 — Marshlight',
    phase: 'Phase II · Dune Ridge',
    status: 'Available',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&h=900&fit=crop&q=80',
    tagline: 'A sunset-facing lot on the marsh side of the ridge.',
    description: [
      'On the western slope of Dune Ridge, Marshlight trades the morning sun for the evening one. The lot backs directly onto the tidal marsh, where herons and egrets work the creek at low tide.',
      'It’s one of the deepest lots in Phase II, with room for a main house, guest cottage, and pool within the building envelope. The community dock is a two-minute golf cart ride away.',
    ],
    features: [
      'Direct marsh frontage with sunset views',
      'Deep lot — room for guest cottage and pool',
      'Backs onto protected tidal marsh',
      'Two minutes to the community dock',
      'Underground utilities at the lot line',
      'No rear neighbors, ever',
    ],
    price: '$685,000',
    priceNote: 'list price, vacant land',
    lotSize: '0.51 acres',
    dimensions: '110 ft × 198 ft',
    zoning: 'Residential R-1',
    utilities: 'Water, sewer, electric, fiber at lot line',
    hoa: '$180 / month',
  },
  {
    id: '05',
  coordinates: { lat: 43.68000, lng: -116.67450 },
    title: 'Lot 05 — The Heron House',
    phase: 'Phase II · Dune Ridge',
    status: 'Available',
    type: 'Spec Home',
    img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop&q=80',
    tagline: 'A spec home under construction — choose your finishes now.',
    description: [
      'The Heron House is framed, roofed, and dried in — which means the hard part is done, but the finishes are still yours to choose. Buyers who close in the next phase of construction select cabinetry, counters, flooring, and fixtures from the builder’s design studio.',
      'The plan centers on a vaulted great room with a wall of glass facing the marsh. Three bedrooms plus a study, with a screened porch running the full width of the rear elevation.',
    ],
    features: [
      'Framed and dried in — finish selections still open',
      'Vaulted great room with marsh-facing glass',
      'Full-width screened rear porch',
      'Estimated completion within 6 months',
      '10-year structural warranty included',
      'Lock in current pricing before completion',
    ],
    price: '$1,975,000',
    priceNote: 'list price, home and lot included',
    lotSize: '0.44 acres',
    dimensions: '100 ft × 185 ft',
    zoning: 'Residential R-1',
    utilities: 'Water, sewer, electric, fiber connected',
    hoa: '$180 / month',
    home: {
      beds: '3 bedrooms + study',
      baths: '3 full, 1 half',
      livingArea: '2,850 sq ft',
      builder: 'Tidewater Building Co.',
    },
  },
  {
    id: '06',
  coordinates: { lat: 43.67491, lng: -116.67509 },
    title: 'Lot 06 — Ridge Corner',
    phase: 'Phase II · Dune Ridge',
    status: 'Sold',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1505843513577-22bb7d21e455?w=1600&h=900&fit=crop&q=80',
    tagline: 'Sold — a corner homesite at the ridge’s highest point.',
    description: [
      'Ridge Corner was the highest-elevation lot in Phase II, and the first to sell. The new owners plan a custom build beginning later this year.',
      'Corner lots with this elevation are limited. Two comparable homesites remain in Phase II, and more are planned for the Phase III release.',
    ],
    features: [
      'Highest elevation in Phase II',
      'Corner homesite, two street frontages',
      'Sold to a custom-home buyer',
      'Comparable lots still available',
      'Phase III will add similar inventory',
    ],
    price: '$710,000',
    priceNote: 'sold',
    lotSize: '0.47 acres',
    dimensions: '115 ft × 180 ft',
    zoning: 'Residential R-1',
    utilities: 'Water, sewer, electric, fiber at lot line',
    hoa: '$180 / month',
  },
  {
    id: '07',
  coordinates: { lat: 43.67550, lng: -116.67000 },
    title: 'Lot 07 — Creekbend',
    phase: 'Phase III · Marsh Walk',
    status: 'Coming Soon',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&h=900&fit=crop&q=80',
    tagline: 'A creek-side parcel in the upcoming Marsh Walk release.',
    description: [
      'Creekbend anchors the Phase III release: a wide parcel where the tidal creek bends around a stand of old oaks. The lot will be released with final plat approval, expected later this year.',
      'Marsh Walk is the community’s final phase — nine homesites along the creek and marsh edge. Join the interest list to receive the release date and pricing before the public announcement.',
    ],
    features: [
      'Creek frontage with private dock potential',
      'Canopy of mature live oaks on the lot',
      'Part of the final phase — nine homesites',
      'Releasing with final plat approval',
      'Interest list open now',
      'Priority preview for waitlisted buyers',
    ],
    price: 'TBD',
    priceNote: 'pricing released with Phase III',
    lotSize: 'Approx. 0.5 acres',
    dimensions: 'Final survey pending',
    zoning: 'Residential R-1',
    utilities: 'Utilities planned to lot line',
    hoa: '$180 / month',
  },
  {
    id: '08',
  coordinates: { lat: 43.67491, lng: -116.66491 },
    title: 'Lot 08 — The Marshwalk Cottage',
    phase: 'Phase III · Marsh Walk',
    status: 'Coming Soon',
    type: 'Custom Home',
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=900&fit=crop&q=80',
    tagline: 'A planned cottage design paired with a marsh-edge homesite.',
    description: [
      'The Marshwalk Cottage is a house-and-lot pairing planned for Phase III: a three-bedroom lowcountry cottage designed specifically for this marsh-edge homesite, with a detached garage and screened porch facing the water.',
      'Plans are complete and permitted-ready. Buyers who reserve the pairing early can still customize interior finishes and the exterior palette with the design team.',
    ],
    features: [
      'House-and-lot pairing, plans complete',
      'Lowcountry cottage design, raised foundation',
      'Detached two-car garage with storage loft',
      'Screened porch facing the marsh',
      'Finish customization available pre-build',
      'Releasing with Phase III',
    ],
    price: 'TBD',
    priceNote: 'pricing released with Phase III',
    lotSize: 'Approx. 0.45 acres',
    dimensions: 'Final survey pending',
    zoning: 'Residential R-1',
    utilities: 'Utilities planned to lot line',
    hoa: '$180 / month',
    home: {
      beds: '3 bedrooms',
      baths: '2 full, 1 half',
      livingArea: 'Approx. 2,300 sq ft',
      builder: 'Tidewater Building Co.',
    },
  },
]
