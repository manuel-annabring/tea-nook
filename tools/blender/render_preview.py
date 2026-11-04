"""Renders quick Workbench previews of a .blend (never saves the .blend).

    /Applications/Blender.app/Contents/MacOS/Blender -b path/to/file.blend \\
        --python tools/blender/render_preview.py -- <output_dir>

Writes front.png, side.png, top.png and iso.png. Cameras are framed from the bounds of all mesh
objects, so it works on any scene. Blender is Z up with the front at -Y: front looks along +Y,
side looks along -X (from the open +X side, since the left wall is at -X), top looks down.
"""

import math
import os
import sys

import bpy
from mathutils import Vector

# name: (direction from the scene center to the camera, orthographic or perspective)
VIEWS = {
    "front": (Vector((0.0, -1.0, 0.0)), True),
    "side": (Vector((1.0, 0.0, 0.0)), True),
    "top": (Vector((0.0, -0.001, 1.0)), True),
    "iso": (Vector((-0.6, -1.0, 0.7)), False),
}

# Visible (horizontal, vertical) extents of the scene bounds for each orthographic view.
VIEW_EXTENTS = {
    "front": lambda s: (s.x, s.z),
    "side": lambda s: (s.y, s.z),
    "top": lambda s: (s.x, s.y),
}


def scene_bounds(scene):
    pts = []
    for o in scene.objects:
        if o.type == "MESH" and o.data.vertices and not o.hide_render:
            pts.extend(o.matrix_world @ v.co for v in o.data.vertices)
    if not pts:
        return Vector((-1, -1, -1)), Vector((1, 1, 1))
    return (
        Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
        Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))),
    )


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out_dir = os.path.abspath(argv[0] if argv else ".")
    os.makedirs(out_dir, exist_ok=True)

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x, scene.render.resolution_y = 1200, 800
    scene.display.shading.light = "STUDIO"
    scene.display.shading.color_type = "MATERIAL"
    scene.display.shading.show_cavity = True
    world = bpy.data.worlds.new("preview")
    world.color = (0.82, 0.80, 0.76)
    scene.world = world

    cam_data = bpy.data.cameras.new("preview_cam")
    cam = bpy.data.objects.new("preview_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    lo, hi = scene_bounds(scene)
    center = (lo + hi) / 2
    size = hi - lo
    radius = max(size.length / 2, 0.01)
    aspect = scene.render.resolution_x / scene.render.resolution_y

    for name, (direction, ortho) in VIEWS.items():
        direction = direction.normalized()
        cam.location = center + direction * radius * 6
        cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
        cam_data.clip_start, cam_data.clip_end = radius * 0.1, radius * 20
        if ortho:
            cam_data.type = "ORTHO"
            # ortho_scale covers the wider render dimension; fit this view's visible extents.
            horiz, vert = VIEW_EXTENTS[name](size)
            cam_data.ortho_scale = max(horiz, vert * aspect, 0.01) * 1.15
        else:
            cam_data.type = "PERSP"
            cam_data.lens = 50
            # Fit the bounding sphere into the (horizontal) field of view.
            half_fov = math.atan(cam_data.sensor_width / 2 / cam_data.lens)
            cam.location = center + direction * (radius * 1.6 / math.sin(min(half_fov, 0.6)))
        scene.render.filepath = os.path.join(out_dir, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"wrote {scene.render.filepath}")


if __name__ == "__main__":
    main()
