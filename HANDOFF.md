# The Stadium — Developer Handoff

Marketing site for **The Stadium**, a custom-home lot subdivision in north Caldwell, Idaho
(west of Wagner Road, north of Goodson Road). Stack: React 19 + Vite + TypeScript + Tailwind +
tRPC + Drizzle (MySQL) + Hono server, with three.js for the lot visualizer and Google Maps
(hybrid satellite) for the lot map.

This document is written for an AI developer (or human) picking the project up cold.
Read it fully before touching code — several non-obvious decisions and dead ends are documented here.

---

## 1. What the product owner actually wants

The owner's core vision (their words, paraphrased): **"Google Street View, built from the actual
footage, that allows them to move the house around and visualize it on the lot."**

When a buyer opens a lot page, they should feel like they are *standing on that lot in real life* —
the world around them built from video the owner shot on site — and be able to drag a house
footprint around on the lot to visualize placement.

Things the owner has explicitly **rejected** (do not reintroduce):

- ❌ Video players embedded in a box on the lot page ("you just took the video I gave you, put it
  on an extra box down below"). The `StreetWalk.tsx` component still exists in the tree but is
  intentionally not referenced anywhere — it was this rejected approach.
- ❌ Rows of mode buttons across the top of the visualizer ("I don't want five buttons across the
  top"). The viewport chrome must stay minimal: currently a single **Look around / Move house**
  toggle, driveway readout, and imagery attribution.
- ❌ Any synthetic/empty-looking 3D world (the "weird blue world" complaint) — the environment must
  be the real footage.
- ❌ Sparse point-cloud / splat renders from phone video (tried extensively — a 70k-point COLMAP
  cloud renders as "confetti" at eye level from a single walking clip; dead end, do not retry
  without substantially better source footage, e.g. dense 360° or drone orbits).

## 2. Current state (what works)

### 2.1 Lot pages (`src/pages/LotDetail.tsx`)
- Route model: hash param `#lot=<name>` (e.g. `#lot=46%2F3` for lot "46/3"), handled in `App.tsx`
  (`handleSelectLot` / `handleBack`). All "pages" live under one SPA route.
- Layout: `LotMap` (Google hybrid map with lot polygons + numbered status pins) →
  `LotVisualizer` → body content.

### 2.2 The footage world (`src/components/lotVisualizer/LotVisualizer.tsx`)
This is the centerpiece. For lot **46/3**, the environment is a **2048×2048 equirect-style photo
panorama** stitched from the owner's on-site video (`public/sky/lot46.jpg`), rendered as an
inside-out three.js sphere with the house model, lot boundary, terrain, driveway readout, and sun
slider layered on top.

Key pieces in `LotVisualizer.tsx`:
- `SKY_WORLDS` registry — maps lot name → `{ url, rotationY }`. Currently only:
  `'46/3': { url: '/sky/lot46.jpg', rotationY: (-74.9 * Math.PI) / 180 }`.
  **Adding a new lot = add an entry here** (see §4 for how to produce the pano + rotationY).
- Sphere: `SphereGeometry(700, 48, 32)`, `sphere.scale(-1, 1, 1)` (viewed from inside),
  `MeshBasicMaterial` with `tex.colorSpace = SRGBColorSpace` and **`tex.minFilter = LinearFilter`
  (mipmapping must be OFF or the wrap seam smears)**, `rotation.y = SKYWORLD.rotationY`,
  `position.y = -12` (drops the horizon slightly below eye level — looks natural).
- `scene.fog = null` while the photo sky is active; the sun effect guards `background`/`fog`
  changes behind `if (!skyOn)`.
- UI: one toggle — **Look around** (orbit) / **Move house** (drag the house footprint) — plus
  the sun slider, plan picker (Brownstone / Whitestone / Sunstone stand-in massings), and a
  "Driveway ≈ N ft" readout.
- Camera modes: bird's-eye orbit ("vantage") and WASD "street level" walk. House placement is
  approximate; disclaimer copy under the viewport says so — keep that disclaimer.

### 2.3 The lots map (`src/components/LotMap.tsx`)
- Google Maps JS loaded via a hand-rolled script injector (`loadGoogleMapsScript`) — do **not**
  replace with `useJsApiLoader`; its loader intermittently never resolves (documented in comments).
- **Recent bug fix (important pattern):** the `GoogleMap` `options` object is memoized in
  `mapOptions`. Before this, every hover/selection re-render handed the map a fresh options object,
  and `@react-google-maps/api` re-applied `center`/`zoom`, snapping the user's pan back to center.
  If the map ever "jumps back to the middle" again, this memoization (or a new un-memoized options
  prop) is the place to look.
- Lot data: `useStadiumLots()` prefers a live tRPC feed (`trpc.lots.live`) and falls back to the
  baked snapshot `src/data/stadium-lots.json`.

### 2.4 Lot identity: "lot 46 on Yogi"
The owner filmed **lot 46** and refers to a street "Yogi". The Phase 2 final plat
(`ID-2854-2012 C.2.0 FINAL PLAT_PH2.pdf`, sheet 1) shows **Lot 46 = 2.212 AC, Block 3**, at the
north section line near the Mooskow Way cul-de-sac — matching `46/3` (2.21 AC) in the lot data.
Streets found on plat sheet 1: Mooskow Way (PUBLIC), Cerberus (PUBLIC), Secretariat, Yankee
Doodle, Goodson Road. **"Yogi" was NOT found on sheet 1** — sheets 2–5 were never OCR'd/searched.
Owner has not yet confirmed 46/3 is the lot they filmed. Verify before building more lot worlds.

## 3. The panorama pipeline (how lot46.jpg was made)

All heavy lifting happened **in-sandbox** with COLMAP. To reproduce or extend:

1. **Frames:** extract from source video at ~4 fps (90 frames, 1920×1080, from `IMG_0159.MOV`).
2. **SfM:** `pycolmap` (installed for system `python3`, NOT importable in Jupyter kernels):
   `extract_features` → `match_sequential` → `incremental_mapping`. Cameras come back
   `SIMPLE_RADIAL` with **f ≈ 871–876 px (≈95° horizontal FOV)** for iPhone 17 Pro video —
   do NOT trust the ~2304 px EXIF estimate. All 90 frames registered, 69,931 points.
3. **Geometry:** the clip splits into a **walk segment** (frames 0–62, ~11 m of translation) and a
   **pan segment** (frames 63–89, ~53° yaw sweep in place). Camera math:
   `R = im.cam_from_world().rotation.matrix()`, center `C = -R.T @ t`, forward `R.T @ [0,0,1]`.
4. **Stitch (`/tmp/stitch5.py` in the original sandbox — recreate from this spec):** cylindrical
   dest-grid warp per frame (cv2.remap needs **dest→source** maps), pan frames weighted ×3,
   crop to the content band (columns with >30% coverage), stretch to full 2048 width, fill the
   sky with a vertical gradient and the below-frame region with a warm flat ground color,
   **cross-blend the left/right wrap edges by 200 px** (kills the visible seam in the sphere).
5. **Orientation:** pano center compass heading was measured at **−164.9°** (clockwise from north);
   three.js needs `rotationY = heading + 90°` → **−74.9°** for this lot. Verify visually per lot.
6. **Post-fixes applied to the shipped JPEG** (idempotent-ish, recreate if regenerating):
   - Sky flattened to a smooth zenith→horizon gradient *above* a per-column horizon line detected
     via a warm/cold (R−B) index — removes ghost "walls" and panel edges from imperfect fills.
   - Rows below ~1120 blended to a single flat dirt tone (hides the no-coverage band).
   - The horizon line itself is slightly wavy — that follows the real stitched horizon; fine.

Result: `public/sky/lot46.jpg` (~0.9 MB).

### Footage inventory (as of handoff)
- `IMG_0159.MOV` — the lot-46 walking/pan clip (used; product confirmed working).
- `Clip 8.mov` (66 s), `Clip 9.mov` (65 s), `Clip 9(1).mov` (**exact MD5 duplicate of Clip 9**),
  `Clip 10.mov` (67 s) — all HEVC 1920×1080. Mid-frames look **elevated/drone-style**.
  **Owner was asked what they cover and hadn't answered** — likely source for more/better lot
  panoramas or a site-wide aerial world. Ask before processing.
- `Brownstone_floorplan.png` — uploaded but not yet wired into the visualizer's stand-in massings.

## 4. Adding the footage world to another lot (runbook)

1. Get a video that ends in (or contains) a **slow 360° pan** from a fixed spot on the lot —
   the pan is what makes the pano. Walking-only footage won't wrap.
2. Run §3 steps 1–5. The pano center heading and the +90° three.js offset give `rotationY`.
3. Save as `public/sky/lot<N>.jpg`, add the `SKY_WORLDS` entry in `LotVisualizer.tsx`.
4. Verify: screenshot the lot page at the default vantage AND after a ~120° orbit drag — the seam
   and horizon only show when orbited (see §6 for the screenshot harness).

## 5. Build, run, deploy (and the traps)

```bash
npm install
npm run build          # vite (client → dist/public) + server bundle (dist/boot.js)
NODE_ENV=production node dist/boot.js   # serves on :3000
```

Config: `.env` (gitignored; `.env.example` documents every var). Needs a MySQL `DATABASE_URL`,
Kimi OAuth vars for sign-in, and `VITE_GOOGLE_MAPS_API_KEY`.

**Traps learned the hard way:**

- **The `/mnt/agents` mount silently drops files during `vite build`.** Vite reports success and
  index.html then references hashed assets that don't exist. Reliable procedure:
  `npx vite build --outDir /tmp/vdist --emptyOutDir`, then copy to `dist/public` in Python with
  per-file `os.path.getsize` verification and retries (delete stale `dist/public/assets` first).
  Before shipping, list `dist/public/assets` and curl every asset referenced by `index.html`.
- **`pkill -f "dist/boot.js"` kills the shell that runs it.** Start the server in a separate
  command: `NODE_ENV=production nohup node dist/boot.js > /tmp/server.log 2>&1 &`.
- **A stray dev server (`vite --port 3000`) can outlive its parent and hijack the port** — the
  symptom was a white preview that survives production restarts. Diagnose by fetching `/`:
  dev HTML contains `/@react-refresh`; production HTML references `/assets/index-*.js`.
  `kill -9` the vite process; don't just start prod and hope (it crashes with EADDRINUSE).
- **SPA fallback only serves HTML to `Accept: text/html` requests** — plain curl gets a JSON 404.
- **Dockerfile deploy:** the repo ships a Dockerfile; `dynamic`-type hosting builds from repo root.

## 6. Verifying your work (screenshot harness)

Google Maps and some CDNs are blocked from the dev sandbox — the map area can't be verified
headlessly, but three.js scenes can:

- Python Playwright + system chromium (`/usr/lib/chromium/chromium`), args:
  `--no-sandbox --disable-dev-shm-usage --use-angle=swiftshader --enable-unsafe-swiftshader`.
- **Always abort heavy media routes** or the renderer OOMs/hangs:
  `pg.route('**/splats/**', abort)` and `pg.route('**/videos/**', abort)`.
- Screenshot `timeout=90000`; long waits (30 s+) for the visualizer's texture loads.
- Run via `python3 /tmp/script.py` from the shell — launching chromium from a Jupyter kernel
  kills the kernel.
- Verify pano changes with TWO shots: default vantage and one after a mouse-drag orbit (~120°).

## 6b. Track B — Lot Studio (parallel path)

Greenfield experience at **`/studio`**. See `src/studio/README.md`.

**Current default (lot-first):** aerial imagery + plat outline + **builder plan
drop-in** (Brownstone, Whitestone front garage, Whitestone side-entry) with
optional house photo cutout as the custom path.
Construction PDFs: `public/plans/*-{rwr,pse}.pdf`. Catalog: `src/data/plans.ts`.
The Polycam site-wide Gaussian splat was tried and rejected as a “blotchy blob” —
kept on disk (`public/splats/stadium-3d-two.splat`) but not shown by default.
Intentionally not wired into `LotDetail` yet.

## 7. Known open items / backlog

1. **Owner confirmation that "lot 46 on Yogi" == 46/3** (see §2.4). If the plat has a Yogi street
   on sheets 2–5, re-check the mapping before scaling to other lots.
2. **Clips 8/9/10** — unprocessed; likely elevated footage. Candidate for more lot worlds or a
   community-wide aerial backdrop (see §3 inventory).
3. **Pano polish for 46/3:** horizon band is slightly wavy; ground below the frame is a flat fill;
   fine at normal zoom but a re-shoot with a steadier pan would improve it. `rotationY`/horizon
   height (`position.y = -12`) may want nudging after owner review.
4. **Real house geometry:** Studio uses simplified massings from builder PDFs (footprint +
   garage entry). Owner cares about *placement and scale*, not architecture (keep the disclaimer).
   Photo upload remains for custom homes.
5. **StreetWalk.tsx / splats:** dead code kept for reference (`public/splats/*.ksplat` still
   ships, ~30 MB — candidate for repo-size cleanup once owner confirms they're not coming back).
6. Preview/versioning is platform-managed (Kimi `website_version_manager`); if previews white-screen,
   check for the port-hijack trap in §5 before re-saving versions.

## 8. Repo layout (quick map)

```
api/ contracts/ db/        tRPC server, shared contracts, drizzle schema
src/components/LotMap.tsx           Google lot map (memoized options — see §2.3)
src/components/lotVisualizer/       THE visualizer (LotVisualizer.tsx + helpers)
src/components/StreetWalk.tsx       REJECTED approach — reference only, unreferenced
src/sections/MapExplorer.tsx        homepage map section (uses LotMap)
src/pages/LotDetail.tsx             lot page shell
src/data/stadium-lots.json          baked lot snapshot (live feed preferred at runtime)
public/sky/lot46.jpg                stitched footage world for lot 46/3
public/splats/  public/videos/      splats + hero/flyover videos
dist/                               build output (gitignored)
```
