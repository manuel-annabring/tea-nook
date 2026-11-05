"""Step 04: room details (slice 2.3).

Opens the .blend Blender was started with and REPLACES the geometry of the existing `Room` mesh data in
place (object, name, origin at the world origin, applied transforms, the 7 material slots in their
order and the first UV layer `UVMap` stay). Re-places the markers that depend on the window, rewrites
nothing else (`Mug`, `Kettle`, `TeaSurface`, `Window_Glass`, `Window_Sky` are not touched). Re-runnable:
the room is rebuilt from scratch each time.

Built in one bmesh: window frame with cross mullion, sill, head and casing; cabinet with toe kick,
doors with raised panels and handles; worktop with chamfered front and right edges; floor boards;
baseboards and a wall top trim; a tin with lid and lip; three books made of covers, pages and spine; and
two plants (slice F4): a floor plant (octagonal tapered pot, three curved stems, lobed leaves in an upper
and a lower cluster) and a hanging planter on the left wall (wall bracket, three ropes, octagonal bowl,
a mound of coin leaves and trailing vines with coin leaves). All of it stays inside `Room` (no new
objects, no new materials: stems and ropes use Mat_Wood, pots Mat_Pot, leaves Mat_Leaf). Leaves and coins
are single open surfaces (every material is double sided), so they cost 6 to 10 triangles each.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/04_room.py -- [output.blend]
Without an output path the opened file is saved in place.

NOTE: this rebuilds the `Room` mesh and drops the second UV layer `UV_AO` (slice 2.4), so the baked
`public/models/room_ao.png` no longer matches. If `UV_AO` exists the script refuses to run unless `--force`
is passed after the output path; after a forced run, re-run `05_ao_bake.py` (the contract check fails until then).
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

# Floor plant (slice F4): octagonal tapered pot, three thin curved stems, two leaf clusters.
PLANT_XY = (0.46, 0.10)
PLANT_REACH_X = (0.315, 0.585)  # leaves must stay right of the worktop (x 0.30) and on the floor (x 0.60)
PLANT_MAX_Y = 0.215  # and in front of the back wall (y 0.225)
POT_SIDES = 8
POT_PHASE = math.pi / 8  # half a segment, so a flat facet (not a corner) faces +X
POT_PROFILE = [  # (radius, z): underside centre, tapered wall (narrow at the bottom), thicker rim, inner wall, soil
    (0.0, 0.0),
    (0.030, 0.0),
    (0.048, 0.078),
    (0.0545, 0.078),  # rim underside, sticks out 6.5 mm
    (0.0545, 0.093),
    (0.0470, 0.093),  # rim top
    (0.0450, 0.085),  # inner wall
    (0.0, 0.085),  # soil level (Mat_Pot, there is no soil material)
]
# Stems: (lateral offset of the top from the pot axis (x, y), height of the top above the pot bottom, bulge of the
# curve sideways as a fraction of the height, direction of the bulge in degrees, base radius, top radius).
STEMS = [
    ((0.004, -0.008), 0.275, 0.035, 200.0, 0.0022, 0.0015),  # tallest: upper cluster
    ((-0.022, 0.012), 0.195, 0.04, 35.0, 0.0020, 0.0014),  # second: lower cluster
    ((0.004, 0.026), 0.150, 0.04, 280.0, 0.0018, 0.0013),  # shortest: one small leaf
]
STEM_SIDES, STEM_SEGMENTS = 4, 4
# Leaves: (stem index, yaw degrees, pitch above horizontal, roll degrees, length). Lobed leaf, see `lobed_leaf`.
PLANT_LEAVES = [  # (stem, yaw, pitch, roll, length, petiole length); leaves that point towards the camera (yaw about 295) droop, leaves that point away rise, so both show their faces
    (0, 305, 14, 6, 0.112, 0.030),
    (0, 335, 22, -8, 0.100, 0.028),
    (0, 48, 40, 10, 0.108, 0.030),
    (0, 118, 54, -6, 0.110, 0.028),
    (0, 195, 40, 8, 0.108, 0.030),
    (1, 318, 8, 8, 0.088, 0.024),
    (1, 28, 24, -8, 0.084, 0.024),
    (1, 135, 46, 10, 0.086, 0.024),
    (2, 250, 12, 6, 0.072, 0.020),
]
LEAF_WIDTH, LEAF_FOLD, LEAF_DROOP, LEAF_LOBE_DROP = 1.15, 0.08, 0.30, 0.08
PETIOLE_R = 0.0012  # leaf stalk radius (3 sided)  # width factor, vein rise, tip droop, lobe drop (fractions of length)

# Hanging planter on the left wall (slice F4), in front of the window (towards the camera, y < 0).
HANG_XY = (-0.200, -0.385)  # bowl axis: 5 cm away from the wall face (x -0.30) at the rim, 10 cm clear of the window sill
HANG_RIM_Z = 0.245  # rim height above the worktop top (the window runs 0.12 to 0.42)
HANG_ROPE_LEN = 0.125  # rope length measured vertically from the bowl rim to the bracket ring
HANG_MAX_Y = -0.255  # nothing may be further back than this (worktop front is -0.225, window casing -0.192)
BOWL_SIDES = 8
BOWL_PROFILE = [  # shallow bowl: underside, wide sloping wall, small lip, inner wall, soil
    (0.0, 0.0),
    (0.021, 0.0),
    (0.047, 0.032),
    (0.0505, 0.032),
    (0.0505, 0.038),
    (0.0465, 0.038),
    (0.0445, 0.031),
    (0.0, 0.031),
]
BRACKET_PLATE = (0.006, 0.026, 0.034)  # wall plate size (x thickness, y, z), flush on the wall
BRACKET_ARM = 0.008  # square arm section
ROPE_ANGLES = (35.0, 155.0, 275.0)  # where the three ropes meet the rim (degrees around the bowl axis)
ROPE_R = 0.0016  # rope radius (square section)
COIN_SIDES = 6
MOUND_COINS = [  # (radius from axis, angle deg, height above soil, tilt deg, radius of coin, spin deg)
    (0.000, 0, 0.030, 8, 0.022, 10),
    (0.020, 20, 0.023, 22, 0.021, 30),
    (0.020, 92, 0.024, 20, 0.022, 80),
    (0.020, 165, 0.022, 24, 0.021, 15),
    (0.020, 240, 0.024, 20, 0.022, 55),
    (0.020, 315, 0.023, 23, 0.020, 70),
    (0.037, 55, 0.014, 30, 0.021, 40),
    (0.037, 125, 0.015, 28, 0.020, 5),
    (0.037, 205, 0.014, 32, 0.021, 60),
    (0.037, 275, 0.014, 28, 0.020, 25),
    (0.042, 352, 0.012, 34, 0.019, 45),
]
# Vines: (angle deg, length, sway as a fraction of length, sway direction deg, coin count). They leave over the rim and hang
# straight down; each carries round coins at steps along it.
VINES = [
    (352.0, 0.250, 0.05, 90.0, 8),
    (50.0, 0.180, 0.06, 200.0, 6),
    (108.0, 0.290, 0.05, 330.0, 9),
    (205.0, 0.150, 0.07, 120.0, 5),
    (312.0, 0.215, 0.06, 20.0, 7),
]
VINE_R, VINE_SIDES = 0.0017, 3
VINE_COIN_R = (0.0165, 0.0115)  # coin radius near the bowl, near the tip

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


def lathe(bm, profile, centre, mat, segments=SEGMENTS, phase=0.0):
    """Solid of revolution around the Z axis through `centre`. `profile` is a list of (radius, z) points;
    radius 0 is a single vertex on the axis (a triangle fan). `phase` turns the ring (radians)."""
    cx, cy, cz = centre
    rings = []
    for r, z in profile:
        if r == 0:
            rings.append([bm.verts.new((cx, cy, cz + z))])
        else:
            rings.append(
                [
                    bm.verts.new((cx + r * math.cos(phase + 2 * math.pi * k / segments), cy + r * math.sin(phase + 2 * math.pi * k / segments), cz + z))
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


def tube(bm, points, radii, sides, mat, phase=0.0, caps=True):
    """Prism with `sides` faces along a polyline, radius per point (so it can taper). Closed (end caps) unless
    `caps` is false. Normals are fixed afterwards by the main `recalc_face_normals`."""
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((1, 0, 0))
        u = ref.cross(t).normalized()
        v = t.cross(u)
        ring = [
            bm.verts.new(p + radii[i] * (math.cos(phase + 2 * math.pi * k / sides) * u + math.sin(phase + 2 * math.pi * k / sides) * v))
            for k in range(sides)
        ]
        rings.append(ring)
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            k2 = (k + 1) % sides
            bm.faces.new((a[k], a[k2], b[k2], b[k])).material_index = mat
    if caps:
        bm.faces.new(rings[0]).material_index = mat
        bm.faces.new(rings[-1][::-1]).material_index = mat


def surface(bm, frame, coords, tris, mat, open_faces):
    """Single open surface (a leaf or a coin): `coords` in the local frame, `tris` index triples, counter-clockwise seen
    from the local +Z (that is the side the AO bake treats as the front). Faces go into `open_faces` so the closed-solid
    normal fix skips them."""
    verts = [bm.verts.new(frame @ Vector(c)) for c in coords]
    for a, b, c in tris:
        f = bm.faces.new((verts[a], verts[b], verts[c]))
        f.material_index = mat
        open_faces.append(f)
    return verts


def lobed_leaf(bm, base, yaw_deg, pitch_deg, roll_deg, length, mat, open_faces):
    """Palmate leaf, 10 triangles: a raised centre vein (base, two vein points, tip), a long pointed centre lobe and a pointed
    side lobe on each side, with a notch between them. The side lobes hang below the vein (a V fold along the vein) and the
    tip droops. Points forward along +X of its frame, which is yawed, pitched up and rolled about its own axis."""
    L = length
    w = LEAF_WIDTH

    def pt(x, y, vein):
        z = (LEAF_FOLD * L if vein else LEAF_FOLD * L - LEAF_LOBE_DROP * L * abs(y) / (0.40 * L * w)) - LEAF_DROOP * L * (x / L) ** 2
        return (x, y, z)

    coords = [
        pt(0.0, 0.0, True),  # 0 base
        pt(0.30 * L, 0.0, True),  # 1 vein point
        pt(0.62 * L, 0.0, True),  # 2 vein point
        pt(1.00 * L, 0.0, True),  # 3 tip
        pt(0.14 * L, -0.15 * L * w, False),  # 4 right shoulder
        pt(0.50 * L, -0.40 * L * w, False),  # 5 right lobe tip
        pt(0.70 * L, -0.14 * L * w, False),  # 6 right notch (between the side lobe and the long tip lobe)
        pt(0.14 * L, 0.15 * L * w, False),  # 7 left shoulder
        pt(0.50 * L, 0.40 * L * w, False),  # 8 left lobe tip
        pt(0.70 * L, 0.14 * L * w, False),  # 9 left notch
    ]
    # Counter-clockwise seen from above (+X forward, +Y left): the right side runs base -> lobe -> vein.
    tris = [
        (0, 4, 1), (4, 5, 1), (5, 2, 1), (5, 6, 2), (6, 3, 2),  # right side
        (0, 1, 7), (7, 1, 8), (8, 1, 2), (8, 2, 9), (9, 2, 3),  # left side
    ]
    frame = (
        Matrix.Translation(base)
        @ Matrix.Rotation(math.radians(yaw_deg), 4, "Z")
        @ Matrix.Rotation(-math.radians(pitch_deg), 4, "Y")
        @ Matrix.Rotation(math.radians(roll_deg), 4, "X")
    )
    surface(bm, frame, coords, tris, mat, open_faces)


def coin(bm, centre, radius, tilt_deg, spin_deg, mat, open_faces, sides=COIN_SIDES, dome=0.0015):
    """Round flat leaf: a hexagon fan (6 triangles) with the middle slightly raised so it is not perfectly flat. It is tilted
    by `tilt_deg` about an axis in the plane at `spin_deg` around Z."""
    coords = [(0.0, 0.0, dome)] + [(radius * math.cos(2 * math.pi * k / sides), radius * math.sin(2 * math.pi * k / sides), 0.0) for k in range(sides)]
    tris = [(0, 1 + k, 1 + (k + 1) % sides) for k in range(sides)]
    frame = Matrix.Translation(centre) @ Matrix.Rotation(math.radians(spin_deg), 4, "Z") @ Matrix.Rotation(math.radians(tilt_deg), 4, "Y")
    surface(bm, frame, coords, tris, mat, open_faces)


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


def check_bounds(bm, first_vert, label, x_range, y_range):
    """Fails loudly if any vertex created since `first_vert` (an index into bm.verts) leaves the allowed x and y range."""
    bm.verts.ensure_lookup_table()
    bm.verts.index_update()
    pts = [bm.verts[i].co for i in range(first_vert, len(bm.verts))]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    tris = sum(len(f.verts) - 2 for f in bm.faces if all(v.index >= first_vert for v in f.verts))
    print(f"[04_room] {label}: {tris} triangles, x {lo.x:.3f}..{hi.x:.3f}, y {lo.y:.3f}..{hi.y:.3f}, z {lo.z:.3f}..{hi.z:.3f}")
    if lo.x < x_range[0] - 1e-6 or hi.x > x_range[1] + 1e-6 or lo.y < y_range[0] - 1e-6 or hi.y > y_range[1] + 1e-6:
        raise SystemExit(f"04_room: {label} leaves its allowed area x {x_range}, y {y_range}")


def build_plant(bm, open_faces):
    """Floor plant: octagonal tapered pot, three thin curved stems of different height, lobed leaves in clusters."""
    v0 = len(bm.verts)
    px, py = PLANT_XY
    floor_top = -FLOOR_Z + max(BOARD_H)
    lathe(bm, POT_PROFILE, (px, py, floor_top), IDX["Mat_Pot"], POT_SIDES, POT_PHASE)
    soil_z = floor_top + POT_PROFILE[-1][1]
    tops = []
    for (ox, oy), height, bulge, bulge_deg, r0, r1 in STEMS:
        base = Vector((px, py, soil_z - 0.004))  # starts a little inside the pot so no gap shows
        top = Vector((px + ox, py + oy, floor_top + height))
        side = Vector((math.cos(math.radians(bulge_deg)), math.sin(math.radians(bulge_deg)), 0.0)) * (bulge * height)
        pts, radii = [], []
        for i in range(STEM_SEGMENTS + 1):
            t = i / STEM_SEGMENTS
            pts.append(base.lerp(top, t) + side * math.sin(math.pi * t))  # a gentle bow towards `side`
            radii.append(r0 + (r1 - r0) * t)
        tube(bm, pts, radii, STEM_SIDES, IDX["Mat_Wood"], phase=math.pi / 4)
        tops.append(pts[-1])
    for stem, yaw, pitch, roll, length, petiole in PLANT_LEAVES:
        yawr, pr = math.radians(yaw), math.radians(max(pitch, 10.0) * 0.8)
        # A thin leaf stalk fans each leaf out from the stem top (so the leaves do not pile up on one point and the stem stays visible).
        stalk = Vector((math.cos(yawr) * math.cos(pr), math.sin(yawr) * math.cos(pr), math.sin(pr))) * petiole
        base = tops[stem] + stalk
        tube(bm, [tops[stem], base], [PETIOLE_R, PETIOLE_R * 0.8], 3, IDX["Mat_Wood"], caps=True)
        lobed_leaf(bm, base, yaw, pitch, roll, length, IDX["Mat_Leaf"], open_faces)
    check_bounds(bm, v0, "floor plant", PLANT_REACH_X, (-1.0, PLANT_MAX_Y))


def build_wall_plant(bm, open_faces):
    """Hanging planter: wall plate and arm, three ropes, octagonal bowl, a mound of coin leaves and trailing vines."""
    v0 = len(bm.verts)
    hx, hy = HANG_XY
    wall_x = -COUNTER_X / 2  # inner face of the left wall
    rim_z = HANG_RIM_Z + 0.0  # top of the bowl lip is bowl_z + 0.038; the bowl is placed so that this is HANG_RIM_Z
    bowl_z = rim_z - BOWL_PROFILE[4][1]
    ring_z = rim_z + HANG_ROPE_LEN
    wd, pot, leaf = IDX["Mat_Wood"], IDX["Mat_Pot"], IDX["Mat_Leaf"]

    # Bracket: a small plate flush on the wall and a square arm that reaches out over the bowl axis, ending in a ring block.
    pt_x, pt_y, pt_z = BRACKET_PLATE
    box(bm, (wall_x, hy - pt_y / 2, ring_z + 0.004 - pt_z / 2), (wall_x + pt_x, hy + pt_y / 2, ring_z + 0.004 + pt_z / 2), wd)
    a = BRACKET_ARM / 2
    box(bm, (wall_x + pt_x - 0.001, hy - a, ring_z + 0.004 - a), (hx + a, hy + a, ring_z + 0.004 + a), wd)  # arm
    box(bm, (hx - 0.005, hy - 0.005, ring_z - 0.006), (hx + 0.005, hy + 0.005, ring_z + 0.004 - a), wd)  # ring block hanging below the arm end

    # Bowl and ropes (from the ring block to three points on the rim).
    lathe(bm, BOWL_PROFILE, (hx, hy, bowl_z), pot, BOWL_SIDES, math.pi / 8)
    rim_r = BOWL_PROFILE[3][0]
    ring = Vector((hx, hy, ring_z - 0.006))
    for deg in ROPE_ANGLES:
        r = math.radians(deg)
        rim_pt = Vector((hx + rim_r * math.cos(r), hy + rim_r * math.sin(r), rim_z - 0.004))
        tube(bm, [ring, rim_pt], [ROPE_R] * 2, 4, wd, phase=math.pi / 4)

    # Mound of coins on the soil.
    soil_z = bowl_z + BOWL_PROFILE[-1][1]
    for rad, deg, h, tilt, cr, spin in MOUND_COINS:
        d = math.radians(deg)
        c = Vector((hx + rad * math.cos(d), hy + rad * math.sin(d), soil_z + h))
        coin(bm, c, cr, tilt, spin + deg, leaf, open_faces)  # spin follows the angle so tilts lean outwards

    # Vines over the rim with coins along them.
    for deg, length, sway, sway_deg, n_coins in VINES:
        d, sd = math.radians(deg), math.radians(sway_deg)
        start = Vector((hx + (rim_r - 0.006) * math.cos(d), hy + (rim_r - 0.006) * math.sin(d), rim_z - 0.002))
        over = Vector((hx + (rim_r + 0.006) * math.cos(d), hy + (rim_r + 0.006) * math.sin(d), rim_z - 0.012))
        end_xy = Vector((hx + (rim_r + 0.008) * math.cos(d) + sway * length * math.cos(sd), hy + (rim_r + 0.008) * math.sin(d) + sway * length * math.sin(sd), 0.0))
        pts = [start, over, Vector((end_xy.x, end_xy.y, over.z - length))]  # in over the rim, then one straight hanging run
        radii = [VINE_R * (1.0 - 0.45 * i / (len(pts) - 1)) for i in range(len(pts))]
        tube(bm, pts, radii, VINE_SIDES, leaf, phase=0.5, caps=True)
        # Coins along the lower part of the vine: position by arc parameter, alternating sides, shrinking towards the tip.
        for j in range(n_coins):
            t = (j + 0.6) / (n_coins + 0.2)
            seg = min(int(t * (len(pts) - 1)), len(pts) - 2)
            f = t * (len(pts) - 1) - seg
            c = pts[seg].lerp(pts[seg + 1], f)
            side = 1.0 if j % 2 == 0 else -1.0
            cr = VINE_COIN_R[0] + (VINE_COIN_R[1] - VINE_COIN_R[0]) * t
            off = Vector((-math.sin(d), math.cos(d), 0.0)) * (side * cr * 0.55)  # beside the vine, so it hangs from a short stalk
            coin(bm, c + off, cr, 24.0 + 8.0 * (j % 3), 40.0 * j + deg, leaf, open_faces)
    check_bounds(bm, v0, "wall plant", (wall_x, 1.0), (-1.0, HANG_MAX_Y))


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
    force = "--force" in argv
    argv = [a for a in argv if a != "--force"]
    out = argv[0] if argv else None

    room = bpy.data.objects["Room"]
    mesh = room.data
    if "UV_AO" in mesh.uv_layers and not force:
        raise SystemExit(
            "04_room: Room already has the UV layer UV_AO (slice 2.4). Rebuilding the mesh would drop it and make "
            "public/models/room_ao.png stale. Pass --force after the output path and re-run 05_ao_bake.py afterwards."
        )
    assert [s.material.name for s in room.material_slots] == ROOM_MATERIALS, "Room material slots changed"
    assert tuple(room.location) == (0.0, 0.0, 0.0), "Room origin is not the world origin"

    bm = bmesh.new()
    open_faces = []
    build_walls_and_window(bm)
    build_floor(bm)
    build_cabinet(bm)
    build_plant(bm, open_faces)
    build_wall_plant(bm, open_faces)
    build_tin(bm)
    build_books(bm)

    # Outward normals for the closed solids; leaves and coins are open surfaces with explicit winding, so skip them.
    open_set = set(open_faces)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f not in open_set])
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
