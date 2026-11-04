"""Runs the contract check, then exports the scene as glTF binary (+Y up).

    /Applications/Blender.app/Contents/MacOS/Blender -b path/to/file.blend \\
        --python tools/blender/export_glb.py -- [output.glb]

Default output: public/models/nook.glb. Refuses (exit code 1, nothing written) if the check has
errors or the GLB is over the size budget (SPEC.md section 5: under 3 MB).
"""

import os
import shutil
import sys
import tempfile

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import contract_check  # noqa: E402
import contract_spec as spec  # noqa: E402

SIZE_BUDGET_BYTES = spec.GLB_MAX_MB * 1024 * 1024


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[0] if argv else os.path.join(HERE, "..", "..", "public", "models", "nook.glb")
    out = os.path.abspath(out)

    errors, warnings, tris = contract_check.run_check()
    for w in warnings:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    if errors:
        print(f"contract check FAILED ({len(errors)} error(s)); not exporting")
        sys.exit(1)
    print(f"contract check: PASS ({tris} triangles)")

    # Export to a scratch directory first so a refused or failed export never touches the target.
    scratch = tempfile.mkdtemp(prefix="nook-export-")
    try:
        tmp_path = os.path.join(scratch, "nook.glb")
        bpy.ops.export_scene.gltf(
            filepath=tmp_path,
            export_format="GLB",
            export_yup=True,
            export_apply=True,
            export_cameras=False,
            export_lights=False,
            export_materials="EXPORT",
            use_selection=False,
        )
        if not os.path.exists(tmp_path):
            print("ERROR glTF export produced no file; not writing")
            sys.exit(1)
        size = os.path.getsize(tmp_path)
        if size > SIZE_BUDGET_BYTES:
            print(f"ERROR GLB is {size / 1024:.0f} KB, over the {spec.GLB_MAX_MB} MB budget; not writing")
            sys.exit(1)
        os.makedirs(os.path.dirname(out), exist_ok=True)
        shutil.move(tmp_path, out)
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    print(f"exported {out} ({size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
