"""Step 01: scripted blockout of the tea nook (slice 1.3).

Builds the whole contract-compliant scene from the factory startup state and saves it:

    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup \\
        --python tools/blender/steps/01_blockout.py -- [output.blend]

Default output: tools/blender/nook.blend. Re-runnable: it resets Blender to an empty scene first,
so running it twice (or against a temporary path) gives the same file. Boxes and cylinders only;
real shapes come in phase 2. Do not run it against nook.blend once phase 2 has started editing it.

Frame (SPEC.md section 5): Blender Z up, front is -Y, back wall at +Y, left wall (window) at -X,
origin = centre of the counter top surface, meters. All sizes are the SPEC proposals (D-010).
"""

import math
import os
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- parameters (meters) ----------

# Working palette, sRGB hex, SPEC.md section 3. The first six are from the spec; the rest mirror the
# placeholders in src/config/look.ts. look.ts overrides all of these at runtime (D-009), so
# changing a colour there needs no re-export. Keep this dict and PALETTE in look.ts in step.
PALETTE = {
    "Mat_Wall": "#F2E6D0",
    "Mat_Wood": "#C98F5B",
    "Mat_Mug": "#D9694A",
    "Mat_Kettle": "#8FB8A0",
    "Mat_Leaf": "#6E9A5B",
    "Mat_Frame": "#F7F3EA",
    "Mat_Pot": "#B5654A",
    "Mat_Tin": "#C9B8A0",
    "Mat_Book": "#7A8FB0",
    "Mat_Tea": "#8A4B2A",
    "Mat_KettleDetail": "#5E7F6C",
    "Mat_Glass": "#CFE6F2",
    "Mat_Sky": "#BFD8F0",
}
GLASS_ALPHA = 0.35  # Mat_Glass is see-through; the colour above is its base colour

COUNTER_X, COUNTER_Y, COUNTER_T = 0.60, 0.45, 0.04  # footprint and thickness; top surface is z = 0
WALL_H, WALL_T = 0.30, 0.02  # wall height above the counter top, wall thickness

# Window in the left wall (-X): opening centred at y = WIN_Y, between z = WIN_Z0 and WIN_Z1.
WIN_Y, WIN_W = 0.0, 0.22
WIN_Z0, WIN_Z1 = 0.10, 0.26
FRAME_W, FRAME_DEPTH = 0.015, 0.03  # frame bar width, depth across the wall (sticks out 5 mm each side)
SKY_OFFSET, SKY_PAD = 0.05, 0.03  # sky card: metres outside the glass, extra size around the opening (stays inside the wall height)

# Light patch (for the Phase 2 rays): sun travels from Rays_Origin to this point on the counter.
RAYS_TARGET = (-0.10, 0.0, 0.0)
DUST_MIN, DUST_MAX = (-0.28, -0.12, 0.0), (0.0, 0.12, 0.20)  # box inside the lit area
ORBIT_TARGET = (0.0, 0.0, 0.10)  # visual centre of the diorama

MUG_XY = (0.0, -0.07)
MUG_R_BASE, MUG_R_TOP, MUG_H = 0.036, 0.040, 0.09
MUG_WALL, MUG_FLOOR = 0.006, 0.008
TEA_DEPTH = 0.006  # tea surface this far below the rim
MUG_HANDLE = (0.022, 0.006, 0.02, 0.07)  # reach beyond the wall, half width, z from, z to

KETTLE_XY = (0.17, 0.11)
KETTLE_R_BASE, KETTLE_R_MID, KETTLE_R_TOP = 0.065, 0.070, 0.055
KETTLE_Z_MID, KETTLE_BODY_H = 0.07, 0.15
KETTLE_LID_R, KETTLE_LID_H = 0.045, 0.01
KETTLE_KNOB_R, KETTLE_KNOB_H = 0.012, 0.04  # total height = 0.15 + 0.01 + 0.04 = 0.20
SPOUT_TIP_X = -0.115  # spout points to -X (towards the window)
SPOUT_TIP_Z = (0.14, 0.16)  # opening spans these z values; Steam_Kettle sits at the middle

PLANT_XY = (-0.20, 0.15)
POT_R, POT_H = 0.035, 0.05
PLANT_CONE_R, PLANT_CONE_H = 0.05, 0.10
TIN_XY, TIN_R, TIN_H = (-0.20, -0.13), 0.03, 0.07
BOOKS_XY = (-0.01, 0.17)
BOOKS = [  # (width x, depth y, height z, yaw in degrees) bottom to top
    (0.10, 0.07, 0.015, 0.0),
    (0.09, 0.065, 0.02, 8.0),
    (0.085, 0.06, 0.015, -6.0),
]

