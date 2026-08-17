"""
Whitestone Session 1 — Blender scene setup.

Run inside Blender (Scripting workspace → Open this file → Run Script),
or from a terminal:

  blender --python scripts/blender_whitestone_setup.py

Why this exists: scale, origin, street axis, and garage empties are easy to
get wrong by hand. The script locks those so we only model the house.
"""

from __future__ import annotations

from pathlib import Path

import bpy
from mathutils import Vector

FT_TO_M = 0.3048
WIDTH_M = 94 * FT_TO_M  # 28.65 m
DEPTH_M = 58 * FT_TO_M  # 17.68 m  (front-entry plan)
WALL_H = 3.05
GARAGE_H = 4.35

# Street faces −Y in Blender (Z-up). The glTF exporter maps that to −Z in
# three.js, which is what Lot Studio expects.
STREET_Y = -DEPTH_M / 2


def repo_root() -> Path:
    if "__file__" in globals():
        return Path(__file__).resolve().parents[1]
    # Pasted into Blender's text editor — look next to the .blend, then cwd.
    blend = Path(bpy.data.filepath) if bpy.data.filepath else Path.cwd()
    return blend.parent if blend.suffix == ".blend" else Path.cwd()


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def set_units() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"


def new_cube(name: str, size: Vector, location: Vector) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def new_empty(name: str, location: Vector) -> bpy.types.Object:
    bpy.ops.object.empty_add(type="ARROWS", location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.empty_display_size = 0.6
    return obj


def add_image_plane(name: str, image_path: Path, width: float, height: float, location: Vector, rotation: Vector) -> None:
    if not image_path.exists():
        print(f"SKIP {name}: missing {image_path}")
        return
    img = bpy.data.images.load(str(image_path))
    bpy.ops.mesh.primitive_plane_add(size=1, location=location, rotation=rotation)
    plane = bpy.context.active_object
    plane.name = name
    plane.scale = (width / 2, height / 2, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mat = bpy.data.materials.new(name=f"{name}_mat")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    emit = nodes.new("ShaderNodeEmission")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = img
    links.new(tex.outputs["Color"], emit.inputs["Color"])
    links.new(emit.outputs["Emission"], out.inputs["Surface"])
    plane.data.materials.append(mat)
    plane.hide_render = True
    plane.display_type = "TEXTURED"


def main() -> None:
    root = repo_root()
    clear_scene()
    set_units()

    # Floor-plan reference, lying on the ground. Street edge at −Y.
    add_image_plane(
        "REF_floorplan",
        root / "public/plans/thumbs/whitestone-front-floorplan.jpg",
        WIDTH_M,
        DEPTH_M,
        Vector((0, 0, 0.01)),
        Vector((0, 0, 0)),
    )

    # Front elevation standing on the street face (reference only — not the house).
    add_image_plane(
        "REF_front_elevation",
        root / "public/plans/refs/whitestone-front.png",
        WIDTH_M,
        8.2,
        Vector((0, STREET_Y - 0.15, 4.1)),
        Vector((1.5708, 0, 0)),
    )

    garage_w = WIDTH_M * 0.4
    living_w = WIDTH_M - garage_w
    # Viewer-left garage = +X in Lot Studio = +X in Blender after glTF Y-up export.
    garage = new_cube(
        "BLOCK_garage",
        Vector((garage_w, DEPTH_M * 0.86, GARAGE_H)),
        Vector((WIDTH_M / 2 - garage_w / 2, STREET_Y + DEPTH_M * 0.86 / 2, GARAGE_H / 2)),
    )
    living = new_cube(
        "BLOCK_living",
        Vector((living_w, DEPTH_M * 0.94, WALL_H)),
        Vector((-WIDTH_M / 2 + living_w / 2, 0, WALL_H / 2)),
    )
    garage.hide_render = False
    living.hide_render = False

    # Driveway attach: midpoint of RV + two-car, at ground on the street face.
    new_empty("GarageDoorFront", Vector((WIDTH_M / 2 - garage_w / 2, STREET_Y, 0)))

    bpy.ops.object.select_all(action="DESELECT")
    print("Whitestone Session 1 scene is ready.")
    print(f"Footprint {WIDTH_M:.2f} m × {DEPTH_M:.2f} m. Street face is the elevation plane.")
    print("Next: model gables against REF_front_elevation, then tell the agent and screenshot.")


if __name__ == "__main__":
    main()
