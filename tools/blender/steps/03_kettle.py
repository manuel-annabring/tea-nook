"""Step 03: real kettle shape and Steam_Kettle marker (slice 2.2, retro polish in slice D4).

Opens the .blend Blender was started with, REPLACES the geometry of the existing `Kettle` mesh data in
place (object, name, parents, applied transforms, origin and the two material slots stay), moves the
`Steam_Kettle` marker to the centre of the spout opening, and saves. Re-runnable: it rebuilds the geometry
from scratch each time.

Slot 0 `Mat_Kettle` = body and spout (and the lid when LID_SLOT is 0). Slot 1 `Mat_KettleDetail` = base plate, handle, lid ring and
knob (and the lid when LID_SLOT is 1). Slice D4 also sets the Blender colour of `Mat_KettleDetail` (DETAIL_HEX) so previews and the
GLB match the runtime palette.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/03_kettle.py -- [output.blend]
Without an output path the opened file is saved in place.
"""

import math
import sys

import bpy
import bmesh
from mathutils import Vector

# ------------------------------------------------------------------ parameters (metres) -------
SEGMENTS = 18  # round parts (06_smooth_shading.py shades them smooth afterwards)
SPOUT_SIDES = 12  # the spout is a short faceted cone
SLOT_BODY, SLOT_DETAIL = 0, 1
DETAIL_HEX = "#3D3A38"  # Mat_KettleDetail: warm graphite (handle, base plate, ring, knob); the same value is PALETTE.Mat_KettleDetail in look.ts
# Slice D4: which slot the lid dome uses. The sage body colour (0) looks like reference 01 and the tea-station photo (cream
# lid, dark ring and knob); 1 would make the lid graphite like the handle.
LID_SLOT = SLOT_BODY

# Slice D4 (phase 2b): retro kettle, taller and softly tapered, on a thin dark base plate, with a dark handle, a lid ring and a knob.
# Same footprint class as before (handle on +X, spout to -X, bounding box x 0.055 to 0.278, y 0.045 to 0.175 in the world).
# Base plate (slot 1), bottom to top as (radius, z): 12 mm high, a little wider than the body, small chamfers.
PLATE = [
    (0.0000, 0.0000),  # origin: centre of the base, resting on the counter
    (0.0635, 0.0000),
    (0.0655, 0.0025),
    (0.0655, 0.0100),
    (0.0640, 0.0120),
    (0.0000, 0.0120),
]
# Body (slot 0): a soft cone from the plate to the shoulder. Its bottom starts inside the plate (hidden), its top inside the lid ring.
BODY = [
    (0.0000, 0.0100),
    (0.0610, 0.0100),
    (0.0632, 0.0260),  # widest point, just above the plate
    (0.0578, 0.0700),  # soft taper up
    (0.0508, 0.1150),
    (0.0455, 0.1420),  # shoulder
    (0.0440, 0.1500),
    (0.0000, 0.1500),
]
# Lid ring (slot 1): a collar that sits on the shoulder, 1.5 mm wider than the body, the chrome ring of the photo.
RING = [
    (0.0000, 0.1480),
    (0.0455, 0.1480),
    (0.0468, 0.1520),
    (0.0460, 0.1570),
    (0.0000, 0.1570),
]
# Lid (LID_SLOT): low dome that starts inside the ring (the ring top is a visible flat step around it).
LID = [
    (0.0000, 0.1560),
    (0.0400, 0.1560),
    (0.0382, 0.1625),
    (0.0300, 0.1700),
    (0.0180, 0.1755),
    (0.0100, 0.1775),
    (0.0000, 0.1775),
]
# Knob (slot 1): round, stands on the lid, top of the kettle at z 0.200.
KNOB = [
    (0.0000, 0.1740),
    (0.0125, 0.1740),
    (0.0135, 0.1830),
    (0.0110, 0.1930),
    (0.0060, 0.1985),
    (0.0000, 0.2000),
]

# Spout (slot 0): short cone from inside the body wall to a tip, pointing to -X and up (axis in the XZ plane).
SPOUT_BASE = Vector((-0.042, 0.0, 0.066))  # centre of the buried base ring
SPOUT_TIP = Vector((-0.094, 0.0, 0.116))  # centre of the opening = Steam_Kettle
SPOUT_R_BASE = 0.0240
SPOUT_R_TIP = 0.0095  # outer radius at the opening
SPOUT_WALL = 0.0030  # rim thickness at the opening
SPOUT_BORE = 0.0200  # how deep the opening goes before it is closed

