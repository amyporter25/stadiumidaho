# Blender: Whitestone (we do this together)

You install Blender on your computer. I give the next click, you do it, you
send a screenshot if anything looks wrong. We do **one session at a time**.

Use **Blender 4.2 LTS** or 4.5: https://www.blender.org/download/lts/

Open this repo on your machine (the same folder as `package.json`). The setup
script loads images from `public/plans/`.

---

## Session 1 — scene that already has the right scale

1. Install Blender. Open it once and quit the splash screen (click anywhere).
2. **File → Open** is not needed yet. Switch the top tab to **Scripting**.
3. **Text → Open** and pick the file *inside your clone*, not a copy:
   `/Users/YOU/stadiumidaho/scripts/blender_whitestone_setup.py`
4. Click **Run Script**.

   If Blender still errors, pull the latest script first (Terminal):

   ```bash
   cd ~/stadiumidaho
   git checkout cursor/lot-studio-track-b-3c2b
   git pull origin cursor/lot-studio-track-b-3c2b
   ```

   Then in Blender: Text → Open that same path again (so you are not running an old copy).
5. Switch back to the **Layout** tab.

You should see:

- A floor-plan image on the ground, about 94 ft wide
- The front elevation standing on the street edge
- Two gray blocks: living (right) and garage (left from the street)
- Arrows on the street face named `GarageDoorFront`

Orbit with the middle mouse button. Front view: numpad **1** (or View → Viewpoint → Front).

**Save:** File → Save As → `whitestone-front.blend` next to this repo (or in a `blender/` folder).

Then reply here with a screenshot of that scene. I will give Session 2 (cutting the blocks into gables so they match the elevation).

---

## What we will not do in Session 1

- Fancy materials
- Exporting a GLB yet
- The side-entry plan (that is a second file after the front plan looks right)

---

## If the reference images are missing

The script prints `SKIP REF_…` in the Blender console (Window → Toggle System Console on Windows). That means Blender did not find the repo folder. Run it like this instead, from a terminal in the repo:

```bash
blender --python scripts/blender_whitestone_setup.py
```

On Mac, Blender is usually:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --python scripts/blender_whitestone_setup.py
```
