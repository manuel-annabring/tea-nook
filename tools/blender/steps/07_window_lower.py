"""Step 07: lower the window objects that `04_room.py` does not build (slice G2).

`04_room.py` rebuilds the window frame, sill, mullion and casing inside `Room` from `WIN_Z0` and `WIN_Z1` (the opening now sits
`WIN_DZ` lower than in slice 2.3). The contract objects `Window_Glass`, `Window_Sky` and the marker `Rays_Origin` are separate
objects in the .blend, so this step moves them by the same amount. It is absolute, not relative: the target height is the
original centre of the opening plus `WIN_DZ`, so running it twice changes nothing (idempotent).

Blender concept: an object's location is where its origin sits in the world. The two window quads have their origin at their
centre (contract), so moving the object moves the quad and its origin together; rotation and scale are not touched, so the
transforms stay applied and the contract check still passes. `Rays_Origin` is an Empty (a position marker); its position is the
centre of the opening, the same as `Window_Glass`. `Rays_Target` (a point on the worktop) stays where it is.

Keep `WIN_DZ` in step with `04_room.py` (the step checks that `Room` really has its window opening at the new height and fails
if not, so the two cannot drift apart silently).

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/07_window_lower.py -- [output.blend]
Without an output path the opened file is saved in place.
"""

import sys

import bpy

# ------------------------------------------------------------------ parameters (metres) -------
WIN_Z0_ORIGINAL, WIN_Z1_ORIGINAL = 0.12, 0.42  # opening in slice 2.3 (sill top, lintel underside above the worktop top)
WIN_DZ = -0.04  # same value as in 04_room.py
WALL_X, WIN_HALF_W = -0.30, 0.18  # inner face of the left wall, half width of the opening (04_room.py: WIN_Y 0, WIN_W 0.36)

CENTRE_Z = (WIN_Z0_ORIGINAL + WIN_Z1_ORIGINAL) / 2 + WIN_DZ  # centre of the lowered opening
MOVED = ["Window_Glass", "Window_Sky", "Rays_Origin"]


def room_opening(room):
    """(bottom, top) of the window opening as built into Room: the wall pieces beside the opening meet it at the wall face."""
    zs = sorted({round(v.co.z, 6) for v in room.data.vertices if abs(v.co.x - WALL_X) < 1e-6 and abs(abs(v.co.y) - WIN_HALF_W) < 1e-6})
    # Corners of the opening on the room-side wall face: z of the bottom edge and of the top edge (the wall piece edges are also in the list).
    return zs


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else None

    for name in MOVED:
        obj = bpy.data.objects[name]
        before = tuple(obj.location)
        obj.location.z = CENTRE_Z  # absolute target: running again changes nothing
        print(f"[07_window] {name}: {tuple(round(c, 4) for c in before)} -> {tuple(round(c, 4) for c in obj.location)}")
        assert abs(obj.location.x - before[0]) < 1e-9 and abs(obj.location.y - before[1]) < 1e-9, "only z may change"

    # Rays_Origin is the centre of the opening, the same point as Window_Glass.
    assert (bpy.data.objects["Rays_Origin"].location - bpy.data.objects["Window_Glass"].location).length < 1e-9

    # Consistency with Room: the opening edges at the wall face must be at CENTRE_Z -/+ 0.15.
    zs = room_opening(bpy.data.objects["Room"])
    z0, z1 = CENTRE_Z - 0.15, CENTRE_Z + 0.15
    assert any(abs(z - z0) < 1e-5 for z in zs) and any(abs(z - z1) < 1e-5 for z in zs), (
        f"Room's window opening is not at z {z0:.3f}..{z1:.3f} (wall-face corner heights {zs}); run 04_room.py with the same WIN_DZ first"
    )
    print(f"[07_window] opening z {z0:.3f}..{z1:.3f} confirmed in Room; centre {CENTRE_Z:.3f}")

    if out:
        bpy.ops.wm.save_as_mainfile(filepath=out)
    else:
        bpy.ops.wm.save_mainfile()


main()
