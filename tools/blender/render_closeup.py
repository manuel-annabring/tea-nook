"""Close-up Workbench renders of a few objects, for judging a shape up close (phase 2).

    Blender -b tools/blender/nook.blend --python tools/blender/render_closeup.py -- \\
        <output_dir> <prefix> <Object1,Object2,...> [distance_m]

Hides every other mesh, frames the combined bounds of the named objects (including their children) from
two angles and writes <prefix>-close-a.png and <prefix>-close-b.png. It does not save the .blend.
"""

import math
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1 :]
out_dir, prefix, names = args[0], args[1], set(args[2].split(","))
distance = float(args[3]) if len(args) > 3 else 0.5

keep = set()
for name in names:
    obj = bpy.data.objects[name]
    keep.add(obj)
    keep.update(obj.children_recursive)

lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    if o in keep:
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    else:
        o.hide_render = True
        o.hide_viewport = True

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.render.resolution_x, scene.render.resolution_y = 900, 700
world = bpy.data.worlds.new("closeup")
world.color = (0.9, 0.87, 0.8)
scene.world = world

centre = (lo + hi) / 2
for tag, (azimuth, elevation) in {"a": (35, 28), "b": (-60, 20)}.items():
    cam_data = bpy.data.cameras.new("closeup")
    cam_data.lens = 70
    cam = bpy.data.objects.new("closeup", cam_data)
    scene.collection.objects.link(cam)
    az, el = math.radians(azimuth), math.radians(elevation)
    cam.location = centre + Vector(
        (distance * math.sin(az) * math.cos(el), -distance * math.cos(az) * math.cos(el), distance * math.sin(el))
    )
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = f"{out_dir}/{prefix}-close-{tag}.png"
    bpy.ops.render.render(write_still=True)
