"""Step 03: real kettle shape and Steam_Kettle marker (slice 2.2).

Opens the .blend Blender was started with, REPLACES the geometry of the existing `Kettle` mesh data in
place (object, name, parents, applied transforms, origin and the two material slots stay), moves the
`Steam_Kettle` marker to the centre of the spout opening, and saves. Re-runnable: it rebuilds the geometry
from scratch each time.

Slot 0 `Mat_Kettle` = body, spout, handle. Slot 1 `Mat_KettleDetail` = lid and knob.

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
SEGMENTS = 18  # round parts; flat shaded on purpose (same as the mug and the blockout)
SLOT_BODY, SLOT_DETAIL = 0, 1

# Body, bottom to top as (radius, z): truncated cone with a soft foot and a rounded shoulder.
# r = 0 closes the profile on the axis (underside centre, top centre).
BODY = [
    (0.0000, 0.0000),  # origin: centre of the base, resting on the counter
    (0.0580, 0.0000),
    (0.0650, 0.0070),  # rounded foot
    (0.0655, 0.0200),  # widest point
    (0.0560, 0.0950),  # straight taper up
    (0.0505, 0.1250),  # shoulder
    (0.0430, 0.1420),
    (0.0400, 0.1450),  # opening edge, the lid covers it
    (0.0000, 0.1450),
]
# Lid: sits slightly proud of the body (overhang 4.5 mm), low dome, then the knob.
LID = [
    (0.0000, 0.1420),  # underside centre (hidden inside the lid)
    (0.0445, 0.1420),
    (0.0445, 0.1490),  # lid rim
    (0.0400, 0.1560),
    (0.0300, 0.1650),
    (0.0170, 0.1710),
    (0.0090, 0.1730),  # lid top, knob stands on it
]
KNOB = [
    (0.0090, 0.1730),
    (0.0125, 0.1780),
    (0.0130, 0.1860),
    (0.0095, 0.1930),
    (0.0000, 0.1960),  # top of the kettle
]
LID = LID + KNOB[1:]  # one revolve for lid and knob

# Spout: short cone from inside the body wall to a tip, pointing to -X and up (axis in the XZ plane).
SPOUT_BASE = Vector((-0.048, 0.0, 0.050))  # centre of the buried base ring
SPOUT_TIP = Vector((-0.108, 0.0, 0.108))  # centre of the opening = Steam_Kettle
SPOUT_R_BASE = 0.0210
SPOUT_R_TIP = 0.0095  # outer radius at the opening
SPOUT_WALL = 0.0030  # rim thickness at the opening
SPOUT_BORE = 0.0200  # how deep the opening goes before it is closed

# Handle: thick D loop on +X, swept along a half ellipse in the XZ plane (lower end low on the body,
# upper end high on the shoulder; both ends sit inside the wall).
HANDLE_MID_Z = 0.0900
HANDLE_HALF_H = 0.0400  # half height of the path
HANDLE_REACH = 0.0500  # how far the loop bulges out
HANDLE_X_LOW = 0.0580  # attachment x at the lower end
HANDLE_X_HIGH = 0.0410  # attachment x at the upper end
HANDLE_HALF_W = 0.0105  # half thickness across the loop (Y)
HANDLE_HALF_T = 0.0095  # half thickness in the loop plane (XZ)
HANDLE_STEPS = 10
HANDLE_RING = 8


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
    base = ring_at(bm, SPOUT_BASE, SPOUT_R_BASE, u, v, SEGMENTS)
    tip_out = ring_at(bm, SPOUT_TIP, SPOUT_R_TIP, u, v, SEGMENTS)
    tip_in = ring_at(bm, SPOUT_TIP, SPOUT_R_TIP - SPOUT_WALL, u, v, SEGMENTS)
    bore_c = SPOUT_TIP - axis * SPOUT_BORE
    bore = ring_at(bm, bore_c, SPOUT_R_TIP - SPOUT_WALL, u, v, SEGMENTS)
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
        bridge(bm, a, b, SLOT_BODY)
    bm.faces.new(rings[0][::-1]).material_index = SLOT_BODY
    bm.faces.new(rings[-1]).material_index = SLOT_BODY


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None

    kettle = bpy.data.objects["Kettle"]
    marker = bpy.data.objects["Steam_Kettle"]
    mesh = kettle.data
    assert [s.material.name for s in kettle.material_slots] == ["Mat_Kettle", "Mat_KettleDetail"], "slots changed"

    bm = bmesh.new()
    revolve(bm, BODY, SLOT_BODY)
    revolve(bm, LID, SLOT_DETAIL)
    build_spout(bm)
    build_handle(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = False
    bm.to_mesh(mesh)  # replaces all geometry in place; slots, object and origin untouched
    bm.free()
    mesh.update()

    marker.location = SPOUT_TIP  # local to Kettle (parent has identity transform at the origin)

    tri = sum(len(p.vertices) - 2 for p in mesh.polygons)
    print(f"[03_kettle] triangles={tri} verts={len(mesh.vertices)} marker={tuple(round(c, 4) for c in marker.location)}")

    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
