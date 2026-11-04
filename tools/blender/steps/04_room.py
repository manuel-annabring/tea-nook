"""Step 04: room details (slice 2.3).

Opens the .blend Blender was started with and REPLACES the geometry of the existing `Room` mesh data in
place (object, name, origin at the world origin, applied transforms, the 7 material slots in their
order and the first UV layer `UVMap` stay). Re-places the markers that depend on the window, rewrites
nothing else (`Mug`, `Kettle`, `TeaSurface`, `Window_Glass`, `Window_Sky` are not touched). Re-runnable:
the room is rebuilt from scratch each time.

Built in one bmesh: window frame with cross mullion, sill, head and casing; cabinet with toe kick,
doors with raised panels and handles; worktop with chamfered front and right edges; floor boards;
baseboards and a wall top trim; a pot with a rim and a fan of parametric leaves; a tin with lid and
lip; three books made of covers, pages and spine.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/04_room.py -- [output.blend]
Without an output path the opened file is saved in place.
"""

import math
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

# ------------------------------------------------------------------ parameters (metres) -------
# Layout numbers are the ones of 01_blockout.py (the composition of slice 2.0); keep them in step.
COUNTER_X, COUNTER_Y, COUNTER_T = 0.60, 0.45, 0.03  # worktop footprint and thickness; top surface is z = 0
WALL_H, WALL_T = 0.50, 0.02  # wall top above the worktop top, wall thickness
CABINET_H = 0.30
FLOOR_Z = COUNTER_T + CABINET_H  # floor surface is this far below the origin
CABINET_INSET = 0.015
FLOOR_FRONT, FLOOR_RIGHT = 0.25, 0.30
FLOOR_T, PLINTH_T, PLINTH_OVERHANG = 0.02, 0.05, 0.02

# Window opening in the left wall (-X); same numbers as the blockout.
WIN_Y, WIN_W = 0.0, 0.36
WIN_Z0, WIN_Z1 = 0.12, 0.42
FRAME_W = 0.020  # outer frame bar width (lines the opening)
FRAME_X = (-0.325, -0.295)  # frame bars: 5 mm proud of the wall on both sides
MULLION_W = 0.012  # cross bars between the four panes
MULLION_X = (-0.318, -0.302)  # thinner than the frame, glass plane (x = -0.31) runs through it
SILL_OUT, SILL_PROUD, SILL_T, SILL_SIDE = 0.005, 0.045, 0.016, 0.02  # sill: behind wall face, into room, thick, side overhang
HEAD_T, HEAD_PROUD, HEAD_SIDE = 0.016, 0.040, 0.012  # head board above the opening
CASING_W, CASING_PROUD = 0.012, 0.008  # side trim strips beside the frame (in the room)

# Cabinet.
KICK_H, KICK_IN = 0.030, 0.020  # toe kick height, how far it is recessed from the front and the right side
DOOR_GAP, DOOR_PROUD = 0.006, 0.008
PANEL_INSET, PANEL_PROUD = 0.022, 0.003  # raised panel on each door
HANDLE_W, HANDLE_H, HANDLE_BAR, HANDLE_STAND = 0.008, 0.055, 0.004, 0.007  # handle bar width, height, thickness, stand-off
HANDLE_Z, HANDLE_EDGE = -0.062, 0.020  # handle centre below the worktop underside, distance from the door gap
WORKTOP_CHAMFER = 0.006

# Floor boards: run along Y (towards the camera), a 4 mm groove between boards, ends staggered.
BOARD_W, BOARD_GAP = 0.058, 0.004
BOARD_H = (0.0040, 0.0058)  # two heights, alternating: the "alternating raised boards" of the brief
BOARD_JOINT = (0.34, 0.62, 0.48, 0.71, 0.27)  # joint position as a fraction of the length, cycled per board

# Walls: baseboard and top trim (Mat_Frame).
BASE_H, BASE_T = 0.040, 0.008
TRIM_H, TRIM_OVER = 0.014, 0.006  # top trim height (inside WALL_H) and overhang per side

# Plant (pot with rim, leaves fanned around the centre).
PLANT_XY = (0.46, 0.10)
POT_PROFILE = [  # (radius, z) from the underside centre outwards, over the rim and down the inside
    (0.0, 0.0),
    (0.030, 0.0),
    (0.046, 0.074),
    (0.0525, 0.074),  # rim underside
    (0.0525, 0.090),
    (0.0455, 0.090),  # rim top
    (0.0440, 0.082),  # inner wall
    (0.0, 0.082),  # soil level
]
LEAF_COUNT = 11
LEAF_LEN = (0.085, 0.118)  # shortest and longest leaf
LEAF_WIDTH_FRAC = 0.68  # width as a fraction of length
LEAF_PITCH = (50.0, 22.0)  # degrees above horizontal: upper tier, lower tier
LEAF_DROOP, LEAF_FOLD, LEAF_THICK = 0.16, 0.06, 0.0025  # tip droop and midrib fold as fractions of length, thickness
LEAF_BASE_R = 0.006  # leaves start this far from the pot axis

