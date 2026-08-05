# Lot Studio (Track B)

Parallel path for the lot visualization experience: **real Polycam / Gaussian splat
world + upload-a-house-photo placement**. Intentionally separate from the marketing
site and the older panorama visualizer.

- App route: [`/studio`](../../src/studio/LotStudioPage.tsx)
- World config: [`config.ts`](./config.ts)

## Why the Polycam link alone is not enough

The public capture  
https://poly.cam/capture/43c9aa3f-5f3a-46f1-8861-21db83675c09  
(“Stadium 3D TWO”) is viewable/embeddable on Polycam, but there is **no public API**
to pull the Gaussian splat bytes into our app. Cursor also blocks uploading raw
`.ply` files. So we need a **web-sized converted asset** delivered some other way.

Until that arrives, Studio loads the already-compressed stand-in:

`/splats/stadium.ksplat` (~19 MB)

Override anytime with:

`/studio?splat=https://your-cdn.example/stadium-two.ksplat`

## How to hand off Stadium 3D TWO without uploading `.ply`

Pick **one** of these (best → fine):

### Option A — Convert in SuperSplat, share a small file (preferred)

1. On your machine, download **Splat PLY** from Polycam for Stadium 3D TWO.
2. Open https://playcanvas.com/supersplat/editor (or SuperSplat desktop).
3. Import the PLY → decimate / clean until the export is roughly **15–40 MB**.
4. Export as **`.splat`** (or compressed PLY).
5. Send that file by:
   - Google Drive / Dropbox / WeTransfer link, **or**
   - rename to `stadium-two.bin` / zip as `stadium-two.zip` if the chat uploader
     rejects `.ply` / `.splat`, **or**
   - upload to any public HTTPS URL and paste the link here.

We convert to `.ksplat` in-repo with `convert-splat.mjs` if needed.

### Option B — Zip the PLY

```bash
zip stadium-two-splat.zip your-export.ply
```

Upload / link the `.zip`. Same bytes, allowed extension.

### Option C — Host it yourself

Put the converted `.ksplat` or `.splat` on S3/R2/Cloudflare with CORS allowing our
origin, then open:

`/studio?splat=https://cdn…/stadium-two.ksplat`

### Option D — Polycam embed (not interactive enough)

We *can* iframe the Polycam viewer, but buyers **cannot** place a house inside it.
Embed is a fallback preview only — not the Studio product.

## Current UX (Slice 1–2)

1. Orbit / look around the site splat.
2. **Upload house photo** → browser background removal → transparent cutout.
3. **Move house** mode: drag on the ground plane; width + yaw sliders.
4. Temporary **Align** panel: scale (units/ft) and ground Y until the new capture
   is geo-aligned to the plat.

## Next slices (after the real splat lands)

- Geo-align splat ↔ lot polygons from the plat
- Per-lot camera bookmarks / pad hotspots
- Save / share pose in the URL
- Optional image→3D upgrade for the house cutout
- Landscaping props
