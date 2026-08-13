# Builder home GLBs

Generated from plan PDFs + ArchyBase elevations (`npm run glb:export`).

| File | Footprint | Garage nodes |
|------|-----------|--------------|
| `whitestone-front.glb` | 94′ × 58′ | `GarageDoorFront` |
| `whitestone-side.glb` | 94′ × 78′ | `GarageDoorFront`, `GarageDoorSide` |
| `brownstone.glb` | 91′ × 72′ | `GarageDoorFront` |

Units: meters. Origin: footprint center at ground. Street facade faces **−Z**.
Photoreal elevations are applied at runtime onto wall faces (kept separate so GLBs stay small).
