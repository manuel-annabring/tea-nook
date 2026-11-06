"""Step 04: room details (slice 2.3).

Opens the .blend Blender was started with and REPLACES the geometry of the existing `Room` mesh data in
place (object, name, origin at the world origin, applied transforms, the 7 material slots in their
order and the first UV layer `UVMap` stay). Re-places the markers that depend on the window, rewrites
nothing else (`Mug`, `Kettle`, `TeaSurface`, `Window_Glass`, `Window_Sky` are not touched). Re-runnable:
the room is rebuilt from scratch each time.

Built in one bmesh: window frame with cross mullion, sill and casing (no head board since slice G2); cabinet with toe kick,
doors with raised panels and handles; worktop with chamfered front and right edges; floor boards;
baseboards and a wall top trim; a tin with lid and lip; three books made of covers, pages and spine; and
two plants (slice F4): a floor plant (octagonal tapered pot, three curved stems, lobed leaves in an upper
and a lower cluster) and a hanging planter on the left wall (wall bracket, three ropes, octagonal bowl,
a mound of coin leaves and trailing vines with coin leaves). All of it stays inside `Room` (no new
objects, no new materials: stems and ropes use Mat_Wood, pots Mat_Pot, leaves Mat_Leaf). Leaves and coins
are single open surfaces (every material is double sided), so they cost 10 to 12 triangles each. Slice G2: the organic plant
parts (leaves, coins, stems, stalks, ropes, vines) are shaded smooth, the rest of `Room` (and the pots, see `SMOOTH_POTS`)
stays flat; the coin leaves of the hanging planter are 12 sided and irregular; the vines follow a serpentine path; the window
sits `WIN_DZ` lower and has no head board. `07_window_lower.py` moves `Window_Glass`, `Window_Sky` and `Rays_Origin` by the
same amount (this script keeps `Rays_Origin` on the glass, so run 07 once after changing `WIN_DZ`).

Slice D1 (phase 2b, SPEC section 7 layout table) adds a back-wall shelf on two iron brackets with four jars, and a rail with four
hooks and four hanging mugs. They are new builder functions (`build_shelf`, `build_jars`, `build_rail`), their material slots are
appended after the original seven (`Mat_Iron`, `Mat_Bag0` to `Mat_Bag3`, plus `Mat_Glass` only when `JAR_GLASS` is "glass"). The
script prints and checks the bounding box of every new part against the layout table (5 mm) and the plan-view clearance of
every new part to the two steam columns (15 mm), with the steam numbers read from `src/nook/steamDefaults.ts`.

Slice D2 adds three picture frames on the back wall (`build_frames`: Mat_Wood border, Mat_Frame panel, a cup, leaf and heart pictogram
extruded 2 mm out of the panel as flat polygons in Mat_Pot and Mat_Leaf). `check_frames` prints and asserts the depth, the pictogram raise,
the separation from every other part and the apparent steam table of the D0 planner formula.

Slice D3 adds the body of the tea box on the worktop (`build_tea_box`: a solid base, front and back walls, two end walls and three
dividers, all Mat_Wood, four slots whose centres come from `tools/blender/tea_layout.py`). The four packets are NOT part of `Room`: they are
the objects `TeaBag_0..3` made by `08_tea_bags.py`. `check_tea_box` prints the clearance to the mug, the planned saucer, the kettle and the tin.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/04_room.py -- [output.blend]
Option `--jar-glass=glass|tinted` overrides `JAR_GLASS` (used by the D1 spike).
Without an output path the opened file is saved in place.

NOTE: this rebuilds the `Room` mesh and drops the second UV layer `UV_AO` (slice 2.4), so the baked
`public/models/room_ao.png` no longer matches. If `UV_AO` exists the script refuses to run unless `--force`
is passed after the output path; after a forced run, re-run `05_ao_bake.py` (the contract check fails until then).
"""

import math
import os
import random
import re
import sys

import bpy
import bmesh
from mathutils import Matrix, Quaternion, Vector

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import tea_layout as tea  # noqa: E402  (box and bag layout shared with 08_tea_bags.py)

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
WIN_DZ = -0.04  # slice G2: the whole window (opening, frame, sill, mullion, casing) sits this much lower than in 2.3
WIN_Z0, WIN_Z1 = 0.12 + WIN_DZ, 0.42 + WIN_DZ  # opening: sill top and lintel underside above the worktop top
FRAME_W = 0.020  # outer frame bar width (lines the opening)
FRAME_X = (-0.325, -0.295)  # frame bars: 5 mm proud of the wall on both sides
MULLION_W = 0.012  # cross bars between the four panes
MULLION_X = (-0.318, -0.302)  # thinner than the frame, glass plane (x = -0.31) runs through it
SILL_OUT, SILL_PROUD, SILL_T, SILL_SIDE = 0.005, 0.045, 0.016, 0.02  # sill: behind wall face, into room, thick, side overhang
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
# End joints (slice G2): the far piece of each board is END_STEP lower than the near piece and the gap is END_GAP wide. The visible
# face of an end joint would be the end of the far piece, which faces the camera and is lit directly by the front fill (the baked AO
# only dims the hemisphere light), so it read as a bright line. With the far piece lower, the near piece hides that face from every
# allowed camera angle (the sight line into the gap is END_GAP * tan(elevation) deep, under 2.2 mm up to 35 degrees) and only the
# soft contact AO on the lower piece remains as the line.
END_GAP, END_STEP = 0.003, 0.003

# Walls: baseboard and top trim (Mat_Frame).
BASE_H, BASE_T = 0.040, 0.008
TRIM_H, TRIM_OVER = 0.014, 0.006  # top trim height (inside WALL_H) and overhang per side

# Shading (slice G2). Organic plant parts are shaded smooth; boxes, floor, cabinet, books and tin stay flat. The pots (and the
# hanging bowl) stay octagonal and faceted unless this is True (then they are smooth with sharp edges above POT_SHARP_DEG).
SMOOTH_POTS = False
POT_SHARP_DEG = 50.0
RNG_SEED = 20261105  # leaf irregularity of the hanging planter (deterministic)

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
HANG_MAX_Y = -0.318  # nothing may be further back than this: 9 cm clear of the worktop front (-0.225), 11.8 cm of the sill edge (-0.20), as in F4
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
COIN_SIDES = 12  # coin leaves are 12 sided (G2; were hexagons), triangle fan with a raised middle
COIN_JITTER = 0.10  # radius jitter per vertex (plus or minus 10 percent)
COIN_ASPECT = (0.90, 1.10)  # slightly oval: x scale of the outline
LEAF_FOLLOW = 0.7  # how much a vine leaf turns with the local tangent of the vine (0 = none, 1 = fully)
MOUND_COINS = [  # (radius from axis, angle deg, height above soil, tilt deg, radius of coin, spin deg)
    (0.000, 0, 0.030, 8, 0.022, 10),
    (0.020, 20, 0.023, 22, 0.021, 30),
    (0.020, 92, 0.024, 20, 0.022, 80),
    (0.020, 165, 0.022, 24, 0.021, 15),
    (0.020, 240, 0.024, 20, 0.022, 55),
    (0.020, 315, 0.023, 23, 0.020, 70),
    (0.037, 55, 0.014, 30, 0.021, 40),
    (0.037, 205, 0.014, 32, 0.021, 60),
    (0.042, 352, 0.012, 34, 0.019, 45),
]
# Vines: (angle deg, length, sway as a fraction of length, sway direction deg, coin count, amplitude radial, amplitude tangential,
# phase radial, phase tangential, waves). They leave over the rim and hang as a gentle serpentine: two sine offsets in the two
# horizontal directions (radial to the bowl axis and tangential), fading in over the first 20 percent of the hang.
VINES = [
    (352.0, 0.250, 0.05, 90.0, 6, 0.012, 0.009, 0.0, 1.6, 1.8),
    (50.0, 0.180, 0.06, 200.0, 5, 0.010, 0.012, 2.1, 0.4, 1.5),
    (108.0, 0.290, 0.05, 330.0, 7, 0.014, 0.008, 4.0, 3.0, 2.1),
    (205.0, 0.150, 0.07, 120.0, 4, 0.009, 0.010, 1.0, 5.0, 1.5),
    (312.0, 0.215, 0.06, 20.0, 6, 0.012, 0.011, 5.2, 2.4, 1.9),
]
VINE_PTS_PER_WAVE = 8  # path segments per wave: fewer looks like a zigzag, more costs 6 triangles each
VINE_Y_SOFT, VINE_Y_SOFT_W = -0.352, 0.012  # vine centre lines bend away from the window instead of crossing this y (soft limit, tanh)
VINE_FADE_IN = 0.20  # fraction of the hang over which the wave grows from zero (the vine leaves the rim straight)
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