SEGMENTS = 16  # round parts; flat shaded on purpose (low poly)

# Material slot order of the merged Room mesh.
ROOM_MATERIALS = ["Mat_Wall", "Mat_Wood", "Mat_Frame", "Mat_Leaf", "Mat_Pot", "Mat_Tin", "Mat_Book"]
KETTLE_MATERIALS = ["Mat_Kettle", "Mat_KettleDetail"]

# -------------------------------------------------------------------------- helpers -------------


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear(hex_color):
    h = hex_color.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))


def make_material(name, hex_color, alpha=1.0):
    """Flat-looking Principled material. Blender stores base colours linear; the exporter writes
    them to the GLB as linear baseColorFactor, which three.js reads back as sRGB hex."""
    mat = bpy.data.materials.new(name)
    # Blender 5.x creates new materials with a Principled node tree already (use_nodes is deprecated).
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    r, g, b = hex_to_linear(hex_color)
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        mat.surface_render_method = "BLENDED"
    mat.diffuse_color = (r, g, b, alpha)  # viewport / Workbench colour
    return mat


def box(bm, lo, hi, mat=0, yaw=0.0):
    """Axis-aligned box from corner lo to corner hi (optionally turned around Z about its centre)."""
    lo, hi = Vector(lo), Vector(hi)
    centre, size = (lo + hi) / 2, hi - lo
    m = (
        Matrix.Translation(centre)
        @ Matrix.Rotation(math.radians(yaw), 4, "Z")
        @ Matrix.Diagonal((size.x, size.y, size.z, 1.0))
    )
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat


def lathe(bm, profile, centre=(0.0, 0.0, 0.0), segments=SEGMENTS, mat=0):
    """Solid of revolution around the Z axis through `centre`. `profile` is a closed outline of
    (radius, z) points; radius 0 means a point on the axis (one vertex, a triangle fan)."""
    cx, cy, cz = centre
    rings = []
    for r, z in profile:
        if r == 0:
            rings.append([bm.verts.new((cx, cy, cz + z))])
        else:
            rings.append(
                [
                    bm.verts.new(
                        (cx + r * math.cos(2 * math.pi * k / segments), cy + r * math.sin(2 * math.pi * k / segments), cz + z)
                    )
                    for k in range(segments)
                ]
            )
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for k in range(segments):
            k2 = (k + 1) % segments
            if len(a) == 1:
                face = (a[0], b[k], b[k2])
            elif len(b) == 1:
                face = (a[k], a[k2], b[0])
            else:
                face = (a[k], a[k2], b[k2], b[k])
            bm.faces.new(face).material_index = mat


def cylinder(bm, radius, height, centre, mat=0, segments=SEGMENTS):
    lathe(bm, [(0, 0), (radius, 0), (radius, height), (0, height)], centre, segments, mat)


def cone(bm, radius, height, centre, mat=0, segments=SEGMENTS):
    lathe(bm, [(0, 0), (radius, 0), (0, height)], centre, segments, mat)


def frustum(bm, base, tip, mat=0):
    """Hexahedron from two quads (each a list of 4 (x, y, z) points in matching order)."""
    b = [bm.verts.new(p) for p in base]
    t = [bm.verts.new(p) for p in tip]
    bm.faces.new(b).material_index = mat
    bm.faces.new(t).material_index = mat
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i])).material_index = mat


