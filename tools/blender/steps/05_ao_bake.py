"""Step 05: ambient-occlusion bake for `Room` (slice 2.4).

Opens the .blend Blender was started with and does two things, headless:

1. UNWRAP. Adds (or rebuilds) a second UV layer `UV_AO` on the `Room` mesh and unwraps it into
   non-overlapping islands that fit the 0..1 square (every face gets its own piece of texture, no
   tiling, so the baked light can differ per face). The first layer `UVMap` is not touched and stays
   first. `Room` geometry, object, origin, transforms and the 7 material slots are untouched.
2. BAKE. Renders ambient occlusion with Cycles (CPU) into a temporary 1024 x 1024 image on `UV_AO`,
   levels it so it multiplies gently (white = no occlusion), blurs the sampling noise a little, and
   saves `public/models/room_ao.png` (8 bit, Non-Color). `Mug`, `Kettle` and `TeaSurface` are in the
   scene while baking, so the contact darkening under them ends up in the Room texture, but nothing is
   baked onto them. `Window_Glass` and `Window_Sky` are hidden for the bake so the window is not blocked.

Thin faces (floor board edges, trim, handles, book covers) would get about one texel each at that density, so
their AO would be smeared and the dark crack between two floor boards would not show (slice F4). Single-face
islands with a short side under `THIN_MM` are therefore scaled up before packing (`boost_thin_faces`), at most
`BOOST_MAX` times; everything else keeps the common density.

All temporary things (bake image nodes, render settings, world, hidden flags) are removed or restored,
so the final materials are unchanged. Re-runnable: an existing `UV_AO` is removed and rebuilt.

Run (on a copy first, then on the real file):
  Blender -b tools/blender/nook.blend --python tools/blender/steps/05_ao_bake.py -- [output.blend [ao.png]]
Without an output path the opened file is saved in place and the PNG goes to public/models/room_ao.png.
"""

import os
import shutil
import sys
import time

import bmesh
import bpy
import numpy as np

# ------------------------------------------------------------------ parameters ----------------
UV_AO = "UV_AO"
TEX_SIZE = 1024  # contract: 1024 x 1024, 2048 at most
ISLAND_MARGIN = 0.004  # gap between islands in UV space (about 4 px at 1024), room for the bake margin
BAKE_MARGIN_PX = 4  # Cycles extends island edge colours this many pixels outwards (stops dark/white seams)
SAMPLES = 128  # Cycles samples per pixel
AO_DISTANCE = 0.20  # metres: occluders further away than this are ignored, so the darkening stays local
BLUR_PASSES = 2  # 3 x 3 box blur passes on the result (hides sampling noise, keeps it soft)
# Levels: out = 1 - GAIN * (1 - ao) ** GAMMA, then clamped to [FLOOR, 1]. GAIN < 1 keeps the darkest
# corners from going black, because the app multiplies this on top of the palette colours. three applies
# aoMapIntensity as 1 + (ao - 1) * intensity, which goes negative when (1 - FLOOR) * intensity > 1, so keep
# intensity <= 1 / (1 - FLOOR) (1.67 for FLOOR 0.40; see AO.intensity in src/config/look.ts).
GAIN, GAMMA, FLOOR = 0.85, 1.0, 0.40
# three.js reads only the R channel of an aoMap; G and B get a little extra darkening so the PNG looks
# warm-neutral grey when opened in an image viewer (cosmetic).
WARM_G, WARM_B = 1.05, 1.18
ROOM_MATERIALS = ["Mat_Wall", "Mat_Wood", "Mat_Frame", "Mat_Leaf", "Mat_Pot", "Mat_Tin", "Mat_Book"]
BURIED_BELOW = 0.30  # raw AO under this is pure FLOOR after levelling; a face with no pixel above it is buried
ERODE_PX = BAKE_MARGIN_PX + 2  # island border ignored when deciding whether a face is buried
HIDE_FOR_BAKE = ["Window_Glass", "Window_Sky"]
# Thin faces (floor board edges, trim, handles, book covers) are 2 to 8 mm across, about one texel at the common density,
# so their bake is one smeared pixel that cannot show the dark crack between two boards. Each single-face island whose
# short side is below THIN_MM is scaled up (about its centre, before packing) so that side gets about THIN_MM at the common
# density, at most BOOST_MAX times. Those islands then get several texels of their own (slice F4, floor joints).
THIN_MM = 16.0
BOOST_MAX = 4.0

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PNG = os.path.abspath(os.path.join(HERE, "..", "..", "..", "public", "models", "room_ao.png"))


