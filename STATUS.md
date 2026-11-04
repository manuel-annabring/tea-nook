# Status

Updated by Claude as the last step of every slice (`WORKFLOW.md` section 2). Read this first in every session.

## Now

- **Current phase:** none started. Phase 1 (Pipeline, blockout, steam on the model) is next, branch `phase/1-blockout`.
- **State:** Workflow files are approved and committed on `main`. Manuel answered the open questions (all as recommended: D-010 to D-012). Phase 1 starts with Manuel's kickoff prompt (`WORKFLOW.md` section 13).
- **Next action:** Manuel sends the kickoff prompt, ideally right after a usage-window reset. First slice: 1.1 (also the dry run for subagents with browser tools).
- **Blockers:** none.

## Slices

Status values: `todo`, `in progress`, `done`, `blocked`. A slice is `done` only with evidence for every criterion.

| Slice | Name | Mode | Status | Commit | Notes |
|---|---|---|---|---|---|
| 0.1 | Setup | n/a | done | e719b7c | |
| 0.2 | Shader spike on a placeholder mug | n/a | done | 51a9be5 | Decisions D-001 to D-007 |
| 1.1 | Look config and verification harness | autonomous | todo | | |
| 1.2 | Blender pipeline scripts | autonomous | todo | | |
| 1.3 | Scripted blockout | autonomous | todo | | |
| 1.4 | Scene: model, lights, camera | autonomous | todo | | |
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
- The Leva dev panel covers the right third of the view; hide it with `?panel=0` (slice 1.1).
- `.claude/` is git-ignored, so permission settings and `launch.json` are local only.
- There is no git remote. Do not push.
- Typewriter's Blender tooling to adapt lives in `~/Projects/typewriter/tools/` (outside this repo, read only).
- The Blender add-on server must be started by Manuel for phase 2 only. Phases 1, 3, 4 and 5 use headless `Blender -b`.
- Plan is Pro (5-hour window, weekly limit, extra usage off). Check `get_usage` before each slice.

## Notes (ideas and out-of-scope findings, not work)

- Pointer swirl (tangential push around the cursor): idea from slice 0.2, not built.
- CLAUDE.md "Planned pins" paragraph still says "nothing installed yet" and "Slice 0 installs exactly these". It is stale; update it when `package.json` changes next.
- `WORKFLOW.md` is at the repo root, not in `docs/`.
- Build warns about a chunk over 500 kB (three and drei). Code splitting is a possible phase 3 or 5 chore, not a requirement.
