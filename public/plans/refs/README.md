# Exterior reference images (photoreal skins)

Lot Studio wraps these onto the Whitestone 3D massing (`streetFacade` /
`rearFacade` planes).

## Whitestone

| File | Role |
|------|------|
| `whitestone-front.png` | Street elevation cutout (RV + garage on the **left**) |
| `whitestone-rear.png` | Rear elevation cutout (large glass gable) |
| `whitestone-exteriors.png` | Source ArchyBase front+rear stack (for re-cuts) |
| `whitestone-dollhouse.jpg` | Isometric floor-plan dollhouse reference |

Skins are transparent PNGs (background removed). After replacing files, bump the
`?v=` cache query on `WHITESTONE_*_SKIN` in `whitestoneHouse.ts`, then
hard-refresh `/studio` and select **The Whitestone**.
