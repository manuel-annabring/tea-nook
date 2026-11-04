# Status

Updated by Claude as the last step of every slice (`WORKFLOW.md` section 2). Read this first in every session.

## Now

- **Current phase:** Phase 1 (Pipeline, blockout, steam on the model), branch `phase/1-blockout`. Slices 1.1 to 1.5 done.
- **State:** Phase 1 is done and reviewed by a fresh-context reviewer (no blockers; its three should-fix items are fixed). Review package: `REVIEW-phase-1.md`. Phase 1 is merged into `main` (5064592). Phase 2 (live Blender) is not started; it begins with the new slice 2.0 (composition). The reference images are in (six images in `reference/`, local and git-ignored; notes and look decisions in SPEC section 3, D-033).
- **Next action:** Manuel starts the Blender add-on with `tools/blender/nook.blend` open; then slice 2.0 with Manuel present.
- **Blockers:** none.

## Slices

Status values: `todo`, `in progress`, `done`, `blocked`. A slice is `done` only with evidence for every criterion.

| Slice | Name | Mode | Status | Commit | Notes |
|---|---|---|---|---|---|
| 0.1 | Setup | n/a | done | e719b7c | |
| 0.2 | Shader spike on a placeholder mug | n/a | done | 51a9be5 | Decisions D-001 to D-007 |
| 1.1 | Look config and verification harness | autonomous | done | f98f751 | D-013 to D-015. Evidence: `review/phase-1/slice-1.1-hero-panel0.jpg`. Pane renders only when awake, see CLAUDE.md Commands |
| 1.2 | Blender pipeline scripts | autonomous | done | 8c25206 | D-016 to D-019. Check, export and preview verified on the factory scene (fails as intended) and on a synthetic compliant scene (passes, exports). `gen-model.mjs` verified on a throwaway GLB in a temp root (all patches matched, output typechecks and lints). Not verified: the real `nook.blend` (does not exist yet, slice 1.3) |
| 1.3 | Scripted blockout | autonomous | done | f562005 | D-020 to D-023. Real numbers: GLB 49 KB (limit 3 MB), 724 triangles (cap 100k, target 30k), 13 materials (max 14), 13 GLB nodes; `Kettle` exports as a 2-mesh group, `Room` as 7 child meshes (about 10 draw calls for the whole model). Contract check passes on `nook.blend` and on a fresh temp build; GLB base colours equal `PALETTE` (13 of 13); `gen:model` twice gives an identical file. Evidence: `review/phase-1/blockout-{front,side,top,iso}.png`. Not verified: the GLB loading in the app (slice 1.4) |
| 1.4 | Scene: model, lights, camera | autonomous | done | e860004 | D-024 to D-027. Hero view fits (scene bbox x 155..1021, y 83..702 of 1280x720; `Orbit_Target` at 640,360). Limits verified by drags and synthetic wheel events: azimuth +-35, polar 55/80, distance 0.8/1.6. Pan: `enablePan` false, synthetic right-drag left the target unchanged (the tool has no real right-drag). 14 draw calls, 726 triangles. Runtime colours equal `PALETTE` (13 of 13), `Mat_Glass` opacity 0.35 transparent. Evidence: `review/phase-1/scene-{hero,front,side}.jpg`. Console: only the THREE.Clock warning (a pointer-capture error appeared only from my synthetic pointer events). Steam, `PointerProbe` and `DevSteam` are no longer mounted (slice 1.5) |
| 1.5 | Steam on the model | autonomous | done | ef31941 | D-028 to D-031. Both steams on the markers (mesh base equals marker world position exactly: tea 0, 0.09, 0.07; kettle 0.055, 0.15, -0.11). Tea uDensity 0.79 / uHeight 0.23, kettle 1.106 / 0.345. 16 draw calls, 3798 triangles. Pointer (synthetic pointer events on the canvas): uPointerBlend 0.9998 tea, 0.9999 kettle on, about 0 after leave; steam visibly pushed in the on images. Evidence: `review/phase-1/steam-{hero,front,side}.jpg`, `steam-pointer-{tea,kettle}-{on,off}.jpg` (2560 x 1440). Kettle steam runs past the top of the hero frame (height 0.345 m); looks fine but is a taste call for review |
| 2.0 | Composition: what the nook looks like | collaborative | todo | | Added 2026-11-04 (D-032). Reference images are in (D-033, SPEC section 3) |
| 2.1 | Mug and tea surface | autonomous | done | see git log | D-036, D-037. Mug 540 triangles, tea disc 18, whole contract-checked model 1210 triangles; GLB 76 KB (limit 3 MB), 13 materials, 16 draw calls, 4284 triangles in the app. `Steam_Tea` local (0, 0, 0.09) = rim centre, error 0 mm (limit 5 mm); steam in the hero shot starts at the rim. `02_mug.py` re-run on a temp copy of the pre-2.1 file passed the contract check (also run twice: unchanged result). Evidence: `review/phase-2/mug-{front,side,top,iso,hero}`. Weak points: the belly crease at z 0.04 reads as a hard seam in flat shading, the handle ring is somewhat thin next to reference 01, and at hero distance the mug is small so most detail is lost. Console: only the THREE.Clock warning |
| 2.2 | Kettle | autonomous | todo | | |
| 2.3 | Room details | autonomous | todo | | |
| 2.4 | AO bake pipeline | autonomous | todo | | Contract amendment (`UV_AO`) pre-approved |
| 2.5 | Lighting, shadows decision, camera tuning | autonomous | todo | | |
| 3.1 | Click to cycle tea | autonomous | todo | | |
| 3.2 | Overlay: title, hint, tea name, loader | autonomous | todo | | |
| 3.3 | Performance and budget check | autonomous | todo | | |
| 3.4 | Deploy workflow and README | autonomous | todo | | |
| 4.1 to 4.3 | Extras: light (outline) | autonomous | todo | | Refine after phase 3 |
| 5.1 to 5.3 | Extras: audio, mobile, final (outline) | autonomous | todo | | Refine after phase 4 |

