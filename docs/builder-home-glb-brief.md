# Vendor brief: Blackstone builder homes for Lot Studio (web GLB)

**Client / project:** Stadium Idaho — Lot Studio  
**Goal:** Place real builder homes on surveyed lots in a browser (three.js). Buyers orbit the home, move it on the lot, and see a driveway that meets the garage.  
**Deliverable:** One web-optimized `.glb` per plan (not a PDF, not a photo cutout, not a full unoptimized BIM dump).

---

## Why we need this

Marketing elevations and flat cutouts are not enough. The product needs real 3D volume that still looks like the marketed home when the camera orbits.

---

## Plans to model (priority order)

| Priority | Plan | Garage layout | Reference PDF (in repo / attached) |
|----------|------|---------------|--------------------------------------|
| 1 | The Whitestone — front | Tall RV + two-car, both street-facing (street-view left) | `whitestone-7-2-rwr.pdf` |
| 2 | The Whitestone — side | Side-entry two-car + front-facing RV bay | `whitestone-29-3-pse.pdf` |
| 3 | The Brownstone | Front-facing garage + RV bay | `brownstone-15-2-rwr.pdf` |

We will provide: construction PDFs, floor-plan images, and marketing / ArchyBase exterior elevations (front + rear where available).

---

## Technical requirements (must follow)

1. **Format:** glTF 2.0 binary (`.glb`)  
2. **Units:** meters  
3. **Origin:** ground plane, **center of the building footprint**  
4. **Orientation:** street facade faces **−Z** (right-handed Y-up, same as three.js)  
5. **Scale:** match dimensioned floor plan footprint (Whitestone front ≈ 94′ × 58′; Whitestone side deeper ≈ 94′ × 78′; Brownstone ≈ 91′ × 72′)  
6. **Web budget (per home):** ~**50k–150k** triangles; textures compressed (KTX2/Basis preferred, or optimized JPEG/WebP in GLB); total file ideally **under ~15–25 MB**  
7. **Materials:** PBR (siding, roof, glass, trim, garage doors readable as separate materials)  
8. **No** cameras, lights, or huge empty scene graphs — mesh + materials only  

### Driveway attach points (required)

Add empty nodes (or well-named meshes) at the **center of the vehicle door threshold, at ground**:

| Node name | When |
|-----------|------|
| `GarageDoorFront` | Street-facing garage door(s) — use the midpoint of RV + two-car if both face the street |
| `GarageDoorSide` | Side-entry garage door(s) only (Whitestone side plan) |

Local axes of those empties should match the house (no random rotation). Ground Y = 0.

---

## Visual requirements

- Match the **marketing / ArchyBase exterior** as closely as practical: board-and-batten (Whitestone), roof forms, timber entry, window rhythm, garage/RV proportions.  
- Garage wing must be on the **correct side** per plan (Whitestone: street-view **left**).  
- Interior detail is **not** required.  
- Photoreal texturing is nice-to-have; accurate massing + credible materials is the bar.  

---

## Delivery checklist

For each plan, deliver:

- [ ] `plan-id.glb` (e.g. `whitestone-front.glb`, `whitestone-side.glb`, `brownstone.glb`)  
- [ ] Screenshot(s): street front, ¾ orbit, rear  
- [ ] Short note: footprint (m or ft), triangle count, texture sizes, node list  
- [ ] Confirm `GarageDoorFront` / `GarageDoorSide` present as applicable  

---

## Acceptance test (how we’ll use it)

1. Drop GLB on a Stadium lot in Lot Studio  
2. Street view should read as that builder home  
3. Orbit should still look like a house (not a flat card or block mash)  
4. Driveway ribbon ends at the named garage door node  

---

## Out of scope (for this round)

- Full interior / furniture  
- Rigged doors / animation  
- Landscaping, people, cars  
- Ultra-high-poly archviz still renders (we need real-time web)  

---

## Contact / questions

Please confirm timeline, quote per plan, and whether you prefer working from CAD export (Revit / Archicad / SketchUp / ArchyBase) vs modeling from PDF + elevations. CAD export + cleanup is preferred if Blackstone can supply source files.