# Handle (slot 1, dark): thick D loop on +X, swept along a half ellipse in the XZ plane (lower end low on the body,
# upper end high on the shoulder; both ends sit inside the wall).
HANDLE_MID_Z = 0.0900
HANDLE_HALF_H = 0.0400  # half height of the path
HANDLE_REACH = 0.0480  # how far the loop bulges out
HANDLE_X_LOW = 0.0540  # attachment x at the lower end
HANDLE_X_HIGH = 0.0410  # attachment x at the upper end
HANDLE_HALF_W = 0.0105  # half thickness across the loop (Y)
HANDLE_HALF_T = 0.0095  # half thickness in the loop plane (XZ)
HANDLE_STEPS = 10
HANDLE_RING = 8

HEIGHT = KNOB[-1][1]  # about 0.20 (contract: within 5 mm)
# Where the kettle must stay: the bounding box of the previous kettle relative to its axis (x 0.17, y 0.11), so everything D1 to D3
# placed around it keeps its clearance.
BBOX_X = (-0.1145, 0.1083)
BBOX_Y = (-0.0655, 0.0655)


def profile_radius(profile, z):
    """Radius of a polyline profile (list of (r, z), z ascending) at height z."""
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 != z1 and z0 <= z <= z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    raise ValueError(f"z={z} outside profile")


def ring_at(bm, centre, r, axis_u, axis_v, n):
    return [
        bm.verts.new(centre + axis_u * (r * math.cos(2 * math.pi * k / n)) + axis_v * (r * math.sin(2 * math.pi * k / n)))
        for k in range(n)
    ]


def bridge(bm, a, b, slot, closed=True):
    n = len(a)
    for k in range(n if closed else n - 1):
        k2 = (k + 1) % n
        f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
        f.material_index = slot


def revolve(bm, profile, slot):
    """Revolve a (r, z) polyline around Z. Points with r == 0 become a single vertex (fan)."""
    rings = []
    for r, z in profile:
        if r == 0:
            rings.append([bm.verts.new((0.0, 0.0, z))])
        else:
            rings.append(ring_at(bm, Vector((0, 0, z)), r, Vector((1, 0, 0)), Vector((0, 1, 0)), SEGMENTS))
    for a, b in zip(rings, rings[1:]):
        for k in range(SEGMENTS):
            k2 = (k + 1) % SEGMENTS
            if len(a) == 1 and len(b) == 1:
                continue
            if len(a) == 1:
                face = (a[0], b[k], b[k2])
            elif len(b) == 1:
                face = (a[k], a[k2], b[0])
            else:
                face = (a[k], a[k2], b[k2], b[k])
            bm.faces.new(face).material_index = slot


def build_spout(bm):
    axis = (SPOUT_TIP - SPOUT_BASE).normalized()
    u = Vector((0, 1, 0))  # perpendicular to the axis (axis lies in XZ)
    v = axis.cross(u)
    n = SPOUT_SIDES
    base = ring_at(bm, SPOUT_BASE, SPOUT_R_BASE, u, v, n)
    tip_out = ring_at(bm, SPOUT_TIP, SPOUT_R_TIP, u, v, n)
    tip_in = ring_at(bm, SPOUT_TIP, SPOUT_R_TIP - SPOUT_WALL, u, v, n)
    bore_c = SPOUT_TIP - axis * SPOUT_BORE
    bore = ring_at(bm, bore_c, SPOUT_R_TIP - SPOUT_WALL, u, v, n)
    for p in base:  # the buried cap must really be inside the body wall (1 mm margin)
        assert math.hypot(p.co.x, p.co.y) < profile_radius(BODY, p.co.z) - 0.001, f"spout base ring leaves the body at z={p.co.z:.4f}"
    bridge(bm, base, tip_out, SLOT_BODY)  # outer cone
    bridge(bm, tip_out, tip_in, SLOT_BODY)  # flat rim around the opening
    bridge(bm, tip_in, bore, SLOT_BODY)  # inner tube
    bm.faces.new(base[::-1]).material_index = SLOT_BODY  # buried base cap
    bm.faces.new(bore).material_index = SLOT_BODY  # closed bottom of the opening


