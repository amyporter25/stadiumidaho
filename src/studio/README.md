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
4. **Drop a builder plan** (primary) — Brownstone, Whitestone front garage,
   or Whitestone side-entry — as a scaled 3D massing on the lot
5. Or **upload a house photo** → background cutout → place/scale/rotate in feet

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