# ---- Slice D1: back wall details (SPEC.md section 7, phase 2b layout table; metres) -----------------
WALL_FACE = 0.225  # inner face of the back wall (y); new parts stick EMBED into it so no coplanar faces fight
EMBED = 0.001
# Shelf: plank x -0.295 to 0.005, top z 0.290, 0.020 thick, 0.070 deep; two L brackets (0.015 wide, 0.045 tall) under it.
SHELF_X = (-0.295, 0.005)
SHELF_TOP, SHELF_T, SHELF_DEPTH = 0.290, 0.020, 0.070
BRACKET_X = (-0.270, -0.035)  # bracket centres
BRACKET_W, BRACKET_H, BRACKET_REACH, BRACKET_T = 0.015, 0.045, 0.050, 0.006  # width, height, how far the lower leg reaches out, leg thickness
# Jars: centres, diameter 0.060, glass body 0.090, lid 0.010, contents 0.060 (jar i holds tea i).
JAR_X = (-0.2575, -0.1825, -0.1075, -0.0325)
JAR_Y = 0.190
JAR_BODY_H, JAR_LID_H, JAR_CONTENT_H = 0.090, 0.010, 0.060
JAR_R, JAR_NECK_R, JAR_SHOULDER = 0.030, 0.027, 0.008  # body radius, radius at the top, height of the tapered shoulder
JAR_LID_R, JAR_CONTENT_R, JAR_CONTENT_BASE = 0.0295, 0.0265, 0.003  # lid radius, contents radius, contents start above the jar base
# "glass": transparent Mat_Glass body with the tea colour showing inside; "tinted": opaque body in the tea colour (Mat_Bag).
# Decided by the D1 spike (DECISIONS.md): transparent glass sorts wrongly against the steam.
JAR_GLASS = "tinted"
# Rail: bar x -0.255 to -0.015 at z 0.215 (square section), end posts to the wall, hooks and hanging mugs.
RAIL_X, RAIL_Z, RAIL_Y, RAIL_SECTION = (-0.255, -0.015), 0.215, 0.198, 0.008  # bar centre line y and section
HOOK_X = (-0.225, -0.170, -0.115, -0.060)
HOOK_LEN, HOOK_INTO_CUP, HOOK_R = 0.016, 0.003, 0.0018  # below the bar, extra tip inside the cup, radius (4 sided)
MUG_TOP_Z, MUG_H, MUG_W = 0.195, 0.070, 0.054  # top of the hanging mugs, height, total width including the handle
MUG_SIDES = 12
MUG_PROFILE = [  # (radius, z above the mug base): underside, outer wall (taper), rim, inner wall, inner floor
    (0.0, 0.0),
    (0.017, 0.0),
    (0.0215, 0.070),
    (0.0185, 0.070),
    (0.0165, 0.007),
    (0.0, 0.007),
]
MUG_HANDLE_R = 0.0025  # handle tube radius (4 sided)
# Handle centre line in the mug's frame (x outwards from the axis on the +X side, z above the base).
MUG_HANDLE_PATH = ((0.019, 0.060), (0.0285, 0.056), (0.0300, 0.040), (0.0285, 0.022), (0.0185, 0.016))
# ---- Slice D2: picture frames with pictograms (SPEC.md section 7, phase 2b layout table "Frame A/B/C"; metres) ------------
# Frames sit flush on the back wall (WALL_FACE), FRAME_DEPTH deep, with a Mat_Wood border and a Mat_Frame panel. The panel is recessed
# PANEL_RECESS from the front of the border; the pictogram is extruded PICTO_RAISE out of the panel, so its front is flush with the
# border front and the whole frame stays inside the 15 mm of the layout table. The pictograms use Mat_Pot (terracotta, close to
# Mat_Mug) and Mat_Leaf: Mat_Mug is shared with the `Mug` object and applyRoomAo would put the Room AO map on it (see DECISIONS.md).
FRAME_DEPTH, FRAME_BORDER, PANEL_RECESS, PICTO_RAISE = 0.015, 0.008, 0.002, 0.002
PICTO_MARGIN_MIN = 0.005  # a pictogram keeps at least this much panel around it
FRAMES = {  # name: (x range, z range, pictogram, material)
    "A": ((0.32, 0.48), (0.25, 0.36), "cup", "Mat_Pot"),
    "B": ((0.50, 0.59), (0.22, 0.34), "leaf", "Mat_Leaf"),
    "C": ((0.33, 0.41), (0.13, 0.21), "heart", "Mat_Pot"),
}
CUP_SCALE = 1.5
# Cup silhouette in a local (u right, v up) frame in metres at scale 1: body with a vertical right wall (the handle abuts it), rounded
# bottom, a thin saucer below it and a half ring handle on the right (separate pieces that share edges, never overlap).
CUP_BODY = [(0.025, 0.024), (-0.025, 0.024), (-0.025, -0.004), (-0.0215, -0.009), (-0.013, -0.012), (0.013, -0.012), (0.0215, -0.009), (0.025, -0.004)]
CUP_SAUCER = [(-0.036, -0.012), (-0.030, -0.019), (0.030, -0.019), (0.036, -0.012)]
CUP_HANDLE = dict(centre=(0.025, 0.0105), r_out=0.0125, r_in=0.0070, steps=6)
LEAF_LEN, LEAF_WIDTH, LEAF_GAP, LEAF_STEM, LEAF_STEM_W, LEAF_TILT_DEG = 0.066, 0.038, 0.0014, 0.012, 0.0030, 25.0
LEAF_STATIONS = (0.14, 0.30, 0.46, 0.62, 0.78, 0.91)  # blade outline stations along the length (fractions)
HEART_WIDTH, HEART_POINTS = 0.048, 16
# ---- Slice D3: tea box body (layout in tools/blender/tea_layout.py; SPEC.md section 7 layout table "Tea box") ----------------
SAUCER_R = 0.055  # planned saucer radius around the mug (slice D4)
TEA_BOX_GAP_MIN = 0.020  # box to mug, planned saucer, kettle and tin: at least 20 mm
BOX_TOL = 0.005  # a new part's bounding box must match the layout table within 5 mm
CLEARANCE_MIN = 0.015  # plan-view distance of every new part to a steam column

# Material slot order of the merged Room mesh. The first seven never change; slice D1 appends after them.
ROOM_MATERIALS_BASE = ["Mat_Wall", "Mat_Wood", "Mat_Frame", "Mat_Leaf", "Mat_Pot", "Mat_Tin", "Mat_Book"]
# Materials created by this script when they are missing (Blender-side defaults, look.ts overrides them at runtime, D-009).
# Mat_Bag0..3 equal TEAS[i].liquidColor in src/lib/teas.ts (look.test.ts compares them).
NEW_MATERIAL_COLORS = {
    "Mat_Iron": "#3A3A3A",
    "Mat_Bag0": "#8A4B2A",
    "Mat_Bag1": "#B5B84A",
    "Mat_Bag2": "#E0B84A",
    "Mat_Bag3": "#B3213F",
}
for _arg in sys.argv:
    if _arg.startswith("--jar-glass="):
        JAR_GLASS = _arg.split("=", 1)[1]
assert JAR_GLASS in ("glass", "tinted"), f"JAR_GLASS must be glass or tinted, not {JAR_GLASS}"
ROOM_MATERIALS = ROOM_MATERIALS_BASE + list(NEW_MATERIAL_COLORS) + (["Mat_Glass"] if JAR_GLASS == "glass" else [])
IDX = {name: i for i, name in enumerate(ROOM_MATERIALS)}

# Markers that depend on the window (positions only, never renamed).
RAYS_TARGET = (-0.10, 0.0, 0.0)  # on the worktop top, where the sun lands
DUST_MIN, DUST_MAX = (-0.28, -0.20, -0.05), (0.30, 0.15, 0.30)  # box inside the lit area
ORBIT_TARGET = (0.14, -0.12, 0.0)

# --------------------------------------------------------------------------- helpers -----------


class Shading:
    """Faces to shade smooth and edges that stay sharp (slice G2). Everything else in `Room` is flat. The organic bodies (a leaf,
    a coin, a tube) share no vertices with anything else, so smoothing one only changes its own corner normals."""

    smooth = []  # faces of organic parts
    sharp = set()  # edges kept sharp (the ring where a tube end cap meets the tube)
    pots = []  # pot and bowl faces: smooth only when SMOOTH_POTS


