"""
Whitestone Session 2 — real gabled 3D (no standing photo).

The elevation PNG is a tracing guide only. This script hides it and builds
street-facing gables so orbiting shows a house, not a postcard.

  /Applications/Blender.app/Contents/MacOS/Blender --python ~/stadiumidaho/scripts/blender_whitestone_gables.py
"""

from __future__ import annotations

import bmesh
import bpy
from mathutils import Vector

FT_TO_M = 0.3048
WIDTH_M = 94 * FT_TO_M
DEPTH_M = 58 * FT_TO_M
WALL_H = 3.05
GARAGE_H = 4.35
RISE = 2.15
STREET_Y = -DEPTH_M / 2


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for item in list(block):
            block.remove(item)


def mat(name: str, color: tuple[float, float, float], roughness: float = 0.85) -> bpy.types.Material:
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (*color, 1)
        bsdf.inputs["Roughness"].default_value = roughness
    m.diffuse_color = (*color, 1)
    return m


def link_mesh(name: str, verts: list[Vector], faces: list[tuple], location: Vector, material: bpy.types.Material) -> bpy.types.Object:
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(v.x, v.y, v.z) for v in verts], [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)
    bpy.context.collection.objects.link(obj)
    return obj


def street_gable(width: float, depth: float, wall_h: float, rise: float) -> tuple[list[Vector], list[tuple], list[Vector], list[tuple]]:
    """Street-facing gable: triangular walls on ±Y, ridge along Y (depth)."""
    hw, hd = width / 2, depth / 2
    z1, z2 = wall_h, wall_h + rise
    walls = [
        Vector((-hw, -hd, 0)),
        Vector((hw, -hd, 0)),
        Vector((hw, hd, 0)),
        Vector((-hw, hd, 0)),
        Vector((-hw, -hd, z1)),
        Vector((hw, -hd, z1)),
        Vector((hw, hd, z1)),
        Vector((-hw, hd, z1)),
        Vector((0, -hd, z2)),
        Vector((0, hd, z2)),
    ]
    wall_faces = [
        (0, 3, 2, 1),
        (0, 1, 5, 4),
        (4, 5, 8),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (7, 6, 9),
        (3, 0, 4, 7),
    ]
    roof_verts = [
        Vector((-hw, -hd, z1)),
        Vector((0, -hd, z2)),
        Vector((0, hd, z2)),
        Vector((-hw, hd, z1)),
        Vector((hw, -hd, z1)),
        Vector((hw, hd, z1)),
    ]
    roof_faces = [(0, 1, 2, 3), (1, 4, 5, 2)]
    return walls, wall_faces, roof_verts, roof_faces


def add_gable(
    name: str,
    width: float,
    depth: float,
    wall_h: float,
    rise: float,
    location: Vector,
    siding: bpy.types.Material,
    roof: bpy.types.Material,
) -> None:
    wv, wf, rv, rf = street_gable(width, depth, wall_h, rise)
    link_mesh(f"{name}_walls", wv, wf, location, siding)
    link_mesh(f"{name}_roof", rv, rf, location, roof)


