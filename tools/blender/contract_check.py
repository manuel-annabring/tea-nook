"""Contract check for the tea nook model (SPEC.md section 5).

Run on any .blend, headless:

    /Applications/Blender.app/Contents/MacOS/Blender -b path/to/file.blend \\
        --python tools/blender/contract_check.py

Exits with code 1 if any error is found. Warnings do not fail the check.
export_glb.py runs this first and refuses to export on errors.
"""

import os
import re
import sys

import bpy
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import contract_spec as spec  # noqa: E402

TOL = 1e-4  # rotation / scale deviation from identity
ORIGIN_TOL = spec.ORIGIN_TOL_MM / 1000.0


def _world_points(obj):
    return [obj.matrix_world @ v.co for v in obj.data.vertices]


def _bounds(points):
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


def _local_bounds(obj):
    return _bounds([v.co for v in obj.data.vertices])


def _base_center(obj):
    """Center of the object's underside in local space: xy middle of the vertices within the
    origin tolerance of the lowest point, and that lowest z. A spout, handle or lid does not
    shift it, which a plain bounding-box center would."""
    pts = [v.co for v in obj.data.vertices]
    low = min(p.z for p in pts)
    bottom = [p for p in pts if p.z <= low + ORIGIN_TOL]
    lo, hi = _bounds(bottom)
    return Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, low))


def _identity_deviation(matrix):
    m3 = matrix.to_3x3()
    return max(abs(m3[i][j] - (1.0 if i == j else 0.0)) for i in range(3) for j in range(3))