def apply_shading(bm):
    for f in Shading.smooth:
        f.smooth = True
    for e in Shading.sharp:
        e.smooth = False  # BMEdge.smooth False = marked sharp
    if SMOOTH_POTS:
        limit = math.radians(POT_SHARP_DEG)
        pot_set = set(Shading.pots)
        for f in Shading.pots:
            f.smooth = True
        for f in Shading.pots:
            for e in f.edges:
                if len(e.link_faces) != 2 or e.calc_face_angle(0.0) > limit or any(g not in pot_set for g in e.link_faces):
                    e.smooth = False


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
    made = []
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
            f = bm.faces.new(face)
            f.material_index = mat
            made.append(f)
    return made


def tube(bm, points, radii, sides, mat, phase=0.0, caps=True, smooth=False, ref_axis=None):
    """Prism with `sides` faces along a polyline, radius per point (so it can taper). Closed (end caps) unless
    `caps` is false. `ref_axis` fixes the reference direction of the ring frames (default: Z, or X where the path is vertical); a path that
    switches between those two (a handle that bends through the vertical) needs a fixed axis that is never parallel to the path. With `smooth` the body is shaded smooth (soft round section) and the end caps stay sharp. Normals are fixed
    afterwards by the main `recalc_face_normals`."""
    pts = [Vector(p) for p in points]
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = Vector(ref_axis) if ref_axis is not None else (Vector((0, 0, 1)) if abs(t.z) < 0.95 else Vector((1, 0, 0)))
        u = ref.cross(t).normalized()
        v = t.cross(u)
        ring = [
            bm.verts.new(p + radii[i] * (math.cos(phase + 2 * math.pi * k / sides) * u + math.sin(phase + 2 * math.pi * k / sides) * v))
            for k in range(sides)
        ]
        rings.append(ring)
    body, cap_faces = [], []
    for a, b in zip(rings, rings[1:]):
        for k in range(sides):
            k2 = (k + 1) % sides
            f = bm.faces.new((a[k], a[k2], b[k2], b[k]))
            f.material_index = mat
            body.append(f)
    if caps:
        for ring in (rings[0], rings[-1][::-1]):
            f = bm.faces.new(ring)
            f.material_index = mat
            cap_faces.append(f)
    if smooth:
        Shading.smooth.extend(body + cap_faces)
        for f in cap_faces:
            Shading.sharp.update(f.edges)


def surface(bm, frame, coords, tris, mat, open_faces):
    """Single open surface (a leaf or a coin): `coords` in the local frame, `tris` index triples, counter-clockwise seen
    from the local +Z (that is the side the AO bake treats as the front). Faces go into `open_faces` so the closed-solid
    normal fix skips them, and into the smooth list (leaves are shaded smooth, a fold becomes a soft crease)."""
    verts = [bm.verts.new(frame @ Vector(c)) for c in coords]
    for a, b, c in tris:
        f = bm.faces.new((verts[a], verts[b], verts[c]))
        f.material_index = mat
        open_faces.append(f)
        Shading.smooth.append(f)
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


def coin(bm, centre, radius, tilt_deg, spin_deg, mat, open_faces, rng, path_rot=None, sides=COIN_SIDES, dome=0.0015):
    """Round leaf: a fan of `sides` triangles around a slightly raised middle. Irregular on purpose (slice G2): every outline vertex
    gets a seeded radius jitter of COIN_JITTER, the outline is slightly oval (COIN_ASPECT) and starts at a random angle, so no two
    leaves look the same. It is tilted by `tilt_deg` about an axis in the plane at `spin_deg` around Z; `path_rot` (a 4x4 rotation)
    turns the whole leaf with the tangent of the vine it hangs from."""
    aspect = rng.uniform(*COIN_ASPECT)
    phase = rng.uniform(0.0, 2 * math.pi / sides)
    coords = [(0.0, 0.0, dome)]
    for k in range(sides):
        a = phase + 2 * math.pi * k / sides
        r = radius * (1.0 + rng.uniform(-COIN_JITTER, COIN_JITTER))
        coords.append((r * aspect * math.cos(a), r * math.sin(a), 0.0))
    tris = [(0, 1 + k, 1 + (k + 1) % sides) for k in range(sides)]
    frame = Matrix.Translation(centre)
    if path_rot is not None:
        frame = frame @ path_rot
    frame = frame @ Matrix.Rotation(math.radians(spin_deg), 4, "Z") @ Matrix.Rotation(math.radians(tilt_deg), 4, "Y")
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