def add_box(name: str, size: Vector, location: Vector, material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def main() -> None:
    clear_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"

    siding = mat("siding", (0.93, 0.91, 0.86))
    roof = mat("roof", (0.12, 0.12, 0.11), 0.95)
    door = mat("door", (0.92, 0.90, 0.86), 0.7)
    trim = mat("trim", (0.08, 0.08, 0.08), 0.55)
    wood = mat("wood", (0.55, 0.38, 0.22), 0.6)
    glass = mat("glass", (0.35, 0.48, 0.55), 0.12)

    garage_w = WIDTH_M * 0.4
    entry_w = WIDTH_M * 0.22
    living_w = WIDTH_M - garage_w - entry_w
    garage_x = WIDTH_M / 2 - garage_w / 2
    entry_x = WIDTH_M / 2 - garage_w - entry_w / 2
    living_x = -WIDTH_M / 2 + living_w / 2
    garage_depth = DEPTH_M * 0.86
    garage_y = STREET_Y + garage_depth / 2

    rv_w = garage_w * 0.4
    dbl_w = garage_w * 0.52
    rv_x = garage_x + garage_w / 2 - rv_w / 2 - 0.1
    dbl_x = garage_x - garage_w / 2 + dbl_w / 2 + 0.08

    add_gable(
        "living",
        living_w + entry_w * 0.35,
        DEPTH_M * 0.94,
        WALL_H,
        RISE,
        Vector(((entry_x + living_x) / 2, 0, 0)),
        siding,
        roof,
    )
    add_gable("rv", rv_w + 0.35, garage_depth, GARAGE_H, RISE * 0.7, Vector((rv_x, garage_y, 0)), siding, roof)
    add_gable(
        "twocar",
        dbl_w + 0.3,
        garage_depth * 0.9,
        WALL_H + 0.15,
        RISE * 0.62,
        Vector((dbl_x, garage_y + 0.1, 0)),
        siding,
        roof,
    )
    add_gable(
        "porch",
        entry_w * 0.78,
        1.4,
        WALL_H * 0.98,
        RISE * 0.48,
        Vector((entry_x, STREET_Y + 0.9, 0)),
        siding,
        roof,
    )

    add_box("door_rv", Vector((rv_w * 0.86, 0.12, GARAGE_H * 0.74)), Vector((rv_x, STREET_Y + 0.08, GARAGE_H * 0.37)), door)
    add_box(
        "door_twocar",
        Vector((dbl_w * 0.88, 0.12, WALL_H * 0.68)),
        Vector((dbl_x, STREET_Y + 0.08, WALL_H * 0.34)),
        door,
    )
    add_box("rv_trim", Vector((rv_w * 0.92, 0.08, GARAGE_H * 0.8)), Vector((rv_x, STREET_Y + 0.02, GARAGE_H * 0.4)), trim)
    add_box("dbl_trim", Vector((dbl_w * 0.94, 0.08, WALL_H * 0.74)), Vector((dbl_x, STREET_Y + 0.02, WALL_H * 0.37)), trim)
    add_box("post_l", Vector((0.26, 0.26, WALL_H * 0.9)), Vector((entry_x - entry_w * 0.28, STREET_Y + 0.38, WALL_H * 0.45)), wood)
    add_box("post_r", Vector((0.26, 0.26, WALL_H * 0.9)), Vector((entry_x + entry_w * 0.28, STREET_Y + 0.38, WALL_H * 0.45)), wood)
    add_box("trim_bar", Vector((entry_w * 0.62, 0.18, 0.14)), Vector((entry_x, STREET_Y + 0.5, WALL_H * 0.86)), wood)
    add_box("front_door", Vector((1.05, 0.1, 2.15)), Vector((entry_x, STREET_Y + 0.22, 1.1)), wood)

    living_street_z = WALL_H * 0.55
    for i, x in enumerate((living_x - living_w * 0.28, living_x, living_x + living_w * 0.28)):
        add_box(f"win_front_{i}", Vector((1.15, 0.08, 1.35)), Vector((x, STREET_Y + 0.06, living_street_z)), glass)
        add_box(f"win_front_trim_{i}", Vector((1.28, 0.05, 1.48)), Vector((x, STREET_Y + 0.02, living_street_z)), trim)
    add_box("win_gable", Vector((0.55, 0.08, 0.7)), Vector((dbl_x, STREET_Y + 0.06, WALL_H + RISE * 0.22)), glass)
    add_box("win_side_l", Vector((0.08, 1.2, 1.2)), Vector((WIDTH_M / 2 - 0.04, 0.4, WALL_H * 0.55)), glass)
    add_box("win_side_r", Vector((0.08, 1.2, 1.2)), Vector((-WIDTH_M / 2 + 0.04, -0.6, WALL_H * 0.55)), glass)
    add_box("win_rear_0", Vector((1.4, 0.08, 1.5)), Vector((living_x, DEPTH_M * 0.47, WALL_H * 0.55)), glass)

    bpy.ops.object.empty_add(type="ARROWS", location=Vector(((rv_x + dbl_x) / 2, STREET_Y, 0)))
    empty = bpy.context.active_object
    empty.name = "GarageDoorFront"
    empty.empty_display_size = 0.6

    bpy.ops.object.light_add(type="SUN", location=(8, -12, 18))
    sun = bpy.context.active_object
    sun.rotation_euler = (0.7, 0.2, 0.4)
    sun.data.energy = 3.0

    bpy.ops.object.select_all(action="DESELECT")
    print("Whitestone massing with windows. Orbit with the middle mouse.")


if __name__ == "__main__":
    main()