# ------------------------------------------------------------------------- helpers ------------
def select_only(obj):
    """Explicit selection state for bpy.ops: deselect all, select and activate `obj`."""
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def unwrap_uv_ao(room):
    """Create the `UV_AO` layer and fill it with a non-overlapping, uniform-density layout."""
    mesh = room.data
    if UV_AO in mesh.uv_layers:
        mesh.uv_layers.remove(mesh.uv_layers[UV_AO])
    layer = mesh.uv_layers.new(name=UV_AO, do_init=False)
    assert [l.name for l in mesh.uv_layers] == ["UVMap", UV_AO], [l.name for l in mesh.uv_layers]
    mesh.uv_layers.active = layer  # the UV operators work on the active layer

    select_only(room)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Smart UV Project cuts the mesh into islands wherever the angle between faces is large (our boxes
    # fall apart into one island per face) and keeps the same texel density for all of them (area_weight).
    bpy.ops.uv.smart_project(angle_limit=1.15192, island_margin=ISLAND_MARGIN, area_weight=1.0, correct_aspect=True, scale_to_bounds=False)
    boost_thin_faces(mesh)
    bpy.ops.uv.select_all(action="SELECT")
    # Pack all islands into 0..1 (rotation allowed for a tight fit, scaling keeps relative sizes).
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, margin_method="ADD", margin=ISLAND_MARGIN, shape_method="CONCAVE")
    bpy.ops.object.mode_set(mode="OBJECT")

    # `UVMap` stays the first layer and the one used for rendering/export order; UV_AO is addressed by name.
    mesh.uv_layers.active = mesh.uv_layers["UVMap"]
    return layer


def boost_thin_faces(mesh):
    """Scale up the UV island of every thin, single-face island (see THIN_MM). Runs in edit mode on the active UV layer, after
    Smart UV Project and before packing. Returns (count, histogram of factors)."""
    bm = bmesh.from_edit_mesh(mesh)
    uv = bm.loops.layers.uv[UV_AO]
    count, factors = 0, []
    for f in bm.faces:
        if len(f.verts) != 4:
            continue
        short = min(e.calc_length() for e in f.edges) * 1000.0  # millimetres
        if short >= THIN_MM:
            continue
        # Only islands made of this one face: every neighbour across an edge must have different UVs there.
        alone = True
        for loop in f.loops:
            other = loop.link_loop_radial_next
            if other is loop:
                continue
            a0, a1 = loop[uv].uv, loop.link_loop_next[uv].uv
            b0, b1 = other[uv].uv, other.link_loop_next[uv].uv
            if (a0 - b1).length < 1e-6 and (a1 - b0).length < 1e-6:
                alone = False
                break
        if not alone:
            continue
        k = min(BOOST_MAX, THIN_MM / max(short, 1e-3))
        c = sum((l[uv].uv for l in f.loops), type(f.loops[0][uv].uv)((0, 0))) / len(f.loops)
        for l in f.loops:
            l[uv].uv = c + (l[uv].uv - c) * k
        count += 1
        factors.append(k)
    bmesh.update_edit_mesh(mesh)
    print(f"[05_ao_bake] thin single-face islands boosted: {count}" + (f" (factor {min(factors):.1f} to {max(factors):.1f})" if factors else ""))
    return count