def floor_layout():
    """Board layout shared by `build_floor` and the plant placement: (x_start of the first board, pitch, board count, y0, y1)."""
    cx, cy = COUNTER_X / 2, COUNTER_Y / 2
    fx_max, fy_min = cx + FLOOR_RIGHT, -cy - FLOOR_FRONT
    x_start, x_end = -cx, fx_max  # inside the left wall face
    pitch = BOARD_W + BOARD_GAP
    n = int((x_end - x_start) // pitch)
    margin = (x_end - x_start - n * pitch + BOARD_GAP) / 2  # centre the boards, equal strip at both ends
    return x_start + margin, pitch, n, fy_min, cy


def board_joint_y(i):
    x0, pitch, n, y0, y1 = floor_layout()
    return y0 + (y1 - y0) * BOARD_JOINT[i % len(BOARD_JOINT)]


def board_top_height(x, y):
    """Height of the floor board top above the slab at (x, y), or 0 over a groove (the slab itself)."""
    x0, pitch, n, y0, y1 = floor_layout()
    i = int((x - x0) // pitch)
    if not (0 <= i < n) or x - (x0 + i * pitch) > BOARD_W:
        return 0.0
    j = board_joint_y(i)
    h = BOARD_H[i % 2]
    if y < j - END_GAP / 2:
        return h
    if y > j + END_GAP / 2:
        return h - END_STEP
    return 0.0


def build_floor(bm):
    cx, cy = COUNTER_X / 2, COUNTER_Y / 2
    floor_top = -FLOOR_Z
    fx_max, fy_min = cx + FLOOR_RIGHT, -cy - FLOOR_FRONT
    wd = IDX["Mat_Wood"]
    # Plinth and floor slab.
    box(bm, (-cx - WALL_T - PLINTH_OVERHANG, fy_min - PLINTH_OVERHANG, floor_top - FLOOR_T - PLINTH_T), (fx_max + PLINTH_OVERHANG, cy + WALL_T + PLINTH_OVERHANG, floor_top - FLOOR_T), wd)
    box(bm, (-cx - WALL_T, fy_min, floor_top - FLOOR_T), (fx_max, cy + WALL_T, floor_top), wd)
    # Boards: a loop over columns; each column is cut in two pieces at its own joint position.
    x0, pitch, n, y0, y1 = floor_layout()
    for i in range(n):
        bx0 = x0 + i * pitch
        h = BOARD_H[i % 2]
        j = board_joint_y(i)
        box(bm, (bx0, y0 + 0.004, floor_top), (bx0 + BOARD_W, j - END_GAP / 2, floor_top + h), wd)  # near piece (camera side)
        box(bm, (bx0, j + END_GAP / 2, floor_top), (bx0 + BOARD_W, y1 - 0.004, floor_top + h - END_STEP), wd)  # far piece, lower


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
    # The pot stands on the highest board under its footprint (the far pieces are lower than the near ones, see END_STEP).
    r0 = POT_PROFILE[1][0]
    under = [(px, py)] + [(px + r0 * math.cos(2 * math.pi * k / 8), py + r0 * math.sin(2 * math.pi * k / 8)) for k in range(8)]
    floor_top = -FLOOR_Z + max(board_top_height(x, y) for x, y in under)
    Shading.pots.extend(lathe(bm, POT_PROFILE, (px, py, floor_top), IDX["Mat_Pot"], POT_SIDES, POT_PHASE))
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
        tube(bm, pts, radii, STEM_SIDES, IDX["Mat_Wood"], phase=math.pi / 4, smooth=True)
        tops.append(pts[-1])
    for stem, yaw, pitch, roll, length, petiole in PLANT_LEAVES:
        yawr, pr = math.radians(yaw), math.radians(max(pitch, 10.0) * 0.8)
        # A thin leaf stalk fans each leaf out from the stem top (so the leaves do not pile up on one point and the stem stays visible).
        stalk = Vector((math.cos(yawr) * math.cos(pr), math.sin(yawr) * math.cos(pr), math.sin(pr))) * petiole
        base = tops[stem] + stalk
        tube(bm, [tops[stem], base], [PETIOLE_R, PETIOLE_R * 0.8], 3, IDX["Mat_Wood"], caps=True, smooth=True)
        lobed_leaf(bm, base, yaw, pitch, roll, length, IDX["Mat_Leaf"], open_faces)
    check_bounds(bm, v0, "floor plant", PLANT_REACH_X, (-1.0, PLANT_MAX_Y))


def bowl_radius_at(h):
    """Outer radius of the hanging bowl at height `h` above its underside (the profile's outer wall), 0 below the bowl."""
    prof = BOWL_PROFILE[1:5]  # underside edge, wall, lip bottom, lip top
    if h < 0:
        return 0.0
    for (r0, z0), (r1, z1) in zip(prof, prof[1:]):
        if z0 <= h <= z1:
            return r0 if z1 == z0 else r0 + (r1 - r0) * (h - z0) / (z1 - z0)
    return prof[-1][0]


def vine_path(start, over, d, length, sway, sway_deg, amp_r, amp_t, ph_r, ph_t, waves):
    """Vine centre line: in over the rim, then a serpentine hang. The hang is a straight fall of `length` plus a slow sideways sway, with
    two sine offsets (radial and tangential to the bowl axis, different phase and amplitude) that fade in over VINE_FADE_IN."""
    n = max(6, round(waves * VINE_PTS_PER_WAVE))
    radial = Vector((math.cos(d), math.sin(d), 0.0))
    tangent = Vector((-math.sin(d), math.cos(d), 0.0))
    sd = math.radians(sway_deg)
    drift = Vector((math.cos(sd), math.sin(sd), 0.0)) * (sway * length)
    pts = [start, over]
    for i in range(1, n + 1):
        t = i / n
        fade = min(1.0, t / VINE_FADE_IN)
        fade = fade * fade * (3.0 - 2.0 * fade)  # smoothstep
        wave = fade * (amp_r * math.sin(2 * math.pi * waves * t + ph_r) * radial + amp_t * math.sin(2 * math.pi * waves * t + ph_t) * tangent)
        p = over + drift * t + wave + Vector((0.0, 0.0, -length * t))
        if p.y > VINE_Y_SOFT:  # compress the part of the wave that would swing towards the window (the vine keeps its shape, only flatter)
            squashed = VINE_Y_SOFT + VINE_Y_SOFT_W * math.tanh((p.y - VINE_Y_SOFT) / VINE_Y_SOFT_W)
            p.y += (squashed - p.y) * fade
        pts.append(p)
    return pts


def build_wall_plant(bm, open_faces):
    """Hanging planter: wall plate and arm, three ropes, octagonal bowl, a mound of irregular round leaves and serpentine vines."""
    v0 = len(bm.verts)
    rng = random.Random(RNG_SEED)
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
    Shading.pots.extend(lathe(bm, BOWL_PROFILE, (hx, hy, bowl_z), pot, BOWL_SIDES, math.pi / 8))
    rim_r = BOWL_PROFILE[3][0]
    ring = Vector((hx, hy, ring_z - 0.006))
    for deg in ROPE_ANGLES:
        r = math.radians(deg)
        rim_pt = Vector((hx + rim_r * math.cos(r), hy + rim_r * math.sin(r), rim_z - 0.004))
        tube(bm, [ring, rim_pt], [ROPE_R] * 2, 4, wd, phase=math.pi / 4, smooth=True)

    # Mound of leaves on the soil.
    soil_z = bowl_z + BOWL_PROFILE[-1][1]
    for rad, deg, h, tilt, cr, spin in MOUND_COINS:
        d = math.radians(deg)
        c = Vector((hx + rad * math.cos(d), hy + rad * math.sin(d), soil_z + h))
        coin(bm, c, cr, tilt, spin + deg, leaf, open_faces, rng)  # spin follows the angle so tilts lean outwards

    # Serpentine vines over the rim with leaves along them. Collect the path points to check the clearances below.
    vine_points = []
    for deg, length, sway, sway_deg, n_coins, amp_r, amp_t, ph_r, ph_t, waves in VINES:
        d = math.radians(deg)
        start = Vector((hx + (rim_r - 0.006) * math.cos(d), hy + (rim_r - 0.006) * math.sin(d), rim_z - 0.002))
        over = Vector((hx + (rim_r + 0.008) * math.cos(d), hy + (rim_r + 0.008) * math.sin(d), rim_z - 0.012))
        pts = vine_path(start, over, d, length, sway, sway_deg, amp_r, amp_t, ph_r, ph_t, waves)
        vine_points.extend(pts[2:])  # start and over-the-rim points are meant to touch the bowl
        radii = [VINE_R * (1.0 - 0.45 * i / (len(pts) - 1)) for i in range(len(pts))]
        tube(bm, pts, radii, VINE_SIDES, leaf, phase=0.5, caps=True, smooth=True)
        # Leaves along the hanging part: position by arc parameter on the path, alternating sides, shrinking towards the tip. The leaf frame
        # is turned with the local tangent, so the leaves follow the waves.
        hang = pts[1:]
        down = Vector((0.0, 0.0, -1.0))
        for j in range(n_coins):
            t = (j + 0.6) / (n_coins + 0.2)
            seg = min(int(t * (len(hang) - 1)), len(hang) - 2)
            f = t * (len(hang) - 1) - seg
            c = hang[seg].lerp(hang[seg + 1], f)
            tan = (hang[seg + 1] - hang[seg]).normalized()
            rot = Quaternion().slerp(down.rotation_difference(tan), LEAF_FOLLOW).to_matrix().to_4x4()  # partly follow the tangent
            side = 1.0 if j % 2 == 0 else -1.0
            cr = VINE_COIN_R[0] + (VINE_COIN_R[1] - VINE_COIN_R[0]) * t
            off = rot @ Vector((-math.sin(d), math.cos(d), 0.0)) * (side * cr * 0.55)  # beside the vine, so it hangs from a short stalk
            coin(bm, c + off, cr, 24.0 + 8.0 * (j % 3), 40.0 * j + deg, leaf, open_faces, rng, path_rot=rot)

    # Clearances (fail loudly): vines stay out of the bowl, 12 mm off the wall, and behind the worktop-side limit.
    for p in vine_points:
        h = p.z - bowl_z
        r = math.hypot(p.x - hx, p.y - hy)
        if 0 < h < BOWL_PROFILE[4][1] + 0.002 and r < bowl_radius_at(h) + 0.004:
            raise SystemExit(f"04_room: a vine point at {tuple(round(c, 3) for c in p)} touches the bowl (r {r:.3f}, wall {bowl_radius_at(h):.3f})")
        if p.x < wall_x + 0.012:
            raise SystemExit(f"04_room: a vine point at {tuple(round(c, 3) for c in p)} is closer than 12 mm to the wall")
    print(f"[04_room] vines: {len(VINES)} paths, {len(vine_points)} points, lowest z {min(p.z for p in vine_points):.3f}, "
          f"x {min(p.x for p in vine_points):.3f}..{max(p.x for p in vine_points):.3f}, y {min(p.y for p in vine_points):.3f}..{max(p.y for p in vine_points):.3f}")
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



# ------------------------------------------------------------------ slice D1 parts ----------------


class Parts:
    """Vertex ranges of the new D1 parts (name -> (first index, one past last)), for the bounding box and clearance checks."""

    ranges = {}
    pictos = {}  # frame name -> vertex range of its pictogram pieces (inside the frame's own range)
    others = {}  # older parts (name -> vertex range) the frames must not touch


def tracked(bm, name, fn):
    """Runs the builder `fn` and records the vertices it created under `name`."""
    v0 = len(bm.verts)
    fn()
    Parts.ranges[name] = (v0, len(bm.verts))


def build_shelf(bm):
    wd, iron = IDX["Mat_Wood"], IDX["Mat_Iron"]
    y0 = WALL_FACE - SHELF_DEPTH
    tracked(bm, "shelf_plank", lambda: box(bm, (SHELF_X[0], y0, SHELF_TOP - SHELF_T), (SHELF_X[1], WALL_FACE + EMBED, SHELF_TOP), wd))
    bottom = SHELF_TOP - SHELF_T
    for i, bx in enumerate(BRACKET_X):
        x0, x1 = bx - BRACKET_W / 2, bx + BRACKET_W / 2

        def bracket(x0=x0, x1=x1):
            box(bm, (x0, WALL_FACE - BRACKET_T, bottom - BRACKET_H + BRACKET_T), (x1, WALL_FACE + EMBED, bottom), iron)  # leg on the wall
            box(bm, (x0, WALL_FACE - BRACKET_REACH, bottom - BRACKET_T), (x1, WALL_FACE - BRACKET_T, bottom), iron)  # leg under the plank
            box(bm, (x0, WALL_FACE - BRACKET_T, bottom - BRACKET_H), (x1, WALL_FACE + EMBED, bottom - BRACKET_H + BRACKET_T), iron)  # foot of the wall leg

        tracked(bm, f"bracket_{i}", bracket)


def build_jars(bm):
    wd = IDX["Mat_Wood"]
    for i, jx in enumerate(JAR_X):
        base = (jx, JAR_Y, SHELF_TOP)
        bag = IDX[f"Mat_Bag{i}"]
        body_profile = [(0.0, 0.0), (JAR_R, 0.0), (JAR_R, JAR_BODY_H - JAR_SHOULDER), (JAR_NECK_R, JAR_BODY_H), (0.0, JAR_BODY_H)]
        if JAR_GLASS == "glass":
            tracked(bm, f"jar_{i}_content", lambda: lathe(bm, [(0.0, JAR_CONTENT_BASE), (JAR_CONTENT_R, JAR_CONTENT_BASE), (JAR_CONTENT_R, JAR_CONTENT_BASE + JAR_CONTENT_H), (0.0, JAR_CONTENT_BASE + JAR_CONTENT_H)], base, bag))
            tracked(bm, f"jar_{i}_body", lambda: lathe(bm, body_profile, base, IDX["Mat_Glass"]))
        else:
            tracked(bm, f"jar_{i}_body", lambda: lathe(bm, body_profile, base, bag))
        lid = [(0.0, JAR_BODY_H), (JAR_LID_R, JAR_BODY_H), (JAR_LID_R, JAR_BODY_H + JAR_LID_H * 0.8), (JAR_NECK_R, JAR_BODY_H + JAR_LID_H), (0.0, JAR_BODY_H + JAR_LID_H)]
        tracked(bm, f"jar_{i}_lid", lambda: lathe(bm, lid, base, wd))


def build_rail(bm):
    iron, frame = IDX["Mat_Iron"], IDX["Mat_Frame"]
    h = RAIL_SECTION / 2
    x0, x1 = RAIL_X

    def bar():
        box(bm, (x0, RAIL_Y - h, RAIL_Z - h), (x1, RAIL_Y + h, RAIL_Z + h), iron)
        for px0, px1 in ((x0, x0 + RAIL_SECTION), (x1 - RAIL_SECTION, x1)):  # two standoff posts to the wall
            box(bm, (px0, RAIL_Y + h, RAIL_Z - h), (px1, WALL_FACE + EMBED, RAIL_Z + h), iron)

    tracked(bm, "rail_bar", bar)
    bar_bottom = RAIL_Z - h
    base_z = MUG_TOP_Z - MUG_H
    for i, hx in enumerate(HOOK_X):
        # Hook: a thin rod below the bar that ends just inside the cup opening (the cup hangs from it).
        tracked(bm, f"rail_hook_{i}", lambda hx=hx: tube(bm, [(hx, RAIL_Y, RAIL_Z), (hx, RAIL_Y, bar_bottom - HOOK_LEN - HOOK_INTO_CUP)], [HOOK_R, HOOK_R], 4, iron, phase=math.pi / 4))

        def mug(hx=hx):
            # The handle sticks out on +X; the bounding box (not the body) is centred on the hook x, MUG_W wide.
            outer = max(r for r, _z in MUG_PROFILE)
            reach = max(p[0] for p in MUG_HANDLE_PATH) + MUG_HANDLE_R
            cx = hx + MUG_W / 2 - reach  # body axis
            assert abs((cx - outer) - (hx - MUG_W / 2)) < BOX_TOL, "mug body does not fit the layout width"
            lathe(bm, MUG_PROFILE, (cx, RAIL_Y, base_z), frame, MUG_SIDES)
            tube(bm, [(cx + px, RAIL_Y, base_z + pz) for px, pz in MUG_HANDLE_PATH], [MUG_HANDLE_R] * len(MUG_HANDLE_PATH), 4, frame, phase=math.pi / 4, ref_axis=(0, 1, 0))

        tracked(bm, f"rail_mug_{i}", mug)


def picto_piece(bm, pts, centre, y_panel, mat, open_faces):
    """Extrudes the flat polygon `pts` ((u, v) = (x, z) offsets from `centre`) PICTO_RAISE out of the panel plane `y_panel` towards -Y.
    Front face plus side walls, no back face (buried in the panel). The winding is explicit (counter-clockwise in (u, v) is a normal on
    -Y), so the faces go into `open_faces` and skip the closed-solid normal fix."""
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))
    if area < 0:
        pts = pts[::-1]
    cx, cz = centre
    front = [bm.verts.new((cx + u, y_panel - PICTO_RAISE, cz + v)) for u, v in pts]
    back = [bm.verts.new((cx + u, y_panel, cz + v)) for u, v in pts]
    faces = [bm.faces.new(front)]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((front[i], back[i], back[j], front[j])))
    for f in faces:
        f.material_index = mat
        open_faces.append(f)


