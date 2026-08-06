# Lot Studio (Track B)

Isolated experience at **`/studio`**.

## What it is now (lot-first)

The default Studio is **not** the Polycam Gaussian splat. Site-wide drone
splats of bare dirt read as blotchy blobs in the browser and are not useful
for selling a lot.

Default experience:

1. Pick a lot from the plat (`?lot=46/3`, etc.)
2. See **real aerial photography** of that homesite
3. See the **lot boundary** (and neighbors) from the plat GeoJSON
4. **Drop a builder plan** (primary) — Brownstone or Whitestone — as the
   **photoreal marketing elevation cutout** (same look as the builder’s render),
   scaled to the plan footprint on the lot
5. **Driveway** auto-simulates from the street front to the garage apron, with
   a ballpark concrete/asphalt cost that updates as you move the house
6. **Landscaping** mode places trees, evergreens, shrubs, and lawn patches
   (also tallied as a rough extras estimate)
7. Or **upload a house photo** → background cutout → place/scale/rotate in feet

Cutouts live in `public/plans/cutouts/`. Do **not** drape PDF line-art elevations
onto box massings — that reads as a broken mash-up.

## Builder plans

Construction PDFs live in `public/plans/`:

| Plan | File | Garage |
|------|------|--------|
| Brownstone | `brownstone-15-2-rwr.pdf` | Front-facing + RV bay |
| Whitestone · front | `whitestone-7-2-rwr.pdf` | Front-facing garage + RV bay |
| Whitestone · side | `whitestone-29-3-pse.pdf` | Side-entry garage + front RV bay |

Catalog + footprints: `src/data/plans.ts`. Massings: `src/components/lotVisualizer/houses.ts`.

## Optional splat experiment

`/studio?world=splat` only shows an explanation + Polycam link. The raw capture
remains at:

https://poly.cam/capture/43c9aa3f-5f3a-46f1-8861-21db83675c09

Asset on disk (unused by default): `public/splats/stadium-3d-two.splat`

## Related routes

- `/studio/earth` — neighborhood aerial with all plat lines
- `/studio/sample` — Phase 3 drone flyover sample

## Why this pivot

Buyers need to recognize *their lot* and try a house on it. A floating
reconstruction blob fails that test. Aerial + plat + builder plans (or photo
cutout) passes it, then we can layer ground pans / better 3D later per lot.