def rasterize_uv_ao(mesh):
    """Rasterise every polygon of UV_AO into a TEX_SIZE grid (pixel centres). Returns (ids, stats): `ids` holds
    the polygon index per pixel (-1 where no face lies), `stats` the UV bounds and the number of pixels that
    more than one polygon covers (must be 0: islands do not overlap)."""
    layer = mesh.uv_layers[UV_AO]
    uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    layer.uv.foreach_get("vector", uv)
    uv = uv.reshape(-1, 2)
    size = TEX_SIZE
    ids = np.full((size, size), -1, dtype=np.int32)
    overlap = 0
    for poly in mesh.polygons:
        pts = uv[list(poly.loop_indices)]
        for i in range(1, len(pts) - 1):  # fan triangles
            tri = np.array([pts[0], pts[i], pts[i + 1]]) * size
            x0, y0 = np.floor(tri.min(axis=0)).astype(int)
            x1, y1 = np.ceil(tri.max(axis=0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, size), min(y1, size)
            if x1 <= x0 or y1 <= y0:
                continue
            gx, gy = np.meshgrid(np.arange(x0, x1) + 0.5, np.arange(y0, y1) + 0.5)
            a, b, c = tri
            d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
            if abs(d) < 1e-12:
                continue
            w1 = ((b[1] - c[1]) * (gx - c[0]) + (c[0] - b[0]) * (gy - c[1])) / d
            w2 = ((c[1] - a[1]) * (gx - c[0]) + (a[0] - c[0]) * (gy - c[1])) / d
            inside = (w1 >= 0) & (w2 >= 0) & (w1 + w2 <= 1)
            window = ids[y0:y1, x0:x1]
            overlap += int((inside & (window >= 0) & (window != poly.index)).sum())
            window[inside] = poly.index
    stats = {"min": uv.min(axis=0).tolist(), "max": uv.max(axis=0).tolist(), "overlap_px": overlap, "covered_px": int((ids >= 0).sum())}
    return ids, stats


def bake_ao(room, scene):
    """Bake AO of the whole scene onto Room's UV_AO. Returns the raw baked pixel array (H, W, 4)."""
    mesh = room.data
    saved = {
        "engine": scene.render.engine,
        "samples": scene.cycles.samples if hasattr(scene, "cycles") else None,
        "device": scene.cycles.device if hasattr(scene, "cycles") else None,
        "denoising": scene.cycles.use_denoising if hasattr(scene, "cycles") else None,
        "world": scene.world,
        "hidden": {n: bpy.data.objects[n].hide_render for n in HIDE_FOR_BAKE},
        "active_render": [l.active_render for l in mesh.uv_layers],
        "active": mesh.uv_layers.active_index,
    }
    temp_world = None
    image = None
    added_nodes = []
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = SAMPLES
        scene.cycles.use_denoising = False
        # AO needs a world only for its "distance" setting; a temporary one keeps the file clean.
        temp_world = bpy.data.worlds.new("TMP_AO_World")
        temp_world.light_settings.distance = AO_DISTANCE
        scene.world = temp_world
        for name in HIDE_FOR_BAKE:
            bpy.data.objects[name].hide_render = True  # still in the file, just not a blocker for the bake

        # Bake target: a Non-Color image, referenced by an Image Texture node (active) in every Room material.
        image = bpy.data.images.new("TMP_room_ao_bake", TEX_SIZE, TEX_SIZE, alpha=False, float_buffer=False)
        image.colorspace_settings.name = "Non-Color"
        for slot in room.material_slots:
            tree = slot.material.node_tree
            node = tree.nodes.new("ShaderNodeTexImage")
            node.name = "TMP_AO_BAKE"
            node.image = image
            tree.nodes.active = node  # the active image node is the bake target
            added_nodes.append((tree, node))

        # The bake writes to the active UV layer; make it UV_AO (restored below).
        mesh.uv_layers.active = mesh.uv_layers[UV_AO]
        select_only(room)  # only Room is baked to; Mug, Kettle, TeaSurface just block rays
        t0 = time.time()
        bpy.ops.object.bake(type="AO", margin=BAKE_MARGIN_PX, margin_type="EXTEND", use_clear=True)
        print(f"[05_ao_bake] bake took {time.time() - t0:.1f} s ({SAMPLES} samples, CPU)")
        pixels = np.empty(TEX_SIZE * TEX_SIZE * 4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        return pixels.reshape(TEX_SIZE, TEX_SIZE, 4).copy()
    finally:
        for tree, node in added_nodes:
            tree.nodes.remove(node)
        if image is not None:
            bpy.data.images.remove(image)
        scene.world = saved["world"]
        if temp_world is not None:
            bpy.data.worlds.remove(temp_world)
        for name, hidden in saved["hidden"].items():
            bpy.data.objects[name].hide_render = hidden
        scene.render.engine = saved["engine"]
        if saved["samples"] is not None:
            scene.cycles.samples = saved["samples"]
            scene.cycles.device = saved["device"]
            scene.cycles.use_denoising = saved["denoising"]
        mesh.uv_layers.active_index = saved["active"]
        for layer, flag in zip(mesh.uv_layers, saved["active_render"]):
            layer.active_render = flag


def level_and_save(raw, ids, png_path):
    """Raw AO (0 = occluded, 1 = open) -> soft, gentle texture -> 8-bit PNG. `ids` is the polygon id per pixel."""
    ao = raw[:, :, 0].copy()
    # Faces buried inside other boxes (the room is built from overlapping solids) bake to pure black and are
    # never seen. Whiten them and the empty space between islands so they do not bleed dark into visible
    # faces when the texture is mip-mapped. Decided on the raw bake, before the blur smears the edges.
    count = ids.max() + 1
    # Judge each face on its interior only (pixels at least ERODE_PX from the island edge): Cycles extends bright
    # neighbour colour into the border of a buried island, which would make it look partly lit.
    interior = ids >= 0
    for dy in range(-ERODE_PX, ERODE_PX + 1):
        for dx in range(-ERODE_PX, ERODE_PX + 1):
            interior &= np.roll(ids, (dy, dx), axis=(0, 1)) == ids
    lit = np.bincount(ids[interior], weights=(ao[interior] > BURIED_BELOW), minlength=count)  # interior pixels with real light
    total = np.bincount(ids[interior], minlength=count)
    buried = (total > 0) & (lit / np.maximum(total, 1) < 0.02)
    hide = (ids < 0) | np.where(ids >= 0, buried[np.clip(ids, 0, None)], False)
    ao[hide] = 1.0
    print(f"[05_ao_bake] fully buried faces (whitened): {int(buried.sum())} of {count}")
    for _ in range(BLUR_PASSES):
        p = np.pad(ao, 1, mode="edge")
        ao = sum(p[dy : dy + TEX_SIZE, dx : dx + TEX_SIZE] for dy in range(3) for dx in range(3)) / 9.0
    dark = np.clip(1.0 - ao, 0.0, 1.0)
    out_r = np.clip(1.0 - GAIN * dark**GAMMA, FLOOR, 1.0)
    out_g = np.clip(1.0 - GAIN * WARM_G * dark**GAMMA, FLOOR, 1.0)
    out_b = np.clip(1.0 - GAIN * WARM_B * dark**GAMMA, FLOOR, 1.0)
    rgba = np.stack([out_r, out_g, out_b, np.ones_like(out_r)], axis=-1).astype(np.float32)

    img = bpy.data.images.new("TMP_room_ao_out", TEX_SIZE, TEX_SIZE, alpha=False, float_buffer=False)
    try:
        img.colorspace_settings.name = "Non-Color"  # data, no colour transform when saving
        img.pixels.foreach_set(rgba.ravel())
        img.filepath_raw = png_path
        img.file_format = "PNG"
        img.save()
    finally:
        bpy.data.images.remove(img)
    visible = ~hide
    return float(out_r[visible].min()), float(out_r[visible].mean())


# --------------------------------------------------------------------------- main -------------
def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_blend = argv[0] if argv else None
    png_path = os.path.abspath(argv[1]) if len(argv) > 1 else DEFAULT_PNG

    assert TEX_SIZE <= 2048, "contract: AO texture is 1024 x 1024, 2048 at most"
    scene = bpy.context.scene
    room = bpy.data.objects["Room"]
    assert [s.material.name for s in room.material_slots] == ROOM_MATERIALS, "Room material slots changed"
    assert tuple(room.location) == (0.0, 0.0, 0.0), "Room origin is not the world origin"
    assert all(n in bpy.data.objects for n in ("Mug", "Kettle", "TeaSurface") + tuple(HIDE_FOR_BAKE))
    tri_before = sum(len(p.vertices) - 2 for p in room.data.polygons)

    unwrap_uv_ao(room)
    ids, stats = rasterize_uv_ao(room.data)
    print(f"[05_ao_bake] UV_AO bounds {stats['min']} .. {stats['max']}, covered {stats['covered_px']} px "
          f"({100 * stats['covered_px'] / TEX_SIZE ** 2:.0f} %), overlapping px {stats['overlap_px']}")
    assert stats["min"][0] >= 0 and stats["min"][1] >= 0 and stats["max"][0] <= 1 and stats["max"][1] <= 1, "UV_AO leaves 0..1"
    assert stats["overlap_px"] == 0, "UV_AO islands overlap"

    raw = bake_ao(room, scene)
    os.makedirs(os.path.dirname(png_path), exist_ok=True)
    lo, mean = level_and_save(raw, ids, png_path)
    print(f"[05_ao_bake] wrote {png_path} ({TEX_SIZE} x {TEX_SIZE}); output R over visible faces: min {lo:.2f}, mean {mean:.2f}")

    assert sum(len(p.vertices) - 2 for p in room.data.polygons) == tri_before, "Room geometry changed"
    print(f"[05_ao_bake] Room uv layers: {[l.name for l in room.data.uv_layers]}")

    if out_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(out_blend))
    else:
        # Saving in place overwrites the opened file: keep a copy next to it first (*.blend1 is git-ignored).
        backup = os.path.join(os.path.dirname(bpy.data.filepath), "nook-pre-ao.blend1")
        shutil.copyfile(bpy.data.filepath, backup)
        print(f"[05_ao_bake] backup of the opened file: {backup}")
        bpy.ops.wm.save_mainfile()


main()