def build_handle(bm):
    rings = []
    for i in range(HANDLE_STEPS + 1):
        t = -math.pi / 2 + math.pi * i / HANDLE_STEPS
        s = (math.sin(t) + 1) / 2
        x0 = HANDLE_X_LOW + (HANDLE_X_HIGH - HANDLE_X_LOW) * s
        p = Vector((x0 + HANDLE_REACH * math.cos(t), 0.0, HANDLE_MID_Z + HANDLE_HALF_H * math.sin(t)))
        tan = Vector((-HANDLE_REACH * math.sin(t) + (HANDLE_X_HIGH - HANDLE_X_LOW) * math.cos(t) / 2, 0.0, HANDLE_HALF_H * math.cos(t))).normalized()
        n_in = Vector((tan.z, 0.0, -tan.x))
        ring = []
        for k in range(HANDLE_RING):
            a = 2 * math.pi * k / HANDLE_RING + math.pi / HANDLE_RING
            ring.append(bm.verts.new(p + n_in * (HANDLE_HALF_T * math.cos(a)) + Vector((0, 1, 0)) * (HANDLE_HALF_W * math.sin(a))))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        bridge(bm, a, b, SLOT_DETAIL)
    bm.faces.new(rings[0][::-1]).material_index = SLOT_DETAIL
    bm.faces.new(rings[-1]).material_index = SLOT_DETAIL
    for ring in (rings[0], rings[-1]):  # both caps must sit inside the body wall (1 mm margin)
        for p in ring:
            assert math.hypot(p.co.x, p.co.y) < profile_radius(BODY, p.co.z) - 0.001, f"handle end leaves the body at z={p.co.z:.4f}"


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None

    kettle = bpy.data.objects["Kettle"]
    marker = bpy.data.objects["Steam_Kettle"]
    mesh = kettle.data
    assert [s.material.name for s in kettle.material_slots] == ["Mat_Kettle", "Mat_KettleDetail"], "slots changed"

    bm = bmesh.new()
    revolve(bm, PLATE, SLOT_DETAIL)
    revolve(bm, BODY, SLOT_BODY)
    revolve(bm, RING, SLOT_DETAIL)
    revolve(bm, LID, LID_SLOT)
    revolve(bm, KNOB, SLOT_DETAIL)
    build_spout(bm)
    build_handle(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = False
    bm.to_mesh(mesh)  # replaces all geometry in place; slots, object and origin untouched
    bm.free()
    mesh.update()

    marker.location = SPOUT_TIP  # local to Kettle (parent has identity transform at the origin)

    # The glTF export needs a graphite Mat_KettleDetail (SPEC phase 2b, slice D4); look.ts carries the same value (D-107).
    detail = bpy.data.materials["Mat_KettleDetail"]
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    rgb = tuple(lin(int(DETAIL_HEX[i : i + 2], 16) / 255.0) for i in (1, 3, 5))
    detail.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1.0)
    detail.diffuse_color = (*rgb, 1.0)

    pts = [v.co for v in mesh.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    print(f"[03_kettle] local bounds x {lo.x:.4f}..{hi.x:.4f} y {lo.y:.4f}..{hi.y:.4f} z {lo.z:.4f}..{hi.z:.4f} (allowed x {BBOX_X}, y {BBOX_Y})")
    assert BBOX_X[0] - 0.0005 <= lo.x and hi.x <= BBOX_X[1] + 0.0005, "kettle leaves its x footprint"
    assert BBOX_Y[0] - 0.0005 <= lo.y and hi.y <= BBOX_Y[1] + 0.0005, "kettle leaves its y footprint"
    assert abs(hi.z - 0.200) <= 0.005 and abs(lo.z) < 1e-6, "kettle height is not about 0.20 m"
    slots = {i: sum(1 for p in mesh.polygons if p.material_index == i) for i in (0, 1)}
    tri = sum(len(p.vertices) - 2 for p in mesh.polygons)
    print(f"[03_kettle] triangles={tri} verts={len(mesh.vertices)} faces per slot={slots} lid_slot={LID_SLOT} marker={tuple(round(c, 4) for c in marker.location)}")

    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
