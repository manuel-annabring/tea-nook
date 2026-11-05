"""Step 06: smooth shading with sharp edges on Mug and Kettle (fix F3).

Blender concept: every face has a normal (the direction it faces, used for lighting). "Flat" shading uses
that one normal for the whole face, so every facet of a low-poly cylinder shows. "Smooth" shading gives
each corner of a face a blended normal (the average of the faces around that vertex), so the surface
reads as round while the geometry stays exactly the same. Where two faces meet at a real corner (a rim,
a lid seam, a cap), the edge is marked SHARP: the normals are split there, so the corner stays crisp.
Blender calls these per-corner results "split normals", and the glTF exporter writes them out, which
splits vertices along sharp edges.

This step keeps all geometry (faces, vertices positions, triangle counts) and only changes two kinds of
flags: faces become smooth, and edges become sharp when the angle between their two faces is above
ANGLE_DEG, when they sit between two different material slots, or when they are not shared by exactly two
faces. Blender 5 has no auto-smooth flag any more; sharp edges are stored on the mesh itself.

Re-runnable and idempotent: the flags are recomputed from the geometry each time, nothing accumulates.
Steps 02 (mug) and 03 (kettle) rebuild the geometry flat shaded, so run this step again after re-running them.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/06_smooth_shading.py -- [output.blend]
Without an output path the opened file is saved in place.
"""

import hashlib
import math
import struct
import sys

import bpy
import bmesh

# ------------------------------------------------------------------ parameters -------
ANGLE_DEG = 50.0  # edges between faces that differ by more than this are sharp
OBJECTS = ["Mug", "Kettle"]  # edited in place; object, mesh data, slots and origin stay


def smooth_by_angle(mesh, angle_deg):
    """Make all faces smooth and mark sharp edges by angle, material change or non-manifold."""
    limit = math.radians(angle_deg)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for f in bm.faces:
        f.smooth = True
    sharp = 0
    for e in bm.edges:
        is_sharp = False
        if len(e.link_faces) != 2:
            is_sharp = True
        else:
            f0, f1 = e.link_faces
            if f0.material_index != f1.material_index:
                is_sharp = True
            elif e.calc_face_angle(0.0) > limit:
                is_sharp = True
        e.smooth = not is_sharp
        sharp += is_sharp
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return sharp


def mesh_hash(mesh):
    """Hash of positions, face topology, smooth flags and sharp edges (to compare two runs)."""
    h = hashlib.sha1()
    for v in mesh.vertices:
        h.update(struct.pack("<3f", *v.co))
    for p in mesh.polygons:
        h.update(struct.pack(f"<{len(p.vertices) + 2}i", p.material_index, int(p.use_smooth), *p.vertices))
    for e in mesh.edges:
        h.update(struct.pack("<3i", e.vertices[0], e.vertices[1], int(e.use_edge_sharp)))
    return h.hexdigest()[:16]


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None

    for name in OBJECTS:
        obj = bpy.data.objects[name]
        mesh = obj.data
        tri = sum(len(p.vertices) - 2 for p in mesh.polygons)
        before = (tri, len(mesh.vertices), len(mesh.edges), len(mesh.polygons))
        sharp = smooth_by_angle(mesh, ANGLE_DEG)
        tri_after = sum(len(p.vertices) - 2 for p in mesh.polygons)
        smooth_faces = sum(p.use_smooth for p in mesh.polygons)
        assert tri_after == tri and len(mesh.vertices) == before[1], "geometry changed"
        print(
            f"[06_smooth] {name}: triangles={tri_after} verts={len(mesh.vertices)} faces={len(mesh.polygons)} "
            f"smooth_faces={smooth_faces} sharp_edges={sharp}/{len(mesh.edges)} angle={ANGLE_DEG} hash={mesh_hash(mesh)}"
        )

    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