def cup_pieces():
    """Cup silhouette pieces (lists of (u, v) points), centred on the middle of their bounding box."""
    k = CUP_SCALE
    h = CUP_HANDLE
    hx, hv = h["centre"]
    outer = [(hx + h["r_out"] * math.cos(a), hv + h["r_out"] * math.sin(a)) for a in (math.radians(-90 + 180 * i / h["steps"]) for i in range(h["steps"] + 1))]
    inner = [(hx + h["r_in"] * math.cos(a), hv + h["r_in"] * math.sin(a)) for a in (math.radians(90 - 180 * i / h["steps"]) for i in range(h["steps"] + 1))]
    pieces = [CUP_BODY, CUP_SAUCER, outer + inner]
    pts = [p for piece in pieces for p in piece]
    ox = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    oz = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    return [[((u - ox) * k, (v - oz) * k) for u, v in piece] for piece in pieces]


def leaf_pieces():
    """Leaf pieces: two blade halves with a gap between them (the vein shows the panel colour) and a stem, tilted by LEAF_TILT_DEG."""
    half_w = LEAF_WIDTH / 2
    g = LEAF_GAP / 2
    right = [(g, 0.0)] + [(g + half_w * math.sin(math.pi * t) ** 0.75 * (1 - 0.3 * t), t * LEAF_LEN) for t in LEAF_STATIONS] + [(g, LEAF_LEN)]
    left = [(-u, v) for u, v in right]
    stem = [(-LEAF_STEM_W / 2, -LEAF_STEM), (LEAF_STEM_W / 2, -LEAF_STEM), (LEAF_STEM_W / 2, 0.0), (-LEAF_STEM_W / 2, 0.0)]
    a = math.radians(-LEAF_TILT_DEG)  # tilt the tip to the right
    ca, sa = math.cos(a), math.sin(a)
    pieces = [[(u * ca - v * sa, u * sa + v * ca) for u, v in piece] for piece in (right, left, stem)]
    pts = [p for piece in pieces for p in piece]
    ox = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2
    oz = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    return [[(u - ox, v - oz) for u, v in piece] for piece in pieces]


def heart_pieces():
    """Heart outline from the classic parametric curve, sampled at HEART_POINTS points (two lobes and a point)."""
    pts = []
    for i in range(HEART_POINTS):
        t = 2 * math.pi * i / HEART_POINTS
        pts.append((16 * math.sin(t) ** 3, 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)))
    k = HEART_WIDTH / 32
    oz = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2
    return [[(u * k, (v - oz) * k) for u, v in pts]]


PICTOS = {"cup": cup_pieces, "leaf": leaf_pieces, "heart": heart_pieces}


def build_frames(bm, open_faces):
    wd, panel = IDX["Mat_Wood"], IDX["Mat_Frame"]
    y0 = WALL_FACE - FRAME_DEPTH
    b = FRAME_BORDER
    for name, ((x0, x1), (z0, z1), picto, mat_name) in FRAMES.items():
        def frame(x0=x0, x1=x1, z0=z0, z1=z1, picto=picto, mat_name=mat_name, name=name):
            yw = WALL_FACE + EMBED
            box(bm, (x0, y0, z0), (x1, yw, z0 + b), wd)  # bottom bar
            box(bm, (x0, y0, z1 - b), (x1, yw, z1), wd)  # top bar
            box(bm, (x0, y0, z0 + b), (x0 + b, yw, z1 - b), wd)  # left bar
            box(bm, (x1 - b, y0, z0 + b), (x1, yw, z1 - b), wd)  # right bar
            y_panel = y0 + PANEL_RECESS
            box(bm, (x0 + b, y_panel, z0 + b), (x1 - b, yw, z1 - b), panel)
            v0 = len(bm.verts)
            centre = ((x0 + x1) / 2, (z0 + z1) / 2)
            for piece in PICTOS[picto]():
                picto_piece(bm, piece, centre, y_panel, IDX[mat_name], open_faces)
            Parts.pictos[f"frame_{name}"] = (v0, len(bm.verts))

        tracked(bm, f"frame_{name}", frame)


