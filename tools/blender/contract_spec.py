"""Model contract (SPEC.md section 5) as data, shared by the check, export and build scripts.

Plain Python on purpose: no `import bpy` here, so tests and tools can import or parse this file.
Keep in sync with src/nook/contract.ts (the TypeScript twin). src/nook/contract.test.ts parses
this file with regexes, so keep one entry per line in OBJECTS and MATERIALS.
Do not change anything here without a SPEC.md section 5 amendment.
"""

# (name, Blender type, parent name or None). One tuple per line (the vitest twin test parses them).
OBJECTS = [
    ("Room", "MESH", None),
    ("Mug", "MESH", None),
    ("TeaSurface", "MESH", "Mug"),
    ("Steam_Tea", "EMPTY", "Mug"),
    ("Kettle", "MESH", None),
    ("Steam_Kettle", "EMPTY", "Kettle"),
    ("Window_Glass", "MESH", None),
    ("Window_Sky", "MESH", None),
    ("Rays_Origin", "EMPTY", None),
    ("Rays_Target", "EMPTY", None),
    ("Dust_Min", "EMPTY", None),
    ("Dust_Max", "EMPTY", None),
    ("Orbit_Target", "EMPTY", None),
]

REQUIRED_NAMES = [name for name, _type, _parent in OBJECTS]
# Marker Empties: only their position carries meaning (identity rotation, scale 1).
MARKER_NAMES = [name for name, type_, _parent in OBJECTS if type_ == "EMPTY"]
MESH_NAMES = [name for name, type_, _parent in OBJECTS if type_ == "MESH"]

# Material names are fixed. One per line (parsed by the vitest twin test).
MATERIALS = [
    "Mat_Wall",
    "Mat_Wood",
    "Mat_Frame",
    "Mat_Leaf",
    "Mat_Pot",
    "Mat_Tin",
    "Mat_Book",
    "Mat_Mug",
    "Mat_Tea",
    "Mat_Kettle",
    "Mat_KettleDetail",
    "Mat_Glass",
    "Mat_Sky",
    "Mat_Iron",  # 2026-11-06 amendment (phase 2b): shelf brackets, rail, hooks
    "Mat_Bag0",  # ... and one per tea bag / jar content (colour = TEAS[i].liquidColor)
    "Mat_Bag1",
    "Mat_Bag2",
    "Mat_Bag3",
]

# Budgets (SPEC.md section 5; MAX_MATERIALS was 14 until the 2026-11-06 amendment, draw calls under 50 are checked in the app). Plain `NAME = number` lines (parsed by the vitest twin test).
TRIANGLE_TARGET = 30000
TRIANGLE_CAP = 100000
GLB_MAX_MB = 3
MAX_MATERIALS = 20
ORIGIN_TOL_MM = 1

# Room UV layers (SPEC.md section 5, AO amendment of 2026-11-04): `UVMap` first (placeholder box projection),
# `UV_AO` second (non-overlapping 0..1 layout the baked AO texture is mapped with, exported as TEXCOORD_1).
ROOM_UV_LAYER = "UVMap"
ROOM_UV_AO_LAYER = "UV_AO"
# Baked AO texture of Room, in public/models/ (size in pixels, square; the bake script checks it).
AO_TEXTURE_FILE = "room_ao.png"
AO_TEXTURE_SIZE = 1024
AO_TEXTURE_MAX_SIZE = 2048

# Marker plausibility (implementation choices for the "near the rim" / "near the spout side"
# wording of SPEC.md section 5; logged in DECISIONS.md). Meters / fractions.
STEAM_TEA_RIM_Z_TOL = 0.03  # Steam_Tea z must be within 3 cm of the top of the Mug's bounding box
STEAM_KETTLE_XY_MARGIN = 0.03  # Steam_Kettle may sit up to 3 cm outside the Kettle's bbox (spout tips)
STEAM_KETTLE_MIN_HEIGHT_FRAC = 0.5  # ... and must be in the upper half of the Kettle
STEAM_KETTLE_MIN_OFFSET_FRAC = 0.4  # ... and off the kettle axis by >= 40% of its horizontal half extent
