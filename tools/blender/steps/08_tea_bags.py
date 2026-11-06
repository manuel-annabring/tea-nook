"""Step 08: the four tea bag packets `TeaBag_0` to `TeaBag_3` (slice D3, SPEC.md section 5 amendment of 2026-11-06 and section 7).

Opens the .blend Blender was started with and CREATES OR REPLACES, by name, four mesh objects. Re-runnable: an existing `TeaBag_<i>` keeps its
object and gets new mesh data (so there are never `TeaBag_0.001` duplicates), stray `TeaBag_<i>.NNN` objects are removed. Nothing else in the
file is touched (`Room`, `Mug`, `Kettle`, markers). The box they stand in is part of `Room` and built by `04_room.py` from the same layout
file `tools/blender/tea_layout.py`.

Each packet:
- is its own object, because phase 3 lifts and clicks a packet on its own (a part of `Room` cannot move),
- has parent none, rotation 0, scale 1 (transforms applied; the placement is the object location only),
- has its origin at the centre of its base, so "lift by 15 mm" in code is `position.y += 0.015` in glTF space,
- has exactly one material, its own `Mat_Bag<i>` (the colour of tea i, set from `TEAS` in the app; the materials already exist from slice D1),
- is a low poly flat sachet: a six sided prism (box with a gabled, crimped top) 22 mm wide, 40 mm deep and 60 mm high, plus a small pointed tab
  on top of the crimp at the front, so the packets read as bags and not as blocks. Flat shaded like the other props, 36 triangles.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/08_tea_bags.py -- [output.blend]
Without an output path the opened file is saved in place. The bags are baked as occluders by `05_ao_bake.py` (they stand in the slots), so after
changing them re-run `04_room.py --force` and `05_ao_bake.py`.
"""

import math
import os
import re
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
import tea_layout as tea  # noqa: E402

# ------------------------------------------------------------------ parameters (metres) -------
EAVE_Z = 0.046  # height where the vertical walls end and the gabled crimp starts
RIDGE_Z = 0.054  # top of the crimp (the ridge runs along y)
RIDGE_HALF_W = 0.003  # half width of the flat ridge
TAB_THICK = 0.0035  # the pointed tab on the front end of the crimp (y)
TAB_HALF_W = 0.0065  # half width of the tab (wider than the ridge: it overhangs the two roof slopes)
TAB_TOP_Z = 0.060  # tip of the tab = packet height
TOL = 1e-4  # transform check
ORIGIN_TOL = 0.001  # contract: origin at the base centre within 1 mm
BOX_TOL = 0.005  # layout table: within 5 mm
COLLECTION_FROM = "Room"  # the bags go into the collection of Room

assert abs(tea.BAG_H - TAB_TOP_Z) < 1e-9, "tea_layout.BAG_H and the tab tip differ"


def prism(bm, profile, y0, y1):
    """Closed prism: `profile` is a convex outline of (x, z) points, extruded from y0 to y1."""
    a = [bm.verts.new((x, y0, z)) for x, z in profile]
    b = [bm.verts.new((x, y1, z)) for x, z in profile]
    n = len(profile)
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))


def build_geometry(bm):
    hw, hd = tea.BAG_W / 2, tea.BAG_D / 2
    body = [(-hw, 0.0), (hw, 0.0), (hw, EAVE_Z), (RIDGE_HALF_W, RIDGE_Z), (-RIDGE_HALF_W, RIDGE_Z), (-hw, EAVE_Z)]
    prism(bm, body, -hd, hd)
    tab = [(-TAB_HALF_W, RIDGE_Z - 0.004), (TAB_HALF_W, RIDGE_Z - 0.004), (TAB_HALF_W, RIDGE_Z + 0.0015), (0.0, TAB_TOP_Z), (-TAB_HALF_W, RIDGE_Z + 0.0015)]
    prism(bm, tab, -hd, -hd + TAB_THICK)  # at the front (-Y), flush with the front face
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    for f in bm.faces:
        f.smooth = False


def steam_radii():
    """Plan-view axes and full radii of the two steam columns (marker positions from the file, radius from steamDefaults.ts)."""
    root = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
    text = open(os.path.join(root, "src", "nook", "steamDefaults.ts")).read()
    out = []
    for name, marker, const in (("tea", "Steam_Tea", "STEAM_LOOK_DEFAULTS"), ("kettle", "Steam_Kettle", "KETTLE_STEAM_LOOK")):
        block = re.search(r"export const " + const + r": SteamLook = \{\n(.*?)^\}", text, re.S | re.M)
        radius = float(re.search(r"^\s*radius: ([0-9.]+),", block.group(1), re.M).group(1))
        pos = bpy.data.objects[marker].matrix_world.translation
        out.append((name, pos.x, pos.y, pos.z, radius))
    return out