# Tin on the worktop.
TIN_XY = (-0.20, -0.13)
TIN_PROFILE = [
    (0.0, 0.0),
    (0.030, 0.0),
    (0.030, 0.054),  # body wall
    (0.0325, 0.054),  # lid lip sticks out
    (0.0325, 0.065),
    (0.0295, 0.070),  # chamfered lid top
    (0.0070, 0.070),
    (0.0070, 0.076),  # small knob
    (0.0, 0.076),
]

# Books on the worktop: (width x, depth y, height z, yaw degrees) bottom to top. Spine on the -Y side
# before yaw, so yaw 90 turns the spine towards +X (the camera side).
BOOKS_XY = (-0.01, 0.17)
BOOKS = [
    (0.105, 0.075, 0.020, 4.0),
    (0.095, 0.068, 0.017, 96.0),
    (0.085, 0.062, 0.015, -7.0),
]
COVER_T, SPINE_T, PAGES_INSET = 0.0022, 0.0045, 0.0035

SEGMENTS = 16  # round parts, flat shaded on purpose (low poly)

# Material slot order of the merged Room mesh (never changes).
ROOM_MATERIALS = ["Mat_Wall", "Mat_Wood", "Mat_Frame", "Mat_Leaf", "Mat_Pot", "Mat_Tin", "Mat_Book"]
IDX = {name: i for i, name in enumerate(ROOM_MATERIALS)}

# Markers that depend on the window (positions only, never renamed).
RAYS_TARGET = (-0.10, 0.0, 0.0)  # on the worktop top, where the sun lands
DUST_MIN, DUST_MAX = (-0.28, -0.20, -0.05), (0.30, 0.15, 0.30)  # box inside the lit area
ORBIT_TARGET = (0.14, -0.12, 0.0)

# --------------------------------------------------------------------------- helpers -----------


def box(bm, lo, hi, mat, frame=None):
    """Box from corner lo to corner hi in the frame `frame` (a Matrix, default world). Returns the verts."""
    lo, hi = Vector(lo), Vector(hi)
    m = Matrix.Translation((lo + hi) / 2) @ Matrix.Diagonal(((hi - lo).x, (hi - lo).y, (hi - lo).z, 1.0))
    if frame is not None:
        m = frame @ m
    res = bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    for f in {f for v in res["verts"] for f in v.link_faces}:
        f.material_index = mat
    return res["verts"]


