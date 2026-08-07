export type GarageEntry = 'front' | 'side'

export interface HomePlan {
  id: string
  name: string
  subtitle: string
  builder: string
  /** Photoreal marketing elevation (picker cards + reference) */
  elevationImg: string
  /**
   * Transparent photoreal cutout placed on the lot in Studio.
   * This is the buyer-facing house visual — not a procedural box massing.
   */
  cutoutImg: string
  floorplanImg: string
  /** Full construction PDF (builder-supplied) */
  pdfUrl: string
  livingArea: string
  beds: string
  baths: string
  garage: string
  garageEntry: GarageEntry
  /**
   * Horizontal garage-door center on the front elevation, as a fraction of
   * house width from center (−0.5 left … +0.5 right). Used so the driveway
   * aims at the garage, not the front door.
   */
  garageXFrac: number
  porches: string[]
  highlights: string[]
  // Approximate building footprint from the dimensioned floor plan —
  // used to scale the massing on a lot in the visualizer.
  footprintFt: { width: number; depth: number }
}

/**
 * Builder plans we offer buyers to drop onto a Stadium lot.
 * Specs read from Risen Home Design / Blackstone construction PDFs
 * in public/plans/. Photo upload remains available as a custom path.
 */
export const homePlans: HomePlan[] = [
  {
    id: 'brownstone',
    name: 'The Brownstone',
    subtitle: 'Front-facing garage + RV bay',
    builder: 'Blackstone Homes',
    elevationImg: '/plans/brownstone-elevation.jpg?v=drive10',
    cutoutImg: '/plans/cutouts/brownstone.png?v=drive10',
    floorplanImg: '/plans/thumbs/brownstone-floorplan.jpg',
    pdfUrl: '/plans/brownstone-15-2-rwr.pdf',
    livingArea: '~2,880 sq ft living',
    beds: '4 bedrooms + tech room',
    baths: '3.5 baths',
    garage: 'Garage + tall RV bay (both front-facing)',
    garageEntry: 'front',
    // Marketing elevation: garage door sits on the far right
    garageXFrac: 0.38,
    porches: ['Covered front porch', 'Covered rear porch'],
    highlights: [
      'Great room open to kitchen and dining',
      'Master suite with walk-in closet',
      'Tech room / flex space off the entry',
      'Mudroom and walk-in pantry',
      'Front-facing garage with dedicated RV bay',
    ],
    // Overall exterior from floor plan sheets (~91′ × ~72′)
    footprintFt: { width: 91, depth: 72 },
  },
  {
    id: 'whitestone-front',
    name: 'The Whitestone',
    subtitle: 'Front-facing garage + RV (left)',
    builder: 'Blackstone Homes',
    elevationImg: '/plans/whitestone-elevation.jpg?v=drive10',
    cutoutImg: '/plans/cutouts/whitestone.png?v=drive10',
    floorplanImg: '/plans/thumbs/whitestone-front-floorplan.jpg',
    pdfUrl: '/plans/whitestone-7-2-rwr.pdf',
    livingArea: '~2,140 sq ft living',
    beds: '3–4 bedrooms (office / flex)',
    baths: '2.5 baths',
    garage: 'Tall RV bay + two-car garage (both front-facing, street-left)',
    garageEntry: 'front',
    // Street-left garage wing (matches builder front elevation / ArchyBase refs)
    garageXFrac: -0.28,
    // Photoreal wraps: public/plans/refs/whitestone-front.png (+ rear)
    porches: ['Covered front porch', 'Covered rear porch'],
    highlights: [
      'Modern farmhouse elevation with timber-truss entry',
      'Great room with vaulted ceiling',
      'Flexible office / third bedroom',
      'Mud room with utility',
      'Front-facing RV bay + two-car garage on the left',
    ],
    footprintFt: { width: 94, depth: 70 },
  },
  {
    id: 'whitestone-side',
    name: 'The Whitestone',
    subtitle: 'Side-entry garage',
    builder: 'Blackstone Homes',
    // Side-entry plan uses the same Whitestone marketing render until a
    // dedicated side-entry exterior photo is supplied.
    elevationImg: '/plans/whitestone-elevation.jpg?v=drive10',
    cutoutImg: '/plans/cutouts/whitestone.png?v=drive10',
    floorplanImg: '/plans/thumbs/whitestone-side-floorplan.jpg',
    pdfUrl: '/plans/whitestone-29-3-pse.pdf',
    livingArea: '~2,140 sq ft living',
    beds: '3–4 bedrooms (office / flex)',
    baths: '2.5 baths',
    garage: 'Side-entry two-car + front-facing tall RV bay',
    garageEntry: 'side',
    // Side-entry: approach the left wing until a dedicated elevation is supplied
    garageXFrac: -0.36,
    porches: ['Covered front porch', 'Covered rear porch'],
    highlights: [
      'Same Whitestone living layout, side-loaded garage',
      'Main garage doors face the side yard',
      'Tall RV bay still readable from the street',
      'Quieter front elevation for narrower approaches',
      'Great room with vaulted ceiling',
    ],
    footprintFt: { width: 94, depth: 78 },
  },
]

/** Plans shown in Lot Studio’s one-click catalog (same as marketing for now). */
export const studioPlans = homePlans

export function getPlan(id: string | null | undefined): HomePlan | undefined {
  if (!id) return undefined
  return homePlans.find((p) => p.id === id)
}