def tea_box_slots():
    """x ranges of the four slots, from the bag centres of tea_layout.py."""
    return [(bx - tea.SLOT_W / 2, bx + tea.SLOT_W / 2) for bx in tea.BAG_X]


def build_tea_box(bm):
    """Open top box in Mat_Wood: a solid base up to BOX_FLOOR (the slot floor), then front and back wall, two end walls and three dividers
    up to the rim. Every wall adjoins its neighbours without overlapping, so no coplanar faces fight."""
    wd = IDX["Mat_Wood"]
    cx, cy = tea.BOX_CENTER
    sx, sy, sz = tea.BOX_SIZE
    x0, x1, y0, y1 = cx - sx / 2, cx + sx / 2, cy - sy / 2, cy + sy / 2
    f, w = tea.BOX_FLOOR, tea.BOX_WALL
    slots = tea_box_slots()
    assert slots[0][0] > x0 and slots[-1][1] < x1, "tea box slots do not fit the box"
    assert all(slots[i + 1][0] > slots[i][1] for i in range(3)), "tea box slots overlap"
    # walls between the slots: left end wall, three dividers, right end wall
    spans = [(x0, slots[0][0])] + [(slots[i][1], slots[i + 1][0]) for i in range(3)] + [(slots[-1][1], x1)]

    def body():
        box(bm, (x0, y0, 0.0), (x1, y1, f), wd)  # base
        box(bm, (x0, y0, f), (x1, y0 + w, sz), wd)  # front wall (towards the camera, -Y)
        box(bm, (x0, y1 - w, f), (x1, y1, sz), wd)  # back wall
        for a, b in spans:
            box(bm, (a, y0 + w, f), (b, y1 - w, sz), wd)

    tracked(bm, "tea_box", body)


def expected_boxes():
    """Layout table (SPEC.md section 7, phase 2b) as lower/upper corners per part name."""
    out = {}
    out["shelf_plank"] = ((SHELF_X[0], WALL_FACE - SHELF_DEPTH, SHELF_TOP - SHELF_T), (SHELF_X[1], WALL_FACE, SHELF_TOP))
    for i, bx in enumerate(BRACKET_X):
        out[f"bracket_{i}"] = ((bx - BRACKET_W / 2, WALL_FACE - BRACKET_REACH, SHELF_TOP - SHELF_T - BRACKET_H), (bx + BRACKET_W / 2, WALL_FACE, SHELF_TOP - SHELF_T))
    for i, jx in enumerate(JAR_X):
        out[f"jar_{i}_body"] = ((jx - JAR_R, JAR_Y - JAR_R, SHELF_TOP), (jx + JAR_R, JAR_Y + JAR_R, SHELF_TOP + JAR_BODY_H))
        out[f"jar_{i}_lid"] = ((jx - JAR_R, JAR_Y - JAR_R, SHELF_TOP + JAR_BODY_H), (jx + JAR_R, JAR_Y + JAR_R, SHELF_TOP + JAR_BODY_H + JAR_LID_H))
        if JAR_GLASS == "glass":
            out[f"jar_{i}_content"] = ((jx - JAR_CONTENT_R, JAR_Y - JAR_CONTENT_R, SHELF_TOP + JAR_CONTENT_BASE), (jx + JAR_CONTENT_R, JAR_Y + JAR_CONTENT_R, SHELF_TOP + JAR_CONTENT_BASE + JAR_CONTENT_H))
    h = RAIL_SECTION / 2
    out["rail_bar"] = ((RAIL_X[0], RAIL_Y - h, RAIL_Z - h), (RAIL_X[1], WALL_FACE, RAIL_Z + h))
    for i, hx in enumerate(HOOK_X):
        out[f"rail_hook_{i}"] = ((hx - HOOK_R, RAIL_Y - HOOK_R, RAIL_Z - h - HOOK_LEN), (hx + HOOK_R, RAIL_Y + HOOK_R, RAIL_Z))
        out[f"rail_mug_{i}"] = ((hx - MUG_W / 2, RAIL_Y - 0.0215, MUG_TOP_Z - MUG_H), (hx + MUG_W / 2, RAIL_Y + 0.0215, MUG_TOP_Z))
    for name, ((x0, x1), (z0, z1), _p, _m) in FRAMES.items():
        out[f"frame_{name}"] = ((x0, WALL_FACE - FRAME_DEPTH, z0), (x1, WALL_FACE, z1))
    bx, by = tea.BOX_CENTER
    out["tea_box"] = ((bx - tea.BOX_SIZE[0] / 2, by - tea.BOX_SIZE[1] / 2, 0.0), (bx + tea.BOX_SIZE[0] / 2, by + tea.BOX_SIZE[1] / 2, tea.BOX_SIZE[2]))
    return out


def check_new_parts(bm):
    """Prints the bounding box of every new part and fails when one leaves its layout box by more than BOX_TOL (5 mm)."""
    bm.verts.ensure_lookup_table()
    expected = expected_boxes()
    missing = set(expected) ^ set(Parts.ranges)
    if missing:
        raise SystemExit(f"04_room: layout parts and built parts differ: {sorted(missing)}")
    bad = []
    print("[04_room] D1 to D3 parts: bounding boxes in metres (lower corner .. upper corner), size in mm, worst deviation from the layout table in mm")
    for name, (a, b) in Parts.ranges.items():
        pts = [bm.verts[k].co for k in range(a, b)]
        lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        elo, ehi = Vector(expected[name][0]), Vector(expected[name][1])
        dev = max(max(abs(lo[k] - elo[k]), abs(hi[k] - ehi[k])) for k in range(3))
        size = (hi - lo) * 1000
        print(f"  {name:15s} ({lo.x:+.4f} {lo.y:+.4f} {lo.z:+.4f}) .. ({hi.x:+.4f} {hi.y:+.4f} {hi.z:+.4f})  size {size.x:5.1f} x {size.y:5.1f} x {size.z:5.1f}  dev {dev * 1000:4.1f}")
        if dev > BOX_TOL:
            bad.append(name)
    if bad:
        raise SystemExit(f"04_room: parts outside the layout table by more than {BOX_TOL * 1000:.0f} mm: {bad}")


