"""Step 02: real mug shape, tea disc and Steam_Tea marker (slice 2.1; wider, rounder teacup in slice D4).

Opens the .blend Blender was started with, REPLACES the geometry of the existing `Mug` and
`TeaSurface` mesh data in place (objects, names, parents, materials, origins and applied
transforms stay), moves the `Steam_Tea` marker to the centre of the opening at rim height,
and saves. Re-runnable: it rebuilds the geometry from scratch each time.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/02_mug.py -- [output.blend]
Without an output path the opened file is saved in place.
"""

import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

# ------------------------------------------------------------------ parameters (metres) -------
SEGMENTS = 18  # round parts (06_smooth_shading.py shades them smooth afterwards)

# Slice D4 (phase 2b): a wider, rounder teacup (open mouth, rounded belly, small foot, small loop handle) that sits on the saucer
# built by 04_room.py. Still 0.09 high, origin at the centre of the base, handle on +X.
# Outer profile of the body, bottom to top: (radius, z). r = 0 closes the profile on the axis (underside centre).
OUTER = [
    (0.0000, 0.0000),  # underside centre = the origin (the base rests on the saucer well, which is 1.3 mm above the worktop)
    (0.0230, 0.0000),  # flat underside of the small foot
    (0.0262, 0.0035),  # foot bevel
    (0.0350, 0.0105),  # belly starts to swell
    (0.0425, 0.0220),
    (0.0460, 0.0360),  # round belly
    (0.0476, 0.0520),
    (0.0482, 0.0680),  # widest: the cup opens up towards the mouth
    (0.0474, 0.0868),  # lip, rounded: outer shoulder
    (0.0462, 0.0900),  # rim, outer edge (z = rim height = mug height)
    (0.0432, 0.0900),  # rim, inner edge: the lip is 3 mm wide on top
]
# Inner wall, top to bottom, ending at the inner floor centre (radius 0). Wall 3.5 to 4.5 mm thick.
INNER = [
    (0.0428, 0.0860),  # inner shoulder
    (0.0438, 0.0680),
    (0.0428, 0.0520),
    (0.0390, 0.0340),
    (0.0305, 0.0190),
    (0.0170, 0.0115),
    (0.0000, 0.0100),  # inner floor, 10 mm above the base
]
MUG_H = 0.0900
MUG_SCALE = 0.90  # slice H1: the whole cup (body, handle, tea, marker) is built at the D4 size above and scaled about its base centre by this factor
TEA_DEPTH = 0.0080  # tea surface this far below the rim
TEA_INSET = 0.0005  # tea disc radius is this much smaller than the inner wall at that height

# Handle: a small D-shaped loop on +X swept along a half ellipse. Its farthest point is 74 mm from the cup axis
# (the tea box starts at x 0.13, so 56 mm of clearance remain).
HANDLE_CENTRE_Z = 0.0560  # middle of the loop
HANDLE_HALF_H = 0.0195  # half height of the loop (path)
HANDLE_REACH = 0.0235  # how far the path bulges out beyond its attachment x
HANDLE_X0 = 0.0440  # attachment x: inside the wall (wall spans about 0.0385 to 0.0478 at these heights)
HANDLE_HALF_W = 0.0068  # half thickness across the loop (Y)
HANDLE_HALF_T = 0.0058  # half thickness in the loop plane (XZ)
HANDLE_STEPS = 8  # segments along the loop
HANDLE_RING = 8  # corners of the cross-section


def lerp_radius(profile, z):
    """Radius of a polyline profile (list of (r, z)) at height z."""
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if min(z0, z1) <= z <= max(z0, z1) and z0 != z1:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    raise ValueError(f"z={z} outside profile")


def lathe_ring(bm, r, z, segments):
    return [
        bm.verts.new((r * math.cos(2 * math.pi * k / segments), r * math.sin(2 * math.pi * k / segments), z))
        for k in range(segments)
    ]


def build_body(bm):
    """Hollow body: one closed profile revolved around Z (outer wall, lip, inner wall, floor)."""
    profile = OUTER + INNER
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((0.0, 0.0, z))] if r == 0 else lathe_ring(bm, r, z, SEGMENTS))
    # Close the loop: the last ring (inner floor centre) joins back to the first (underside centre).
    rings.append(rings[0])
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
            bm.faces.new(face)


def build_handle(bm):
    """Sweep a small hexagonal ring along a half ellipse in the XZ plane (a D-shaped loop)."""
    rings = []
    for i in range(HANDLE_STEPS + 1):
        t = -math.pi / 2 + math.pi * i / HANDLE_STEPS
        p = Vector((HANDLE_X0 + HANDLE_REACH * math.cos(t), 0.0, HANDLE_CENTRE_Z + HANDLE_HALF_H * math.sin(t)))
        # Tangent of the ellipse, then the in-plane normal (perpendicular, in XZ).
        tan = Vector((-HANDLE_REACH * math.sin(t), 0.0, HANDLE_HALF_H * math.cos(t))).normalized()
        n_in = Vector((tan.z, 0.0, -tan.x))
        ring = []
        for k in range(HANDLE_RING):
            a = 2 * math.pi * k / HANDLE_RING
            ring.append(bm.verts.new(p + n_in * (HANDLE_HALF_T * math.cos(a)) + Vector((0, 1, 0)) * (HANDLE_HALF_W * math.sin(a))))
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(HANDLE_RING):
            k2 = (k + 1) % HANDLE_RING
            bm.faces.new((a[k], a[k2], b[k2], b[k]))
    bm.faces.new(rings[0][::-1])  # end caps (they sit inside the wall)
    bm.faces.new(rings[-1])


def write_mesh(bm, mesh):
    """Normals outwards, flat shading, then overwrite the existing mesh datablock in place."""
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    for f in bm.faces:
        f.smooth = False
    bm.to_mesh(mesh)  # replaces all geometry of `mesh`; material slots and the object are untouched
    bm.free()
    mesh.update()


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None

    mug = bpy.data.objects["Mug"]
    tea = bpy.data.objects["TeaSurface"]
    marker = bpy.data.objects["Steam_Tea"]

    # Mug: body plus handle in one mesh, still one material slot (Mat_Mug).
    bm = bmesh.new()
    build_body(bm)
    build_handle(bm)
    bmesh.ops.scale(bm, vec=(MUG_SCALE, MUG_SCALE, MUG_SCALE), verts=bm.verts[:], space=Matrix.Identity(4))  # origin = base centre, so it stays put
    write_mesh(bm, mug.data)

    # Tea: flat disc, local z = 0, so the origin is its centre. Only the object's z moves.
    tea_z = (MUG_H - TEA_DEPTH) * MUG_SCALE
    r = (lerp_radius(INNER, MUG_H - TEA_DEPTH) - TEA_INSET) * MUG_SCALE
    bm = bmesh.new()
    ring = lathe_ring(bm, r, 0.0, SEGMENTS)
    bm.faces.new(ring)
    write_mesh(bm, tea.data)
    tea.location = (0.0, 0.0, tea_z)

    # Marker: centre of the opening at rim height (position only).
    marker.location = (0.0, 0.0, MUG_H * MUG_SCALE)

    tri = lambda m: sum(len(p.vertices) - 2 for p in m.polygons)
    print(f"[02_mug] mug triangles={tri(mug.data)} tea triangles={tri(tea.data)} tea_z={tea_z:.4f} tea_r={r:.4f} rim_z={MUG_H * MUG_SCALE}")

    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