def finish(bm, mesh, materials):
    """Make normals point outwards on closed shapes, write the mesh, assign material slots."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(mesh)
    bm.free()
    for m in materials:
        mesh.materials.append(m)
    mesh.update()


def add_object(name, data, location=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = location
    if parent is not None:
        obj.parent = parent  # matrix_parent_inverse stays identity: location is relative to the parent
    return obj


def add_marker(name, location, parent=None):
    """Empty used as a position marker (identity rotation and scale)."""
    obj = add_object(name, None, location, parent)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.02
    return obj


def quad_x(name, centre, width_y, height_z, material):
    """Single quad in a plane x = const, facing +X (into the room), origin at its centre."""
    mesh = bpy.data.meshes.new(name)
    hw, hh = width_y / 2, height_z / 2
    verts = [(0, -hw, -hh), (0, hw, -hh), (0, hw, hh), (0, -hw, hh)]  # counter-clockwise seen from +X
    mesh.from_pydata(verts, [], [(0, 1, 2, 3)])
    mesh.materials.append(material)
    mesh.update()
    return add_object(name, mesh, centre)


def assign_uvs(bm, layer_name):
    """Box-projection UVs in metres, dominant axis per face (placeholder; no texture uses them yet)."""
    layer = bm.loops.layers.uv.new(layer_name)
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [i for i in range(3) if i != ax]
        for loop in f.loops:
            loop[layer].uv = (loop.vert.co[a], loop.vert.co[b])


# ---------------------------------------------------------------- parts -----------------------


def build_room(mats):
    idx = {name: i for i, name in enumerate(ROOM_MATERIALS)}
    bm = bmesh.new()
    cx, cy = COUNTER_X / 2, COUNTER_Y / 2
    top = WALL_H
    bottom = -COUNTER_T

    box(bm, (-cx, -cy, bottom), (cx, cy, 0.0), idx["Mat_Wood"])  # counter
    # Back wall at +Y (from x = -cx, so it meets the left wall without overlapping it).
    box(bm, (-cx, cy, bottom), (cx, cy + WALL_T, top), idx["Mat_Wall"])
    # Left wall at -X in four boxes around the window opening.
    x0, x1 = -cx - WALL_T, -cx
    wy0, wy1 = WIN_Y - WIN_W / 2, WIN_Y + WIN_W / 2
    box(bm, (x0, -cy, bottom), (x1, wy0, top), idx["Mat_Wall"])  # front of the opening
    box(bm, (x0, wy1, bottom), (x1, cy + WALL_T, top), idx["Mat_Wall"])  # behind the opening
    box(bm, (x0, wy0, bottom), (x1, wy1, WIN_Z0), idx["Mat_Wall"])  # under the opening
    box(bm, (x0, wy0, WIN_Z1), (x1, wy1, top), idx["Mat_Wall"])  # above the opening
    # Window frame: four bars lining the opening, a little thicker than the wall.
    fx0 = -cx - WALL_T / 2 - FRAME_DEPTH / 2
    fx1 = fx0 + FRAME_DEPTH
    f = FRAME_W
    box(bm, (fx0, wy0, WIN_Z0), (fx1, wy1, WIN_Z0 + f), idx["Mat_Frame"])  # sill
    box(bm, (fx0, wy0, WIN_Z1 - f), (fx1, wy1, WIN_Z1), idx["Mat_Frame"])  # head
    box(bm, (fx0, wy0, WIN_Z0 + f), (fx1, wy0 + f, WIN_Z1 - f), idx["Mat_Frame"])  # side (front)
    box(bm, (fx0, wy1 - f, WIN_Z0 + f), (fx1, wy1, WIN_Z1 - f), idx["Mat_Frame"])  # side (back)
    # Plant: pot cylinder plus leaf cone.
    px, py = PLANT_XY
    cylinder(bm, POT_R, POT_H, (px, py, 0.0), idx["Mat_Pot"])
    cone(bm, PLANT_CONE_R, PLANT_CONE_H, (px, py, POT_H), idx["Mat_Leaf"])
    # Tea tin.
    cylinder(bm, TIN_R, TIN_H, (TIN_XY[0], TIN_XY[1], 0.0), idx["Mat_Tin"])
    # Three books, stacked and turned slightly.
    bx, by = BOOKS_XY
    z = 0.0
    for w, d, h, yaw in BOOKS:
        box(bm, (bx - w / 2, by - d / 2, z), (bx + w / 2, by + d / 2, z + h), idx["Mat_Book"], yaw=yaw)
        z += h

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    assign_uvs(bm, "UVMap")
    mesh = bpy.data.meshes.new("Room")
    bm.to_mesh(mesh)
    bm.free()
    for name in ROOM_MATERIALS:
        mesh.materials.append(mats[name])
    mesh.update()
    return add_object("Room", mesh)


def build_mug(mats):
    t, h, fl = MUG_WALL, MUG_H, MUG_FLOOR
    # Hollow mug: outer wall, rim, inner wall, floor. Origin = centre of the base.
    bm = bmesh.new()
    lathe(bm, [(0, 0), (MUG_R_BASE, 0), (MUG_R_TOP, h), (MUG_R_TOP - t, h), (MUG_R_BASE - t, fl), (0, fl)])
    reach, hw, z0, z1 = MUG_HANDLE
    box(bm, (MUG_R_TOP - 0.004, -hw, z0), (MUG_R_TOP + reach, hw, z1))  # handle block on +X
    mesh = bpy.data.meshes.new("Mug")
    finish(bm, mesh, [mats["Mat_Mug"]])
    mug = add_object("Mug", mesh, (MUG_XY[0], MUG_XY[1], 0.0))

    # Tea surface: flat disc just under the rim, own material, facing up.
    tea_z = h - TEA_DEPTH
    r = MUG_R_TOP - t - 0.001
    tea_mesh = bpy.data.meshes.new("TeaSurface")
    verts = [(0.0, 0.0, 0.0)] + [
        (r * math.cos(2 * math.pi * k / SEGMENTS), r * math.sin(2 * math.pi * k / SEGMENTS), 0.0) for k in range(SEGMENTS)
    ]
    faces = [(0, 1 + k, 1 + (k + 1) % SEGMENTS) for k in range(SEGMENTS)]  # counter-clockwise from +Z
    tea_mesh.from_pydata(verts, [], faces)
    tea_mesh.materials.append(mats["Mat_Tea"])
    tea_mesh.update()
    add_object("TeaSurface", tea_mesh, (0.0, 0.0, tea_z), parent=mug)

    add_marker("Steam_Tea", (0.0, 0.0, h), parent=mug)  # centre of the opening at rim height
    return mug


def build_kettle(mats):
    bm = bmesh.new()
    # Body (Mat_Kettle).
    lathe(
        bm,
        [(0, 0), (KETTLE_R_BASE, 0), (KETTLE_R_MID, KETTLE_Z_MID), (KETTLE_R_TOP, KETTLE_BODY_H), (0, KETTLE_BODY_H)],
        mat=0,
    )
    # Spout: a bump on the -X side, slanting up and narrowing towards the opening.
    z0, z1 = SPOUT_TIP_Z
    frustum(
        bm,
        [(-0.045, -0.025, 0.06), (-0.045, 0.025, 0.06), (-0.045, 0.025, 0.115), (-0.045, -0.025, 0.115)],
        [(SPOUT_TIP_X, -0.012, z0), (SPOUT_TIP_X, 0.012, z0), (SPOUT_TIP_X, 0.012, z1), (SPOUT_TIP_X, -0.012, z1)],
    )
    # Handle block on +X.
    box(bm, (0.060, -0.01, 0.04), (0.092, 0.01, 0.13))
    # Lid and knob (Mat_KettleDetail): this is what makes Kettle a two-material group in the GLB.
    cylinder(bm, KETTLE_LID_R, KETTLE_LID_H, (0.0, 0.0, KETTLE_BODY_H), mat=1)
    cylinder(bm, KETTLE_KNOB_R, KETTLE_KNOB_H, (0.0, 0.0, KETTLE_BODY_H + KETTLE_LID_H), mat=1)
    mesh = bpy.data.meshes.new("Kettle")
    finish(bm, mesh, [mats[n] for n in KETTLE_MATERIALS])
    kettle = add_object("Kettle", mesh, (KETTLE_XY[0], KETTLE_XY[1], 0.0))

    # Spout opening: middle of the tip face.
    add_marker("Steam_Kettle", (SPOUT_TIP_X, 0.0, (z0 + z1) / 2), parent=kettle)
    return kettle


def build_window(mats):
    cx = COUNTER_X / 2
    glass_x = -cx - WALL_T / 2  # middle of the wall thickness
    zc = (WIN_Z0 + WIN_Z1) / 2
    quad_x("Window_Glass", (glass_x, WIN_Y, zc), WIN_W, WIN_Z1 - WIN_Z0, mats["Mat_Glass"])
    quad_x(
        "Window_Sky",
        (glass_x - SKY_OFFSET, WIN_Y, zc),
        WIN_W + 2 * SKY_PAD,
        (WIN_Z1 - WIN_Z0) + 2 * SKY_PAD,
        mats["Mat_Sky"],
    )
    add_marker("Rays_Origin", (glass_x, WIN_Y, zc))
    add_marker("Rays_Target", RAYS_TARGET)
    add_marker("Dust_Min", DUST_MIN)
    add_marker("Dust_Max", DUST_MAX)
    add_marker("Orbit_Target", ORBIT_TARGET)


# ---------------------------------------------------------------------- main -----------------


def build(out_path):
    # Reset to an empty file so the script is re-runnable and never inherits state.
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.unit_settings.length_unit = "METERS"

    mats = {name: make_material(name, hex_, GLASS_ALPHA if name == "Mat_Glass" else 1.0) for name, hex_ in PALETTE.items()}

    build_room(mats)
    build_mug(mats)
    build_kettle(mats)
    build_window(mats)

    out_path = os.path.abspath(out_path)
    if os.path.exists(out_path) and not FORCE:
        raise SystemExit(
            f"01_blockout: {out_path} already exists. Refusing to overwrite (phase 2 edits it live). "
            "Pass --force after the path to overwrite on purpose."
        )
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=out_path, compress=False)
    print(f"01_blockout: wrote {out_path}")


FORCE = False


def main():
    global FORCE
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    FORCE = "--force" in argv
    argv = [a for a in argv if a != "--force"]
    default = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "nook.blend")
    build(argv[0] if argv else default)


if __name__ == "__main__":
    main()