def make_bag(i, collection):
    name = f"TeaBag_{i}"
    for o in [o for o in bpy.data.objects if re.fullmatch(re.escape(name) + r"\.\d{3}", o.name)]:
        bpy.data.objects.remove(o, do_unlink=True)  # a stray duplicate from an earlier experiment
    obj = bpy.data.objects.get(name)
    if obj is not None and obj.type != "MESH":
        raise SystemExit(f"08_tea_bags: {name} exists but is a {obj.type}")
    mesh = obj.data if obj is not None else bpy.data.meshes.new(name)
    bm = bmesh.new()
    build_geometry(bm)
    bm.to_mesh(mesh)  # replaces all geometry in place (object, name, links stay)
    bm.free()
    mesh.name = name
    mesh.update()
    if obj is None:
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
    mat = bpy.data.materials.get(f"Mat_Bag{i}")
    if mat is None:
        raise SystemExit(f"08_tea_bags: material Mat_Bag{i} is missing (run 04_room.py first, it creates it)")
    mesh.materials.clear()
    mesh.materials.append(mat)
    obj.parent = None
    obj.rotation_euler = (0.0, 0.0, 0.0)
    obj.rotation_mode = "XYZ"
    obj.scale = (1.0, 1.0, 1.0)
    obj.location = (tea.BAG_X[i], tea.BAG_Y, tea.BAG_BASE_Z)
    obj.matrix_parent_inverse.identity()
    return obj


def check_bags(objs):
    cols = steam_radii()
    print("[08_tea_bags] per bag: location (m), size (mm), base centre offset from the origin (mm), triangles, material")
    for i, obj in enumerate(objs):
        name = f"TeaBag_{i}"
        assert obj.name == name and obj.data.name == name, f"{name}: object or mesh data name is wrong ({obj.name}, {obj.data.name})"
        assert obj.parent is None, f"{name}: must have no parent"
        assert max(abs(obj.rotation_euler[k]) for k in range(3)) < TOL and max(abs(obj.scale[k] - 1.0) for k in range(3)) < TOL, f"{name}: transforms not applied"
        assert [s.material.name for s in obj.material_slots] == [f"Mat_Bag{i}"], f"{name}: must have exactly Mat_Bag{i}"
        pts = [v.co for v in obj.data.vertices]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        low = [p for p in pts if p.z <= lo.z + 1e-6]
        base = Vector(((min(p.x for p in low) + max(p.x for p in low)) / 2, (min(p.y for p in low) + max(p.y for p in low)) / 2, lo.z))
        assert base.length < ORIGIN_TOL, f"{name}: origin is {base.length * 1000:.2f} mm off the base centre"
        size = (hi - lo) * 1000
        assert abs(size.x - tea.BAG_W * 1000) < 0.01 and abs(size.y - tea.BAG_D * 1000) < 0.01 and abs(size.z - tea.BAG_H * 1000) < 0.01, f"{name}: size is not the layout size"
        world_centre = obj.location + Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, 0.0))
        dev = max(abs(world_centre.x - tea.BAG_X[i]), abs(world_centre.y - tea.BAG_Y)) * 1000
        assert dev < BOX_TOL * 1000, f"{name}: centre is {dev:.1f} mm off the layout table"
        obj.data.calc_loop_triangles()
        tris = len(obj.data.loop_triangles)
        print(f"  {name}  ({obj.location.x:.4f}, {obj.location.y:.4f}, {obj.location.z:.4f})  size {size.x:.1f} x {size.y:.1f} x {size.z:.1f}  base offset {base.length * 1000:.2f}  {tris} tris  {obj.material_slots[0].material.name}")
        # plan view distance of the packet's box to the full steam column radius (columns start above the bags, so this is a worst case)
        for cname, cx, cy, _cz, radius in cols:
            dx = max(lo.x + obj.location.x - cx, cx - (hi.x + obj.location.x), 0.0)
            dy = max(lo.y + obj.location.y - cy, cy - (hi.y + obj.location.y), 0.0)
            gap = math.hypot(dx, dy) - radius
            assert gap > 0.015, f"{name} is only {gap * 1000:.1f} mm from the {cname} steam column"
            print(f"      to the {cname} steam column (full radius {radius * 1000:.0f} mm, plan view): {gap * 1000:.0f} mm")
    names = [o.name for o in bpy.data.objects if o.name.startswith("TeaBag")]
    assert sorted(names) == [f"TeaBag_{i}" for i in range(4)], f"unexpected TeaBag objects: {names}"
    assert not any(re.search(r"\.\d{3}$", m.name) for m in bpy.data.meshes if m.name.startswith("TeaBag")), "duplicate mesh data name"


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None
    collection = bpy.data.objects[COLLECTION_FROM].users_collection[0]
    objs = [make_bag(i, collection) for i in range(4)]
    bpy.context.view_layer.update()
    check_bags(objs)
    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
