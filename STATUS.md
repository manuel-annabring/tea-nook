# Status

Updated by Claude as the last step of every slice (`WORKFLOW.md` section 2). Read this first in every session.

## Now

- **Current phase:** Phase 1 (Pipeline, blockout, steam on the model), branch `phase/1-blockout`. Slices 1.1 to 1.4 done.
- **State:** Workflow files are approved and committed on `main`. Manuel answered the open questions (all as recommended: D-010 to D-012). Phase 1 starts with Manuel's kickoff prompt (`WORKFLOW.md` section 13).
- **Next action:** Manuel sends the kickoff prompt, ideally right after a usage-window reset. Next slice: 1.5.
- **Blockers:** none.

## Slices

Status values: `todo`, `in progress`, `done`, `blocked`. A slice is `done` only with evidence for every criterion.

| Slice | Name | Mode | Status | Commit | Notes |
|---|---|---|---|---|---|
| 0.1 | Setup | n/a | done | e719b7c | |
| 0.2 | Shader spike on a placeholder mug | n/a | done | 51a9be5 | Decisions D-001 to D-007 |
| 1.1 | Look config and verification harness | autonomous | done | f98f751 | D-013 to D-015. Evidence: `review/phase-1/slice-1.1-hero-panel0.jpg`. Pane renders only when awake, see CLAUDE.md Commands |
| 1.2 | Blender pipeline scripts | autonomous | done | (this commit) | D-016 to D-019. Check, export and preview verified on the factory scene (fails as intended) and on a synthetic compliant scene (passes, exports). `gen-model.mjs` verified on a throwaway GLB in a temp root (all patches matched, output typechecks and lints). Not verified: the real `nook.blend` (does not exist yet, slice 1.3) |
| 1.3 | Scripted blockout | autonomous | done | (this commit) | D-020 to D-023. Real numbers: GLB 49 KB (limit 3 MB), 724 triangles (cap 100k, target 30k), 13 materials (max 14), 13 GLB nodes; `Kettle` exports as a 2-mesh group, `Room` as 7 child meshes (about 10 draw calls for the whole model). Contract check passes on `nook.blend` and on a fresh temp build; GLB base colours equal `PALETTE` (13 of 13); `gen:model` twice gives an identical file. Evidence: `review/phase-1/blockout-{front,side,top,iso}.png`. Not verified: the GLB loading in the app (slice 1.4) |
| 1.4 | Scene: model, lights, camera | autonomous | done | (this commit) | D-024 to D-027. Hero view fits (scene bbox x 155..1021, y 83..702 of 1280x720; `Orbit_Target` at 640,360). Limits verified by drags and synthetic wheel events: azimuth +-35, polar 55/80, distance 0.8/1.6. Pan: `enablePan` false, synthetic right-drag left the target unchanged (the tool has no real right-drag). 14 draw calls, 726 triangles. Runtime colours equal `PALETTE` (13 of 13), `Mat_Glass` opacity 0.35 transparent. Evidence: `review/phase-1/scene-{hero,front,side}.jpg`. Console: only the THREE.Clock warning (a pointer-capture error appeared only from my synthetic pointer events). Steam, `PointerProbe` and `DevSteam` are no longer mounted (slice 1.5) |
| 1.5 | Steam on the model | autonomous | todo | | |
| 2.1 | Mug and tea surface | collaborative | todo | | |
| 2.2 | Kettle | collaborative | todo | | |
| 2.3 | Room details | collaborative | todo | | |
| 2.4 | AO bake pipeline | collaborative | todo | | Contract amendment (`UV_AO`) |
| 2.5 | Lighting, shadows decision, camera tuning | collaborative | todo | | |
| 3.1 | Click to cycle tea | autonomous | todo | | |
| 3.2 | Overlay: title, hint, tea name, loader | autonomous | todo | | |
| 3.3 | Performance and budget check | autonomous | todo | | |
| 3.4 | Deploy workflow and README | autonomous | todo | | |
| 4.1 to 4.3 | Extras: light (outline) | autonomous | todo | | Refine after phase 3 |
| 5.1 to 5.3 | Extras: audio, mobile, final (outline) | autonomous | todo | | Refine after phase 4 |

## Verified baseline (2026-11-04, on `main` at 51a9be5)

`npm run typecheck`, `lint`, `test` (4 files, 19 tests) and `build` pass. Dev server at `http://localhost:5173/tea-nook/` renders the placeholder mug with steam in the built-in browser pane; console shows only the known `THREE.Clock` warning.

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

- Blockout build command: `Blender -b --factory-startup --python tools/blender/steps/01_blockout.py -- [out.blend]` (default `tools/blender/nook.blend`). Not yet listed in CLAUDE.md Commands. Re-saving over an existing `nook.blend` leaves a git-ignored `nook.blend1`; delete it.
- The exported `Room` is a group of 7 meshes (one per material, `Room_1` to `Room_7`), which the contract rule allows. For 1.4: the GLB's glTF Y/Z are swapped relative to Blender, and `Mat_Glass` carries alpha 0.35 (D-021).

- `tools/gen-model.mjs` honors an optional `GEN_MODEL_ROOT` env var (another project root with `public/models/nook.glb` and `src/nook/`), only for testing the script without a GLB in the repo. Not documented in CLAUDE.md.
- `contract_check.py` does not yet check Window_Sky size/offset versus Window_Glass or the marker sanity of `Rays_*`, `Dust_*`, `Orbit_Target` (SPEC section 5 only requires them to exist as Empties). Could be added once the blockout shows what is useful.

- Slice 1.4: lights and light intensities (sun 2.4, fill 1.6) and camera are first-pass values; slice 2.5 tunes them. No shadows yet. Dev hooks gained `getControls`, `materialColors`, `materialAlpha`, `projectCorners`, `snapshot` (JPEG data URL; used with a throwaway local receiver to save review screenshots).

- Pointer swirl (tangential push around the cursor): idea from slice 0.2, not built.
- CLAUDE.md "Planned pins" paragraph still says "nothing installed yet" and "Slice 0 installs exactly these". It is stale; update it when `package.json` changes next.
- `WORKFLOW.md` is at the repo root, not in `docs/`.
- Build warns about a chunk over 500 kB (three and drei). Code splitting is a possible phase 3 or 5 chore, not a requirement.