def run_check():
    errors, warnings = [], []
    scene = bpy.context.scene
    objs = {o.name: o for o in scene.objects if o.type in {"MESH", "EMPTY"}}

    # 1. Names: present, no Blender duplicate suffixes, nothing unexpected.
    for name in spec.REQUIRED_NAMES:
        if name not in objs:
            errors.append(f"missing object: {name}")
    for name in objs:
        if re.search(r"\.\d{3}$", name):
            errors.append(f"duplicate-suffix name (rename it): {name}")
        elif name not in spec.REQUIRED_NAMES:
            warnings.append(f"object not in contract (will be exported): {name}")

    # 2. Units and transforms: meters, scale and rotation applied everywhere.
    if abs(scene.unit_settings.scale_length - 1.0) > 1e-6:
        errors.append(f"unit scale is {scene.unit_settings.scale_length}, expected 1.0 (meters)")
    for name, o in objs.items():
        if _identity_deviation(o.matrix_basis) > TOL or (
            o.parent is not None and _identity_deviation(o.matrix_parent_inverse) > TOL
        ):
            if name in spec.MARKER_NAMES:
                errors.append(f"{name}: marker must have identity rotation and scale 1")
            else:
                errors.append(f"{name}: scale/rotation not applied (Ctrl+A in Blender)")

    # 3. Types and hierarchy.
    for name, type_, parent in spec.OBJECTS:
        o = objs.get(name)
        if o is None:
            continue
        if o.type != type_:
            errors.append(f"{name}: must be a {type_.lower()} (is {o.type.lower()})")
        parent_name = o.parent.name if o.parent is not None else None
        if parent_name != parent:
            want = f"a child of {parent}" if parent else "top-level"
            have = f"child of {parent_name}" if parent_name else "top-level"
            errors.append(f"{name}: must be {want} (is {have})")

    meshes = [o for o in objs.values() if o.type == "MESH"]
    contract_meshes = {n: objs[n] for n in spec.MESH_NAMES if n in objs and objs[n].type == "MESH"}
    for name, o in contract_meshes.items():
        if not o.data.vertices:
            errors.append(f"{name}: mesh has no vertices")
    empty_meshes = {n for n, o in contract_meshes.items() if not o.data.vertices}
    ok_meshes = {n: o for n, o in contract_meshes.items() if n not in empty_meshes}

    # 4. Origins.
    room = objs.get("Room")
    if room is not None and room.matrix_world.translation.length > ORIGIN_TOL:
        errors.append("Room: origin must be at the world origin")
    for name in ("Mug", "Kettle"):
        o = ok_meshes.get(name)
        if o is None:
            continue
        base = _base_center(o)
        if abs(base.x) > ORIGIN_TOL or abs(base.y) > ORIGIN_TOL or abs(base.z) > ORIGIN_TOL:
            errors.append(
                f"{name}: origin must be at the center of its base within {spec.ORIGIN_TOL_MM} mm "
                f"(base center is at {base.x*1000:.1f}, {base.y*1000:.1f}, {base.z*1000:.1f} mm from the origin)"
            )
    for name in ("TeaSurface", "Window_Glass", "Window_Sky"):
        o = ok_meshes.get(name)
        if o is None:
            continue
        lo, hi = _local_bounds(o)
        if ((lo + hi) / 2).length > ORIGIN_TOL:
            errors.append(f"{name}: origin must be at its center within {spec.ORIGIN_TOL_MM} mm")

    # 5. Marker plausibility. World space, read from the objects, nothing hard-coded.
    mug, tea = ok_meshes.get("Mug"), objs.get("Steam_Tea")
    if mug is not None and tea is not None:
        lo, hi = _bounds(_world_points(mug))
        p = tea.matrix_world.translation
        if abs(p.z - hi.z) > spec.STEAM_TEA_RIM_Z_TOL:
            errors.append(
                f"Steam_Tea: must sit at the mug rim (z={p.z:.3f}, mug top is z={hi.z:.3f}, "
                f"tolerance {spec.STEAM_TEA_RIM_Z_TOL*1000:.0f} mm)"
            )
        if not (lo.x <= p.x <= hi.x and lo.y <= p.y <= hi.y):
            errors.append("Steam_Tea: must be above the mug opening (inside the mug's footprint)")
    kettle, spout = ok_meshes.get("Kettle"), objs.get("Steam_Kettle")
    if kettle is not None and spout is not None:
        lo, hi = _bounds(_world_points(kettle))
        p = spout.matrix_world.translation
        m = spec.STEAM_KETTLE_XY_MARGIN
        axis = kettle.matrix_world.translation
        half = max(hi.x - lo.x, hi.y - lo.y) / 2
        offset = ((p.x - axis.x) ** 2 + (p.y - axis.y) ** 2) ** 0.5
        if not (lo.x - m <= p.x <= hi.x + m and lo.y - m <= p.y <= hi.y + m and lo.z <= p.z <= hi.z + m):
            errors.append("Steam_Kettle: must be at the kettle's spout (outside the kettle's bounds)")
        elif p.z < lo.z + spec.STEAM_KETTLE_MIN_HEIGHT_FRAC * (hi.z - lo.z):
            errors.append("Steam_Kettle: must be in the upper half of the kettle (the spout opening)")
        elif offset < spec.STEAM_KETTLE_MIN_OFFSET_FRAC * half:
            errors.append("Steam_Kettle: must be on the spout side, away from the kettle's axis")

    # 6. Materials: only the contract names, all used, within the count budget.
    used = {s.material.name for o in meshes for s in o.material_slots if s.material}
    for name in sorted(used - set(spec.MATERIALS)):
        errors.append(f"material not in contract: {name}")
    for name in spec.MATERIALS:
        if name not in used:
            errors.append(f"material not used by any object: {name}")
    for o in meshes:
        if not any(s.material for s in o.material_slots):
            errors.append(f"{o.name}: no material")
    if len(used) > spec.MAX_MATERIALS:
        errors.append(f"{len(used)} materials in use, budget is {spec.MAX_MATERIALS}")

    # 7. UV layer: Room needs the first layer named UVMap (UV_AO comes with a later amendment).
    if room is not None and room.type == "MESH":
        layers = [l.name for l in room.data.uv_layers]
        if not layers or layers[0] != spec.ROOM_UV_LAYER:
            errors.append(f"Room: first UV layer must be named {spec.ROOM_UV_LAYER} (has {layers or 'none'})")

    # 8. Triangle budget (evaluated meshes, as the exporter applies modifiers) and modifiers.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    tris = 0
    for o in meshes:
        if o.modifiers:
            warnings.append(f"{o.name}: has modifiers (applied at export, apply them before sharing)")
        ev = o.evaluated_get(depsgraph)
        mesh = ev.to_mesh()
        mesh.calc_loop_triangles()
        tris += len(mesh.loop_triangles)
        ev.to_mesh_clear()
    if tris > spec.TRIANGLE_CAP:
        errors.append(f"triangle count {tris} is over the hard cap of {spec.TRIANGLE_CAP}")
    elif tris > spec.TRIANGLE_TARGET:
        warnings.append(f"triangle count {tris} is over the target of {spec.TRIANGLE_TARGET}")

    return errors, warnings, tris


def main():
    errors, warnings, tris = run_check()
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"contract check: {len(errors)} error(s), {len(warnings)} warning(s), {tris} triangles")
    if errors:
        sys.exit(1)
    print("contract check: PASS")


if __name__ == "__main__":
    main()