## Verified baseline (2026-11-04, `phase/1-blockout`)

`npm run typecheck`, `lint`, `test` (7 files) and `build` pass; contract check on `nook.blend` passes (724 triangles). Dev server at `http://localhost:5173/tea-nook/` shows the blockout with both steams in the built-in browser pane; console shows only the known `THREE.Clock` warning.

## Gotchas

- The site is served under `/tea-nook/` (also in dev). `http://localhost:5173/` alone is not the app.
- The built-in browser pane defaults to 800 x 600. Use `resize_window` to 1280 x 720 for screenshots. A screenshot taken right after navigation can show only the background: wait for the ready flag (slice 1.1).
- The browser pane renders pages only while awake; the `data-nook-ready` flag may stay unset until a screenshot or other pane action. Poll again, then screenshot.
- The Leva dev panel covers the right third of the view; hide it with `?panel=0` (slice 1.1).
- `.claude/` is git-ignored, so permission settings and `launch.json` are local only.
- There is no git remote. Do not push.
- Typewriter's Blender tooling to adapt lives in `~/Projects/typewriter/tools/` (outside this repo, read only).
- The Blender add-on server must be started by Manuel for phase 2 only. Phases 1, 3, 4 and 5 use headless `Blender -b`.
- Plan is Pro (5-hour window, weekly limit, extra usage off). Check `get_usage` before each slice.

## Notes (ideas and out-of-scope findings, not work)

- Phase 3 hints from the reviewer: `applyLook` writes uniforms directly, so for damped tea changes keep target values in the store and damp inside `tickSteam`; damp the `Mat_Tea` colour on the cached material by name; give steam meshes `raycast={() => null}` before adding the Mug click handler; `Mug` handler needs `stopPropagation()` and cursor reset.
- `PointerProbe` caches marker lookups on first move and never invalidates them: after a dev hot reload that remounts the model, reload the page if the pointer push stops. `src/index.css` hard-codes the background `#e9dfcb`, duplicating `BACKGROUND_COLOR` in look.ts. `nook.blend` is tracked uncompressed (about 850 KB); phase 2 saves grow history.
- `01_blockout.py` now refuses to overwrite an existing file unless `--force` is given.

- Blockout build command: `Blender -b --factory-startup --python tools/blender/steps/01_blockout.py -- [out.blend]` (default `tools/blender/nook.blend`). Not yet listed in CLAUDE.md Commands. Re-saving over an existing `nook.blend` leaves a git-ignored `nook.blend1`; delete it.
- The exported `Room` is a group of 7 meshes (one per material, `Room_1` to `Room_7`), which the contract rule allows. For 1.4: the GLB's glTF Y/Z are swapped relative to Blender, and `Mat_Glass` carries alpha 0.35 (D-021).

- `tools/gen-model.mjs` honors an optional `GEN_MODEL_ROOT` env var (another project root with `public/models/nook.glb` and `src/nook/`), only for testing the script without a GLB in the repo. Not documented in CLAUDE.md.
- `contract_check.py` does not yet check Window_Sky size/offset versus Window_Glass or the marker sanity of `Rays_*`, `Dust_*`, `Orbit_Target` (SPEC section 5 only requires them to exist as Empties). Could be added once the blockout shows what is useful.

- Slice 1.4: lights and light intensities (sun 2.4, fill 1.6) and camera are first-pass values; slice 2.5 tunes them. No shadows yet. Dev hooks gained `getControls`, `materialColors`, `materialAlpha`, `projectCorners`, `snapshot` (JPEG data URL; used with a throwaway local receiver to save review screenshots).

- Pointer swirl (tangential push around the cursor): idea from slice 0.2, not built.
- CLAUDE.md "Planned pins" paragraph still says "nothing installed yet" and "Slice 0 installs exactly these". It is stale; update it when `package.json` changes next.
- `WORKFLOW.md` is at the repo root, not in `docs/`.
- Build warns about a chunk over 500 kB (three and drei). Code splitting is a possible phase 3 or 5 chore, not a requirement.

- Slice 2.1, what I did in Blender and why:
  - Mug body: I rebuilt the mesh data of the existing `Mug` object in place with `bmesh` (one revolved profile for outer wall, rounded lip, inner wall and floor). Replacing mesh data and leaving the object alone is what keeps its name, parent links, applied transforms and origin, so the contract holds.
  - Handle: swept a small 8-sided ring along a half ellipse (a D loop) and joined it to the body mesh; its ends sit inside the wall so it reads as one piece. Normals are recalculated so they point outwards and faces are flat shaded, like the blockout.
  - Tea and marker: `TeaSurface` is a 20-gon disc built at local z 0 (origin at its centre) and lifted by moving only the object, 8 mm under the rim. `Steam_Tea` is an Empty, so only its position matters; it now sits at the opening centre at rim height.