def check_tea_box(bm):
    """Slice D3 checks: the box against the layout table, the gap to mug, planned saucer, kettle and tin (at least TEA_BOX_GAP_MIN), the
    slot play around a bag and, when the TeaBag objects already exist in the file, that every bag fits its slot and sticks out of the rim."""
    bm.verts.ensure_lookup_table()
    a, b = Parts.ranges["tea_box"]
    pts = [bm.verts[k].co for k in range(a, b)]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    centre = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2)
    print(f"[04_room] D3 tea box: centre ({centre[0]:.4f}, {centre[1]:.4f}) vs layout ({tea.BOX_CENTER[0]}, {tea.BOX_CENTER[1]}), size "
          f"{(hi.x - lo.x) * 1000:.1f} x {(hi.y - lo.y) * 1000:.1f} x {(hi.z - lo.z) * 1000:.1f} mm, {len(tea_box_slots())} slots, rim z {hi.z:.3f}")
    assert max(abs(centre[0] - tea.BOX_CENTER[0]), abs(centre[1] - tea.BOX_CENTER[1])) < BOX_TOL, "tea box centre is off the layout table"

    def world_box(ob):
        corners = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        for child in ob.children_recursive:
            corners += [child.matrix_world @ Vector(c) for c in child.bound_box]
        return (Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners))),
                Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners))))

    def sep_to(olo, ohi):  # gap between two boxes in plan view (x, y); negative = overlap
        return max(max(olo[k] - hi[k], lo[k] - ohi[k]) for k in (0, 1))

    print("[04_room] D3 tea box clearance in mm (plan view, box to part; minimum {:.0f}):".format(TEA_BOX_GAP_MIN * 1000))
    gaps = {}
    for name in ("Mug", "Kettle"):
        gaps[name + " (bounding box, handle and spout included)"] = sep_to(*world_box(bpy.data.objects[name]))
    mug = bpy.data.objects["Mug"].location
    nearest = (min(max(mug.x, lo.x), hi.x), min(max(mug.y, lo.y), hi.y))  # point of the box footprint closest to the mug axis
    gaps[f"planned saucer (radius {SAUCER_R * 1000:.0f} mm around the mug axis)"] = math.hypot(nearest[0] - mug.x, nearest[1] - mug.y) - SAUCER_R
    tin_lo, tin_hi = Vector((TIN_XY[0] - 0.05, TIN_XY[1] - 0.05, 0.0)), Vector((TIN_XY[0] + 0.05, TIN_XY[1] + 0.05, 0.1))
    gaps["tin (loose 100 mm square around its axis)"] = sep_to(tin_lo, tin_hi)
    for label, g in gaps.items():
        print(f"  {label:60s} {g * 1000:7.1f}")
        assert g >= TEA_BOX_GAP_MIN, f"tea box is only {g * 1000:.1f} mm from {label}"

    slots = tea_box_slots()
    play_x = (tea.SLOT_W - tea.BAG_W) / 2
    play_y = (tea.BOX_SIZE[1] - 2 * tea.BOX_WALL - tea.BAG_D) / 2
    print(f"[04_room] D3 slot play around a bag: {play_x * 1000:.1f} mm each side in x, {play_y * 1000:.1f} mm front and back, "
          f"slot depth {(tea.BOX_SIZE[2] - tea.BOX_FLOOR) * 1000:.0f} mm, bag sticks out {(tea.BAG_BASE_Z + tea.BAG_H - tea.BOX_SIZE[2]) * 1000:.0f} mm above the rim at rest")
    assert play_x >= 0.0005 and play_y >= 0.0005, "a bag does not fit its slot"
    for i in range(4):
        ob = bpy.data.objects.get(f"TeaBag_{i}")
        if ob is None:
            print(f"  TeaBag_{i}: not in the file yet (run 08_tea_bags.py)")
            continue
        blo, bhi = world_box(ob)
        ok = slots[i][0] <= blo.x and bhi.x <= slots[i][1] and lo.y + tea.BOX_WALL <= blo.y and bhi.y <= hi.y - tea.BOX_WALL and abs(blo.z - tea.BOX_FLOOR) < 1e-4
        print(f"  TeaBag_{i}: x {blo.x:.4f}..{bhi.x:.4f} in slot {slots[i][0]:.4f}..{slots[i][1]:.4f}, y {blo.y:.4f}..{bhi.y:.4f}, z {blo.z:.4f}..{bhi.z:.4f}: {'fits' if ok else 'DOES NOT FIT'}")
        assert ok, f"TeaBag_{i} does not fit its slot"


def steam_columns():
    """The two steam columns as (name, axis x, axis y, base z, height, radius, width base, width power), with the steam numbers read
    from src/nook/steamDefaults.ts and checked against the width formula in src/lib/steamMath.ts, so they cannot drift silently.
    The axis comes from the marker Empties in the opened file (never hard-coded)."""
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    look = open(os.path.join(root, "src", "nook", "steamDefaults.ts")).read()
    maths = open(os.path.join(root, "src", "lib", "steamMath.ts")).read()
    assert "return base + (1 - base) * Math.pow(Math.min(1, Math.max(0, h)), power)" in maths, "steamWidth in steamMath.ts changed: update steam_width()"

    def block(name):
        m = re.search(r"export const " + name + r": SteamLook = \{\n(.*?)^\}", look, re.S | re.M)
        assert m, f"{name} not found in steamDefaults.ts"
        return m.group(1)

    def field(text, key):
        m = re.search(r"^\s*" + key + r": ([0-9.]+),", text, re.M)
        assert m, f"{key} not found"
        return float(m.group(1))

    tea, kettle = block("STEAM_LOOK_DEFAULTS"), block("KETTLE_STEAM_LOOK")
    assert re.search(r"^\s*height: KETTLE_HEIGHT_BASE \* KETTLE_STEAM_HEIGHT_FACTOR,", kettle, re.M), "kettle steam height formula changed"
    kettle_height = float(re.search(r"const KETTLE_HEIGHT_BASE = ([0-9.]+)", look).group(1)) * float(re.search(r"const KETTLE_STEAM_HEIGHT_FACTOR = ([0-9.]+)", look).group(1))
    cols = []
    for name, marker, text, height in (("tea", "Steam_Tea", tea, field(tea, "height")), ("kettle", "Steam_Kettle", kettle, kettle_height)):
        pos = bpy.data.objects[marker].matrix_world.translation
        cols.append((name, pos.x, pos.y, pos.z, height, field(text, "radius"), field(text, "widthBase"), field(text, "widthPower")))
    return cols


def steam_width(h, base, power):
    """Twin of `steamWidth` in src/lib/steamMath.ts (the formula is asserted in `steam_columns`)."""
    return base + (1 - base) * max(0.0, min(1.0, h)) ** power


def check_clearance(bm):
    """Plan-view distance of every new part to the steam columns, in millimetres: the part's points (faces sampled every ~2 mm) against
    the column's circle at that height, radius = column radius * steamWidth(h). Fails when the smallest is under CLEARANCE_MIN."""
    cols = steam_columns()
    for c in cols:
        print(f"[04_room] steam column {c[0]}: axis ({c[1]:.3f}, {c[2]:.3f}), base z {c[3]:.3f}, height {c[4]:.3f}, radius {c[5]}, width base {c[6]}, power {c[7]}")
    bm.verts.ensure_lookup_table()
    bm.faces.ensure_lookup_table()
    bm.faces.index_update()
    face_parts = {}
    for name, (a, b) in Parts.ranges.items():
        for v in (bm.verts[k] for k in range(a, b)):
            for f in v.link_faces:
                face_parts.setdefault(f.index, name)
    worst, widest = {}, {}
    step = 0.002
    for f in bm.faces:
        name = face_parts.get(f.index)
        if name is None:
            continue
        vs = [v.co for v in f.verts]
        for k in range(1, len(vs) - 1):
            a, b, c = vs[0], vs[k], vs[k + 1]
            n = max(1, int(max((b - a).length, (c - a).length, (c - b).length) / step))
            for i in range(n + 1):
                for j in range(n + 1 - i):
                    p = a + (b - a) * (i / n) + (c - a) * (j / n)
                    for col in cols:
                        cname, cx, cy, cz, height, radius, wb, wp = col
                        r = radius * steam_width((p.z - cz) / height, wb, wp)
                        d = math.hypot(p.x - cx, p.y - cy) - r
                        key = (name, cname)
                        if d < worst.get(key, 1e9):
                            worst[key] = d
                        d_full = math.hypot(p.x - cx, p.y - cy) - radius  # against the widest part of the column at any height
                        if d_full < widest.get(key, 1e9):
                            widest[key] = d_full
    print("[04_room] steam clearance in mm (plan view, part to column surface), smallest per part:")
    for name in Parts.ranges:
        print(f"  {name:15s} tea {worst[(name, 'tea')] * 1000:7.1f}   kettle {worst[(name, 'kettle')] * 1000:7.1f}")
    full = min(widest.items(), key=lambda kv: kv[1])
    print(f"[04_room] for reference, against the widest part of each column (full radius at any height): {full[1] * 1000:.1f} mm ({full[0][0]} to the {full[0][1]} column)")
    smallest = min(worst.items(), key=lambda kv: kv[1])
    print(f"[04_room] smallest steam clearance: {smallest[1] * 1000:.1f} mm ({smallest[0][0]} to the {smallest[0][1]} column), minimum {CLEARANCE_MIN * 1000:.0f} mm")
    if smallest[1] < CLEARANCE_MIN:
        raise SystemExit(f"04_room: {smallest[0][0]} is only {smallest[1] * 1000:.1f} mm from the {smallest[0][1]} steam column (minimum {CLEARANCE_MIN * 1000:.0f} mm)")


