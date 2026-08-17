# Builder home GLBs

Drop a vendor-modeled glTF 2.0 file here. Lot Studio loads it; it does not
build or texture a house in-engine.

| File | Footprint | Required nodes |
|------|-----------|----------------|
| `whitestone-front.glb` | 94′ × 58′ (catalog also lists 70′ depth) | `GarageDoorFront` |
| `whitestone-side.glb` | 94′ × 78′ | `GarageDoorFront`, `GarageDoorSide` |
| `brownstone.glb` | 91′ × 72′ | `GarageDoorFront` |

Units: meters. Origin: footprint center at ground. Street facade faces **−Z**.

See `docs/builder-home-glb-brief.md`. Until a file is present, Studio seats a
plain footprint box so the lot and driveway still work.
