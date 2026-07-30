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
  name: 'The Stadium',
  // Approximate center of The Stadium subdivision, Caldwell, ID
  // (NW corner of Goodson Rd & Wagner Rd). Will be refined to surveyed
  // accuracy when the plat is geo-referenced against the section corner.
  center: { lat: 43.76584, lng: -116.7378 },
  defaultZoom: 16,
  eyebrow: 'North Caldwell, Idaho · Now Selling',
  tagline: 'Room to Live.\nSpace to Breathe.',
  intro:
    'The Stadium is a custom-home community in north Caldwell, west of Wagner Road and north of Goodson Road — 1+ acre homesites with mountain views, an equestrian-friendly trail system, and oversized lots built for shops, RV parking, and real elbow room.',
}

// STATUS NOTE: statuses and prices are placeholders until wired to the
// Groove feed. Lot sizes and streets are real — from the recorded final
// plat (Stadium Subdivision No. 2 – Phase 2, Canyon County, 2025) and
// current IMLS listings.
export const lots: Lot[] = [
  {
    id: '01',
  coordinates: { lat: 43.76584, lng: -116.73330 },
    title: 'Iron Horse Dr Lot',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1600&h=900&fit=crop&q=80',
    tagline: 'A full acre on Iron Horse Drive with open views in every direction.',
    description: [
      'One of the available homesites along Iron Horse Drive — a full acre of level ground ready for a custom build. The lot sits within the established first phase of The Stadium, with paved streets and power at the lot line.',
      'Like every lot in the community, there’s room here for the things city lots can’t hold: a detached shop, RV parking, a real backyard. Mountain views come standard.',
    ],
    features: [
      '1.0 acre level homesite',
      'Paved street access on Iron Horse Dr',
      'Room for detached shop and RV parking',
      'Mountain views',
      'Middleton School District',
      'Choose your own builder',
    ],
    price: 'Contact for pricing',
    priceNote: 'vacant land',
    lotSize: '1.00 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
  },
  {
    id: '02',
  coordinates: { lat: 43.76334, lng: -116.73780 },
    title: '27296 Iron Horse Dr',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1505843513577-22bb7d21e455?w=1600&h=900&fit=crop&q=80',
    tagline: 'Over two acres on Iron Horse Drive — one of the larger lots in the community.',
    description: [
      'At just over two acres, 27296 Iron Horse Dr offers roughly double the elbow room of a standard Stadium homesite. The extra ground opens up options: a larger shop, a horse setup, a pool and sport court, or simply more distance from the neighbors.',
      'The lot fronts paved Iron Horse Drive within the community’s established streetscape.',
    ],
    features: [
      '2.05 acres — among the largest lots available',
      'Paved street frontage',
      'Room for shop, horses, pool, or sport court',
      'Equestrian-friendly trail system nearby',
      'Middleton School District',
      'Choose your own builder',
    ],
    price: 'Contact for pricing',
    priceNote: 'vacant land',
    lotSize: '2.05 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
  },
  {
    id: '03',
  coordinates: { lat: 43.76834, lng: -116.73780 },
    title: '17216 Pins Triple Ct',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=1600&h=900&fit=crop&q=80',
    tagline: 'A cul-de-sac homesite on Pins Triple Court.',
    description: [
      'Tucked on Pins Triple Court, this 1.11-acre homesite trades through-traffic for quiet. Cul-de-sac positioning means the only vehicles past your driveway belong to neighbors.',
      'A level, build-ready acre-plus with the community trail system a short walk away.',
    ],
    features: [
      '1.11 acres on a quiet court',
      'Minimal traffic, cul-de-sac setting',
      'Level, build-ready ground',
      'Community trail access nearby',
      'Middleton School District',
      'Choose your own builder',
    ],
    price: 'Contact for pricing',
    priceNote: 'vacant land',
    lotSize: '1.11 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
  },
  {
    id: '04',
  coordinates: { lat: 43.76584, lng: -116.74230 },
    title: 'Commerce Comet Way — New Build',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Spec Home',
    img: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&h=900&fit=crop&q=80',
    tagline: 'A five-bedroom new build on an acre, under construction on Commerce Comet Way.',
    description: [
      'A 3,620-square-foot custom home now under construction on a 1.06-acre Commerce Comet Way lot. Five bedrooms, four baths, and the oversized garage and shop-ready layout the community is known for.',
      'Buying during construction means locking in the plan while it’s still possible to make finish selections with the builder.',
    ],
    features: [
      'Under construction — completion timeline on request',
      'Oversized garage, shop-ready layout',
      '1.06-acre lot with mountain views',
      'Custom builder, luxury finishes',
      'Middleton School District',
      'Listed through IMLS',
    ],
    price: '$1,275,000',
    priceNote: 'list price, home and lot',
    lotSize: '1.06 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
    home: {
      beds: '5 bedrooms',
      baths: '4 baths',
      livingArea: '3,620 sq ft',
      builder: 'Listed by JPAR Live Local',
    },
  },
  {
    id: '05',
  coordinates: { lat: 43.76584, lng: -116.73780 },
    title: 'Commerce Comet Way — New Build',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Spec Home',
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&h=900&fit=crop&q=80',
    tagline: 'A second five-bedroom plan on Commerce Comet Way.',
    description: [
      'A 3,605-square-foot custom home on a 1.02-acre Commerce Comet Way lot — five bedrooms and four baths with the generous layouts and high-end finishes The Stadium’s builders are delivering throughout the community.',
      'Ask about the current construction stage and which selections remain open to a buyer.',
    ],
    features: [
      'Under construction — completion timeline on request',
      'Spacious five-bedroom plan',
      '1.02-acre lot with open views',
      'Custom builder, luxury finishes',
      'Middleton School District',
      'Listed through IMLS',
    ],
    price: '$1,200,000',
    priceNote: 'list price, home and lot',
    lotSize: '1.02 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
    home: {
      beds: '5 bedrooms',
      baths: '4 baths',
      livingArea: '3,605 sq ft',
      builder: 'Listed by JPAR Live Local',
    },
  },
  {
    id: '06',
  coordinates: { lat: 43.76834, lng: -116.74230 },
    title: 'Iron Horse Dr — New Build',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Spec Home',
    img: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1600&h=900&fit=crop&q=80',
    tagline: 'A three-bedroom custom home on a full acre on Iron Horse Drive.',
    description: [
      'A 2,895-square-foot custom home on a one-acre Iron Horse Drive lot. Three bedrooms, four baths, and an efficient single-level-friendly plan that keeps the lot’s open feel.',
      'A strong option for buyers who want the acreage lifestyle without maintaining a five-bedroom footprint.',
    ],
    features: [
      'New construction on Iron Horse Dr',
      'Efficient plan on a full acre',
      'Room for shop and RV parking',
      'Custom builder, luxury finishes',
      'Middleton School District',
      'Listed through IMLS',
    ],
    price: '$1,155,000',
    priceNote: 'list price, home and lot',
    lotSize: '1.00 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
    home: {
      beds: '3 bedrooms',
      baths: '4 baths',
      livingArea: '2,895 sq ft',
      builder: 'Listed by JPAR Live Local',
    },
  },
  {
    id: '07',
  coordinates: { lat: 43.76334, lng: -116.73330 },
    title: 'Triple Crown Pl Lot',
    phase: 'Stadium Subdivision · Phase 1',
    status: 'Available',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1600&h=900&fit=crop&q=80',
    tagline: 'An acre-plus on Triple Crown Place.',
    description: [
      'A 1.01-acre homesite on Triple Crown Place — level ground, open sky, and the freedom to bring your own builder and plan.',
      'One of the remaining vacant lots in the community’s first phase, with streets and neighboring custom homes already established.',
    ],
    features: [
      '1.01 acres, level and build-ready',
      'Established streetscape',
      'Bring your own builder and plan',
      'Room for shop and RV parking',
      'Middleton School District',
      'Equestrian-friendly trails',
    ],
    price: 'Contact for pricing',
    priceNote: 'vacant land',
    lotSize: '1.01 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Power at lot line; well & septic',
    hoa: 'Contact for details',
  },
  {
    id: '08',
  coordinates: { lat: 43.76834, lng: -116.73330 },
    title: 'Phase 2 Homesites',
    phase: 'Stadium Subdivision No. 2 · Phase 2',
    status: 'Coming Soon',
    type: 'Vacant Lot',
    img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&h=900&fit=crop&q=80',
    tagline: 'The next release: 60+ new homesites off Moscow Way and Goodson Road.',
    description: [
      'Phase 2 replats a portion of the original Stadium Subdivision into more than sixty new homesites, ranging from compact 0.35-acre lots to parcels over 3 acres, organized around Moscow Way and the community’s second entrance off Goodson Road.',
      'The plat is recorded with Canyon County (2025). Join the interest list to be notified when lot-by-lot pricing and availability are released.',
    ],
    features: [
      '60+ homesites from 0.35 to 3.27 acres',
      'Organized around Moscow Way',
      'Recorded plat, Canyon County 2025',
      'Multiple blocks and cul-de-sacs',
      'Interest list open now',
      'Priority notice for waitlisted buyers',
    ],
    price: 'TBD',
    priceNote: 'pricing released with Phase 2',
    lotSize: '0.35 – 3.27 acres',
    dimensions: 'Per recorded plat',
    zoning: 'Residential',
    utilities: 'Improvements per Phase 2 plat',
    hoa: 'Contact for details',
  },
]