def lathe(bm, profile, centre, mat, segments=SEGMENTS):
    """Solid of revolution around the Z axis through `centre`. `profile` is a list of (radius, z) points;
    radius 0 is a single vertex on the axis (a triangle fan)."""
    cx, cy, cz = centre
    rings = []
    for r, z in profile:
        if r == 0:
            rings.append([bm.verts.new((cx, cy, cz + z))])
        else:
            rings.append(
                [
                    bm.verts.new((cx + r * math.cos(2 * math.pi * k / segments), cy + r * math.sin(2 * math.pi * k / segments), cz + z))
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


def leaf(bm, base, yaw, pitch_deg, length, mat, leaf_faces):
    """One flat low-poly leaf (a folded diamond, 4 triangles on top and 4 below) fanned out from `base`.
    Local frame: the leaf points along +X, its midrib is folded up, its tip droops."""
    w = length * LEAF_WIDTH_FRAC
    top = [
        (0.0, 0.0, 0.0),  # 0 base
        (0.40 * length, -w / 2, 0.0),  # 1 left
        (0.40 * length, 0.0, LEAF_FOLD * length),  # 2 midrib (folded up)
        (0.40 * length, w / 2, 0.0),  # 3 right
        (length, 0.0, -LEAF_DROOP * length),  # 4 tip
    ]
    frame = Matrix.Translation(base) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(-math.radians(pitch_deg), 4, "Y")
    tri = [(0, 1, 2), (0, 2, 3), (1, 4, 2), (2, 4, 3)]  # counter-clockwise seen from above
    up = [bm.verts.new(frame @ Vector(p)) for p in top]
    down = [bm.verts.new(frame @ (Vector(p) - Vector((0, 0, LEAF_THICK)))) for p in top]
    for a, b, c in tri:
        leaf_faces.append(bm.faces.new((up[a], up[b], up[c])))
        leaf_faces.append(bm.faces.new((down[a], down[c], down[b])))  # reversed: faces down
    # Close the thin edge: side quads along the outline (base-left, left-tip, tip-right, right-base).
    for a, b in ((0, 1), (1, 4), (4, 3), (3, 0)):
        leaf_faces.append(bm.faces.new((up[a], down[a], down[b], up[b])))
    for f in leaf_faces:
        f.material_index = mat


def assign_uvs(bm, layer_name):
    """Box-projection UVs in metres, dominant axis per face (same as the blockout; slice 2.4 adds UV_AO)."""
    layer = bm.loops.layers.uv.new(layer_name)
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        a, b = [i for i in range(3) if i != ax]
        for loop in f.loops:
            loop[layer].uv = (loop.vert.co[a], loop.vert.co[b])


# ---------------------------------------------------------------------------- parts ------------


def build_walls_and_window(bm):
    cx, cy = COUNTER_X / 2, COUNTER_Y / 2
    floor_top = -FLOOR_Z
    fx_max, fy_min = cx + FLOOR_RIGHT, -cy - FLOOR_FRONT
    wall_top = WALL_H - TRIM_H  # the trim brings the silhouette back up to WALL_H
    m = IDX["Mat_Wall"]
    fr = IDX["Mat_Frame"]

    box(bm, (-cx - WALL_T, cy, floor_top), (fx_max, cy + WALL_T, wall_top), m)  # back wall
    x0, x1 = -cx - WALL_T, -cx
    wy0, wy1 = WIN_Y - WIN_W / 2, WIN_Y + WIN_W / 2
    box(bm, (x0, fy_min, floor_top), (x1, wy0, wall_top), m)  # left wall in four pieces around the opening
    box(bm, (x0, wy1, floor_top), (x1, cy, wall_top), m)
    box(bm, (x0, wy0, floor_top), (x1, wy1, WIN_Z0), m)
    box(bm, (x0, wy0, WIN_Z1), (x1, wy1, wall_top), m)

    # Window: outer frame bars lining the opening, cross mullion, sill, head, casing.
    fa, fb = FRAME_X
    f = FRAME_W
    box(bm, (fa, wy0, WIN_Z0), (fb, wy1, WIN_Z0 + f), fr)  # bottom bar
    box(bm, (fa, wy0, WIN_Z1 - f), (fb, wy1, WIN_Z1), fr)  # top bar
    box(bm, (fa, wy0, WIN_Z0 + f), (fb, wy0 + f, WIN_Z1 - f), fr)  # side bars
    box(bm, (fa, wy1 - f, WIN_Z0 + f), (fb, wy1, WIN_Z1 - f), fr)
    ma, mb = MULLION_X
    yc, zc = WIN_Y, (WIN_Z0 + WIN_Z1) / 2
    box(bm, (ma, yc - MULLION_W / 2, WIN_Z0 + f), (mb, yc + MULLION_W / 2, WIN_Z1 - f), fr)  # vertical mullion
    box(bm, (ma, wy0 + f, zc - MULLION_W / 2), (mb, wy1 - f, zc + MULLION_W / 2), fr)  # horizontal mullion
    # Sill: protrudes into the room (and a little outside), overhangs the opening sideways.
    box(bm, (x0 - SILL_OUT, wy0 - SILL_SIDE, WIN_Z0 - SILL_T), (x1 + SILL_PROUD, wy1 + SILL_SIDE, WIN_Z0), fr)
    # Head board over the opening.
    box(bm, (x0 - SILL_OUT, wy0 - HEAD_SIDE, WIN_Z1), (x1 + HEAD_PROUD, wy1 + HEAD_SIDE, WIN_Z1 + HEAD_T), fr)
    # Casing strips beside the opening, on the room side of the wall.
    for ya, yb in ((wy0 - CASING_W, wy0), (wy1, wy1 + CASING_W)):
        box(bm, (x1 - 0.002, ya, WIN_Z0), (x1 + CASING_PROUD, yb, WIN_Z1), fr)

    # Baseboards along both walls (inside the room) and the wall top trim.
    bz = floor_top
    box(bm, (-cx - WALL_T, cy - BASE_T, bz), (fx_max, cy, bz + BASE_H), fr)  # back wall
    box(bm, (x1, fy_min, bz), (x1 + BASE_T, cy - BASE_T, bz + BASE_H), fr)  # left wall
    o = TRIM_OVER
    box(bm, (-cx - WALL_T - o, cy - o, wall_top), (fx_max + o, cy + WALL_T + o, WALL_H), fr)  # top of back wall
    box(bm, (x0 - o, fy_min - o, wall_top), (x1 + o, cy - o, WALL_H), fr)  # top of left wall


def build_floor(bm):
    cx, cy = COUNTER_X / 2, COUNTER_Y / 2
    floor_top = -FLOOR_Z
    fx_max, fy_min = cx + FLOOR_RIGHT, -cy - FLOOR_FRONT
    wd = IDX["Mat_Wood"]
    # Plinth and floor slab.
    box(bm, (-cx - WALL_T - PLINTH_OVERHANG, fy_min - PLINTH_OVERHANG, floor_top - FLOOR_T - PLINTH_T), (fx_max + PLINTH_OVERHANG, cy + WALL_T + PLINTH_OVERHANG, floor_top - FLOOR_T), wd)
    box(bm, (-cx - WALL_T, fy_min, floor_top - FLOOR_T), (fx_max, cy + WALL_T, floor_top), wd)
    # Boards: a loop over columns; each column is cut in two pieces at its own joint position.
    x_start, x_end = -cx, fx_max  # inside the left wall face
    y0, y1 = fy_min, cy
    pitch = BOARD_W + BOARD_GAP
    n = int((x_end - x_start) // pitch)
    margin = (x_end - x_start - n * pitch + BOARD_GAP) / 2  # centre the boards, equal strip at both ends
    for i in range(n):
        bx0 = x_start + margin + i * pitch
        h = BOARD_H[i % 2]
        j = y0 + (y1 - y0) * BOARD_JOINT[i % len(BOARD_JOINT)]
        box(bm, (bx0, y0 + 0.004, floor_top), (bx0 + BOARD_W, j - BOARD_GAP / 2, floor_top + h), wd)
        box(bm, (bx0, j + BOARD_GAP / 2, floor_top), (bx0 + BOARD_W, y1 - 0.004, floor_top + h), wd)


def build_cabinet(bm):
    cx, cy = COUNTER_X / 2, COUNTER_Y / 2
    floor_top = -FLOOR_Z + max(BOARD_H)  # cabinet stands on the boards
    wd, fr = IDX["Mat_Wood"], IDX["Mat_Frame"]
    cab_hi_x, cab_lo_y = cx - CABINET_INSET, -cy + CABINET_INSET
    carcass_z0 = floor_top + KICK_H

    # Toe kick: a recessed wooden plinth under the carcass (reads as a dark gap with AO later).
    box(bm, (-cx, cab_lo_y + KICK_IN, floor_top), (cab_hi_x - KICK_IN, cy, carcass_z0), wd)
    # Carcass.
    box(bm, (-cx, cab_lo_y, carcass_z0), (cab_hi_x, cy, -COUNTER_T), fr)

    # Worktop: a box with chamfered top-front, top-right and the front-right vertical edge.
    verts = box(bm, (-cx, -cy, -COUNTER_T), (cx, cy, 0.0), wd)
    vs = set(verts)
    eps = 1e-6
    edges = {
        e
        for v in verts
        for e in v.link_edges
        if e.verts[0] in vs
        and e.verts[1] in vs
        and (
            all(abs(w.co.y + cy) < eps and abs(w.co.z) < eps for w in e.verts)  # top front
            or all(abs(w.co.x - cx) < eps and abs(w.co.z) < eps for w in e.verts)  # top right
            or all(abs(w.co.x - cx) < eps and abs(w.co.y + cy) < eps for w in e.verts)  # front-right vertical
        )
    }
    res = bmesh.ops.bevel(bm, geom=list(edges), offset=WORKTOP_CHAMFER, offset_type="OFFSET", segments=1, affect="EDGES")
    for f in res["faces"]:
        f.material_index = wd

    # Two doors with a raised panel and a bar handle each (a loop over both doors).
    door_w = (cab_hi_x + cx - 3 * DOOR_GAP) / 2
    dz0, dz1 = carcass_z0 + DOOR_GAP, -COUNTER_T - DOOR_GAP
    for i in range(2):
        dx0 = -cx + DOOR_GAP + i * (door_w + DOOR_GAP)
        dx1 = dx0 + door_w
        box(bm, (dx0, cab_lo_y - DOOR_PROUD, dz0), (dx1, cab_lo_y, dz1), fr)
        p = PANEL_INSET
        box(bm, (dx0 + p, cab_lo_y - DOOR_PROUD - PANEL_PROUD, dz0 + p), (dx1 - p, cab_lo_y - DOOR_PROUD, dz1 - p), fr)
        # Handle near the gap between the doors: door 0 at its right edge, door 1 at its left edge.
        hx = dx1 - HANDLE_EDGE if i == 0 else dx0 + HANDLE_EDGE
        zc = -COUNTER_T + HANDLE_Z
        y_face = cab_lo_y - DOOR_PROUD - PANEL_PROUD
        y_bar = y_face - HANDLE_STAND
        box(bm, (hx - HANDLE_W / 2, y_bar - HANDLE_BAR, zc - HANDLE_H / 2), (hx + HANDLE_W / 2, y_bar, zc + HANDLE_H / 2), wd)
        for sz in (zc - HANDLE_H / 2 + 0.008, zc + HANDLE_H / 2 - 0.008):  # two small posts
            box(bm, (hx - 0.002, y_bar, sz - 0.002), (hx + 0.002, y_face, sz + 0.002), wd)


def build_plant(bm, leaf_faces):
    px, py = PLANT_XY
    floor_top = -FLOOR_Z + max(BOARD_H)
    lathe(bm, POT_PROFILE, (px, py, floor_top), IDX["Mat_Pot"])
    soil_z = floor_top + POT_PROFILE[-1][1]
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(LEAF_COUNT):
        t = i / (LEAF_COUNT - 1)
        tier = i % 2  # alternate upper and lower tier
        yaw = i * golden
        length = LEAF_LEN[0] + (LEAF_LEN[1] - LEAF_LEN[0]) * (0.5 + 0.5 * math.sin(i * 2.3)) * (1.0 if tier == 0 else 0.8)
        base = Vector((px + LEAF_BASE_R * math.cos(yaw), py + LEAF_BASE_R * math.sin(yaw), soil_z - 0.002))
        pitch = LEAF_PITCH[tier] + 6.0 * math.sin(i * 1.7)
        leaf(bm, base, yaw, pitch, length, IDX["Mat_Leaf"], leaf_faces)


def build_tin(bm):
    lathe(bm, TIN_PROFILE, (TIN_XY[0], TIN_XY[1], 0.0), IDX["Mat_Tin"])


def build_books(bm):
    bx, by = BOOKS_XY
    z = 0.0
    cover, pages_mat = IDX["Mat_Book"], IDX["Mat_Frame"]
    for w, d, h, yaw in BOOKS:
        frame = Matrix.Translation((bx, by, z)) @ Matrix.Rotation(math.radians(yaw), 4, "Z")
        hw, hd = w / 2, d / 2
        box(bm, (-hw, -hd, 0.0), (hw, hd, COVER_T), cover, frame)  # bottom cover
        box(bm, (-hw, -hd, h - COVER_T), (hw, hd, h), cover, frame)  # top cover
        box(bm, (-hw, -hd, COVER_T), (hw, -hd + SPINE_T, h - COVER_T), cover, frame)  # spine (on -Y)
        i = PAGES_INSET
        box(bm, (-hw + i, -hd + SPINE_T, COVER_T), (hw - i, hd - i, h - COVER_T), pages_mat, frame)  # page block
        z += h


# ------------------------------------------------------------------------------ main ------------


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None

    room = bpy.data.objects["Room"]
    mesh = room.data
    assert [s.material.name for s in room.material_slots] == ROOM_MATERIALS, "Room material slots changed"
    assert tuple(room.location) == (0.0, 0.0, 0.0), "Room origin is not the world origin"

    bm = bmesh.new()
    leaf_faces = []
    build_walls_and_window(bm)
    build_floor(bm)
    build_cabinet(bm)
    build_plant(bm, leaf_faces)
    build_tin(bm)
    build_books(bm)

    # Outward normals for the closed solids; leaves are open shells with explicit winding, so skip them.
    leaf_set = set(leaf_faces)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f not in leaf_set])
    for f in bm.faces:
        f.smooth = False
    assign_uvs(bm, "UVMap")
    bm.to_mesh(mesh)  # replaces all geometry in place; slots, object, origin and transforms untouched
    bm.free()
    mesh.update()

    # Markers (positions only). Rays_Origin is the centre of the window opening, same as Window_Glass.
    glass = bpy.data.objects["Window_Glass"]
    bpy.data.objects["Rays_Origin"].location = glass.location
    bpy.data.objects["Rays_Target"].location = RAYS_TARGET
    bpy.data.objects["Dust_Min"].location = DUST_MIN
    bpy.data.objects["Dust_Max"].location = DUST_MAX
    bpy.data.objects["Orbit_Target"].location = ORBIT_TARGET

    tri = sum(len(p.vertices) - 2 for p in mesh.polygons)
    print(f"[04_room] triangles={tri} verts={len(mesh.vertices)} uv={[l.name for l in mesh.uv_layers]}")

    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