def check_frames(bm):
    """Slice D2 checks: depth and flush position, pictogram raise and margin, separation from every other part (3D boxes, the kettle and
    the mug included), and the apparent steam table with the D0 formula (shift = -(WALL_FACE - marker y) * tan(azimuth))."""
    bm.verts.ensure_lookup_table()

    def box_of(rng):
        pts = [bm.verts[k].co for k in range(*rng)]
        return Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))), Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))

    print("[04_room] D2 frames: depth and position on the wall, pictogram raise above the panel and margin to the border (mm)")
    for name, ((x0, x1), (z0, z1), picto, mat_name) in FRAMES.items():
        lo, hi = box_of(Parts.ranges[f"frame_{name}"])
        plo, phi = box_of(Parts.pictos[f"frame_{name}"])
        y_panel = WALL_FACE - FRAME_DEPTH + PANEL_RECESS
        raise_mm = (y_panel - plo.y) * 1000
        inner = (x0 + FRAME_BORDER, x1 - FRAME_BORDER, z0 + FRAME_BORDER, z1 - FRAME_BORDER)
        margin = min(plo.x - inner[0], inner[1] - phi.x, plo.z - inner[2], inner[3] - phi.z) * 1000
        print(f"  frame {name} ({picto:5s}, {mat_name}) x {lo.x:.3f}..{hi.x:.3f}  z {lo.z:.3f}..{hi.z:.3f}  y {lo.y:.3f}..{hi.y - EMBED:.3f} (embed {EMBED * 1000:.0f} mm in the wall)  "
              f"depth {(WALL_FACE - lo.y) * 1000:.1f}  size {(x1 - x0) * 1000:.0f} x {(z1 - z0) * 1000:.0f}  picto raise {raise_mm:.1f}  margin {margin:.1f}")
        assert abs((WALL_FACE - lo.y) - FRAME_DEPTH) < 1e-6 and abs(hi.y - (WALL_FACE + EMBED)) < 1e-6, f"frame {name} is not {FRAME_DEPTH * 1000:.0f} mm deep and flush"
        assert abs(raise_mm - PICTO_RAISE * 1000) < 0.01, f"pictogram {name} is not raised {PICTO_RAISE * 1000:.0f} mm"
        assert margin >= PICTO_MARGIN_MIN * 1000, f"pictogram {name} is too close to the border ({margin:.1f} mm)"

    # Other things the frames must not touch: every D1 part, the older Room parts and the kettle and mug objects (their handle included).
    obstacles = {n: box_of(r) for n, r in Parts.ranges.items() if not n.startswith("frame_")}
    obstacles.update({n: box_of(r) for n, r in Parts.others.items()})
    for oname in ("Kettle", "Mug"):
        ob = bpy.data.objects[oname]
        corners = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        for child in ob.children_recursive:
            corners += [child.matrix_world @ Vector(c) for c in child.bound_box]
        obstacles[oname] = (Vector((min(c.x for c in corners), min(c.y for c in corners), min(c.z for c in corners))), Vector((max(c.x for c in corners), max(c.y for c in corners), max(c.z for c in corners))))
    print("[04_room] D2 separation of each frame from the nearest other part, mm (separation = largest gap over x, y, z; negative = boxes overlap)")
    for name in FRAMES:
        flo, fhi = box_of(Parts.ranges[f"frame_{name}"])
        best = None
        for oname, (olo, ohi) in obstacles.items():
            sep = max(max(olo[k] - fhi[k], flo[k] - ohi[k]) for k in range(3))
            if best is None or sep < best[0]:
                best = (sep, oname)
        sep_xz = {oname: max(max(olo[k] - fhi[k], flo[k] - ohi[k]) for k in (0, 2)) for oname, (olo, ohi) in obstacles.items()}
        near_xz = min(sep_xz.items(), key=lambda kv: kv[1])
        print(f"  frame {name}: nearest in 3D {best[1]} {best[0] * 1000:.1f} mm; nearest in the wall plane (x, z) {near_xz[0]} {near_xz[1] * 1000:.1f} mm")
        assert best[0] > 0, f"frame {name} overlaps {best[1]}"
    kb = obstacles["Kettle"]
    print(f"  kettle box x {kb[0].x:.3f}..{kb[1].x:.3f} (handle side), floor plant box x {obstacles['plant'][0].x:.3f}..{obstacles['plant'][1].x:.3f}, top z {obstacles['plant'][1].z:.3f}")

    cols = steam_columns()
    print("[04_room] D2 apparent steam on the back wall, x gap in mm from the steam edge to the frame (D0 formula: centre = marker x - (0.225 - marker y) * tan(azimuth),")
    print("          half width = radius * steamWidth(h) at the widest height inside the frame's z range; in brackets with the half width stretched by 1/cos(azimuth), the true silhouette of a cylinder)")
    worst = 1e9
    for az in (0, 10, 20, 30, 40):
        ta, ca = math.tan(math.radians(az)), math.cos(math.radians(az))
        for cname, cx, cy, cz, height, radius, wb, wp in cols:
            xc = cx - (WALL_FACE - cy) * ta
            cells = []
            for name, ((x0, x1), (z0, z1), _p, _m) in FRAMES.items():
                za, zb = max(z0, cz), min(z1, cz + height)
                zin = za < zb
                if not zin:
                    za, zb = cz, cz + height  # no common height: report against the whole column (conservative)
                r = max(radius * steam_width((z - cz) / height, wb, wp) for z in (za + (zb - za) * i / 20 for i in range(21)))

                def gap(rr):
                    return max(x0 - (xc + rr), (xc - rr) - x1)

                g0, g1 = gap(r), gap(r / ca)
                worst = min(worst, g0 * 1000 if zin else 1e9)
                cells.append(f"{name} {g0 * 1000:7.1f} ({g1 * 1000:7.1f}){'*' if zin else ' '}")
            print(f"  az {az:2d}  {cname:6s} centre x {xc:+.3f}  " + "   ".join(cells))
    print("          * = frame and steam share a height range (otherwise the gap is against the whole column). Smallest gap with shared height:",
          "none" if worst == 1e9 else f"{worst:.1f} mm")
    assert worst > 0, "a frame overlaps the apparent steam"


# ------------------------------------------------------------------------------ main ------------


def make_material(name, hex_color):
    """Flat Principled material like the ones of 01_blockout.py (base colour linear, roughness 1, no metal)."""
    def lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    h = hex_color.lstrip("#")
    r, g, b = (lin(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))
    mat = bpy.data.materials.new(name)
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    mat.diffuse_color = (r, g, b, 1.0)
    return mat


def setup_extra_slots(room):
    """Keeps the first seven slots, drops any extra ones from an earlier run and appends the slice D1 materials in ROOM_MATERIALS
    order (created when missing, existing ones are never recoloured)."""
    mesh = room.data
    while len(mesh.materials) > len(ROOM_MATERIALS_BASE):
        mesh.materials.pop(index=len(mesh.materials) - 1)
    for name in ROOM_MATERIALS[len(ROOM_MATERIALS_BASE) :]:
        mat = bpy.data.materials.get(name) or make_material(name, NEW_MATERIAL_COLORS[name])
        mesh.materials.append(mat)
    assert [s.material.name for s in room.material_slots] == ROOM_MATERIALS, "Room material slots do not match ROOM_MATERIALS"


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    force = "--force" in argv
    argv = [a for a in argv if a != "--force" and not a.startswith("--jar-glass=")]
    out = argv[0] if argv else None

    room = bpy.data.objects["Room"]
    mesh = room.data
    if "UV_AO" in mesh.uv_layers and not force:
        raise SystemExit(
            "04_room: Room already has the UV layer UV_AO (slice 2.4). Rebuilding the mesh would drop it and make "
            "public/models/room_ao.png stale. Pass --force after the output path and re-run 05_ao_bake.py afterwards."
        )
    assert [s.material.name for s in room.material_slots][: len(ROOM_MATERIALS_BASE)] == ROOM_MATERIALS_BASE, "the first seven Room material slots changed"
    assert tuple(room.location) == (0.0, 0.0, 0.0), "Room origin is not the world origin"
    setup_extra_slots(room)

    bm = bmesh.new()
    open_faces = []
    build_walls_and_window(bm)
    build_floor(bm)
    build_cabinet(bm)
    v = len(bm.verts)
    build_plant(bm, open_faces)
    Parts.others["plant"] = (v, len(bm.verts))
    v = len(bm.verts)
    build_wall_plant(bm, open_faces)
    Parts.others["wall_plant"] = (v, len(bm.verts))
    v = len(bm.verts)
    build_tin(bm)
    build_books(bm)
    Parts.others["tin_books"] = (v, len(bm.verts))
    build_shelf(bm)
    build_jars(bm)
    build_rail(bm)
    build_frames(bm, open_faces)
    build_tea_box(bm)
    check_new_parts(bm)
    check_clearance(bm)
    check_frames(bm)
    check_tea_box(bm)

    # Outward normals for the closed solids; leaves and coins are open surfaces with explicit winding, so skip them.
    open_set = set(open_faces)
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f not in open_set])
    for f in bm.faces:
        f.smooth = False
    apply_shading(bm)  # slice G2: plant leaves, coins, stems, stalks, ropes and vines smooth (pots by SMOOTH_POTS)
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
