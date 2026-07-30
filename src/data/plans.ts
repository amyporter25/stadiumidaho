export interface HomePlan {
  id: string
  name: string
  builder: string
  elevationImg: string
  floorplanImg: string
  livingArea: string
  beds: string
  baths: string
  garage: string
  porches: string[]
  highlights: string[]
  // Approximate building footprint, from the dimensioned floor plan —
  // used to scale the plan on a lot in the future visualizer.
  footprintFt: { width: number; depth: number }
}

// Plans offered by the community's builders. Specs read from the
// builder-supplied floor plans; verify against the builder's current
// spec sheet before publishing pricing.
export const homePlans: HomePlan[] = [
  {
    id: 'brownstone',
    name: 'The Brownstone',
    builder: 'Blackstone Homes',
    elevationImg: '/plans/brownstone-elevation.jpg',
    floorplanImg: '/plans/brownstone-floorplan.png',
    livingArea: '2,882 sq ft',
    beds: '3 bedrooms + pocket office',
    baths: '2.5 baths',
    garage: 'Two garages: 25′-6″ × 28′-11″ + 17′ × 49′ RV bay',
    porches: ['Front porch 11′-11″ × 14′-4″', 'Rear porch 11′ × 11′-10″'],
    highlights: [
      '16′ × 17′-4″ great room open to kitchen and dining',
      'Master suite with safe room and walk-in closet',
      'Pocket office off the entry',
      'Mudroom and walk-in pantry',
      '49-foot RV-height garage bay',
    ],
    footprintFt: { width: 96, depth: 78 },
  },
  {
    id: 'whitestone',
    name: 'The Whitestone',
    builder: 'Blackstone Homes',
    elevationImg: '/plans/whitestone-elevation.jpg',
    floorplanImg: '/plans/whitestone-floorplan.png',
    livingArea: '2,141 sq ft',
    beds: '2 bedrooms + office/bedroom',
    baths: '2.5 baths',
    garage: 'Two garages: 21′ × 33′-6″ + 17′ × 49′ RV bay',
    porches: ['Front porch 22′-6″ × 9′-10″', 'Rear porch 35′ × 10′-10″'],
    highlights: [
      'Modern farmhouse elevation with timber-truss entry',
      '18′-2″ × 22′-1″ living room',
      'Flexible office/third bedroom',
      'Mud room with pet wash',
      '35-foot covered rear porch',
    ],
    footprintFt: { width: 94, depth: 82 },
  },
  {
    id: 'sunstone',
    name: 'The Sunstone',
    builder: 'Blackstone Homes',
    elevationImg: '/plans/sunstone-elevation.png',
    floorplanImg: '/plans/sunstone-floorplan.png',
    livingArea: 'Approx. 2,500 sq ft',
    beds: '2 bedrooms + office + guest suite',
    baths: '3 baths',
    garage: 'Garage + 16′ tall RV bay',
    porches: ['Covered patio', 'Covered front porch'],
    highlights: [
      'Stone-and-board-and-batten farmhouse elevation',
      '16-foot tall RV bay with its own driveway approach',
      'Dedicated office off the entry',
      'Separate guest suite',
      'Covered patio off the living room',
    ],
    footprintFt: { width: 104, depth: 72 },
  },
]
