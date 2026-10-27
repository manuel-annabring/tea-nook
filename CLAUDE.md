# Tea Nook: CLAUDE.md

Cozy stylized low-poly 3D diorama of a kitchen tea nook for the web. The star is the custom-shader steam rising from the tea mug and the kettle. Portfolio piece for 3D web / creative developer roles.

`SPEC.md` is the source of truth for scope, the Blender-to-code model contract, and the build order. Read it before starting any task. If the code needs something the spec doesn't say, propose a change to the spec instead of silently deviating.

## How we work

- Follow the build order in SPEC.md section 7. One slice per session. Phase 1 before Phase 2.
- For anything touching more than about 3 files, propose a short plan first and wait for approval.
- Commit after every working slice with a clear message.
- Before committing, show the diff summary and `git status`, then wait for Manuel's OK. Then commit (push only when asked).
- For shape or geometry decisions (steam profile, swirl, camera limits, noise curves), first show an interactive 2D widget (`show_widget`) built from the same maths, let Manuel pick values, then implement step by step and pause after each step with a browser check.
- Manuel is learning Blender through this project. Claude makes the modeling edits through the MCP and explains each in 2 to 3 sentences (what, why, which Blender concept). Give a numbered walkthrough with keyboard shortcuts only when Manuel wants to do or tweak something himself. Keep it short: no coordinate tables or long value lists; exact numbers only where the contract needs them.
- Manuel is a senior React developer but new to three.js internals, r3f, shaders and Blender. Don't explain React basics. Do explain three.js, r3f, shader or Blender concepts in 2 to 3 sentences the first time they appear.
- Answer in English.
- Don't add features outside the current slice. Note ideas in your reply instead.
- Never change the model contract (SPEC.md section 5) on your own. Propose an amendment and wait.
- Don't add dependencies without asking.
- If you said you would ask before a deviation, ask. Flag any deviation prominently in the reply.

## Model and effort

Manuel chooses model and effort at the start of each session. You can't change them, but you can recommend. Default setup: Sonnet 5.5 at medium effort.

- When you propose a slice plan, add one line recommending model and effort for that slice.
- Planning and architecture (shader approach, store design, contract changes): Opus, or Sonnet at high effort.
- Routine implementation (UI overlay, glue code, model wrapper): Sonnet, medium.
- Tricky bugs (shader artifacts, transforms and pivots, program caching, GLB export issues): Sonnet at high effort first, Opus if still stuck.
- Chores (.gitignore, commit messages, workflow files, small renames): low effort.
- Review of a finished slice: Opus or high effort, in a fresh session.
- When something goes wrong, first check whether the prompt, SPEC.md or CLAUDE.md is unclear or wrong, and look at the real input (screenshot, console, scene state). Then suggest raising effort. Suggest a bigger model last. A bigger model doesn't fix a wrong input.
- If you fail twice at the same problem, stop and say so. Suggest the next step (clearer input, higher effort, or Opus) instead of trying more variations.
- Changing effort mid-session loses the prompt cache, so prefer deciding at session start.

## Stack

three, @react-three/fiber, @react-three/drei, React, TypeScript (strict), Vite, Zustand (only for real shared state). Model as GLB from Blender, components generated with gltfjsx.

Planned pins (checked against npm on 2026-10-27, nothing installed yet). Slice 0 installs exactly these; after that `package.json` is the source of truth and this line is updated:

- react and react-dom 19.3.1
- three 0.186.1, @types/three 0.186.0
- @react-three/fiber 9.8.2 (peer range: React `>=19 <19.4`), @react-three/drei 10.7.9
- zustand 5.0.16
- vite 8.3.5, @vitejs/plugin-react 6.1.2
- typescript 6.0.3 (see below), eslint 10.13.0, typescript-eslint 8.72.1
- vitest 5.0.5
- leva 0.10.1 (dev tweak panel only, approved in slice 1; loaded lazily under `import.meta.env.DEV`, not in the production bundle)
- gltfjsx 6.5.3 (one-off via npx, not a dependency)
- Node v26.7.0 (Vite needs ^20.19 or >=22.12)

Rules:

- TypeScript stays on 6.0.x. TypeScript 7.0.2 is the npm `latest`, but typescript-eslint 8.72.1 only supports `<6.1.0`. Don't move to 7 until typescript-eslint supports it.
- Pin exact versions (no `^`, no `~`).
- Before writing r3f, drei or three code, check the installed versions. Do not mix API patterns from other versions.
- The r3f major version must match the React major version.
- drei: stay on the stable 10.x line, not alpha prereleases.
- Don't upgrade packages unless asked.

## Commands

- `npm run dev`: dev server
- `npm run build`: `tsc -b && vite build`
- `npm run typecheck`: `tsc --noEmit` for `tsconfig.app.json` and `tsconfig.node.json`
- `npm run lint`: `eslint .`
- `npm test`: vitest unit tests (`src/**/*.test.ts`)
- `npm run preview`: serve the production build (uses the `/tea-nook/` base)
- `npm run gen:model`: regenerate `src/nook/NookModel.generated.tsx` from `public/models/nook.glb` (gltfjsx 6.5.3 via npx plus patches for React 19 and strict TS; adapted from Typewriter's `tools/gen-model.mjs`). Never edit the generated file by hand.

Blender (headless, `B=/Applications/Blender.app/Contents/MacOS/Blender`, currently Blender 5.2.0 LTS; scripts in `tools/blender/`):

- Contract check: `$B -b tools/blender/nook.blend --python tools/blender/contract_check.py`
- Export (runs the check first, refuses on errors): `$B -b tools/blender/nook.blend --python tools/blender/export_glb.py`
- Previews (Workbench PNGs, does not save the .blend): `$B -b tools/blender/nook.blend --python tools/blender/render_preview.py -- <output_dir>`
- `tools/blender/nook.blend` is the source of truth.
- After changing the model: contract check, export, then `npm run gen:model`.

Known noise (expected until r3f is updated): the build warns that the main chunk is over 500 kB (three and drei), and the browser console shows `THREE.Clock: This module has been deprecated`, which comes from r3f 9.8.2 itself. Slice 0 also added dev dependencies that SPEC and the pins above did not list: `@eslint/js`, `@types/react`, `@types/react-dom`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `globals` (same versions as Typewriter). npm blocks the optional `fsevents` install script; that is harmless.

## Folder structure

```
reference/          mood board images (not shipped)
public/models/      nook.glb
src/
  scene/            Canvas, lights, camera and orbit limits, environment
  nook/             Nook.tsx (wrapper, behavior), contract.ts (required node names),
                    NookModel.generated.tsx (generated, never hand-edit),
                    Steam, Mug, Kettle, Window (Phase 2 effects)
  shaders/          GLSL files (or modules) and their TS twins
  store/            Zustand store (tea index, pointer, time of day, mute)
  input/            pointer and click handling, dispatches store actions only
  lib/              pure helpers (teas data, time-of-day presets, noise maths), unit-testable
  ui/               HTML overlay (Loader, title, hint, tea name, buttons)
tools/blender/      headless Blender scripts, journal (steps/), nook.blend
tools/gen-model.mjs gltfjsx wrapper behind `npm run gen:model`
.github/workflows/  deploy.yml (GitHub Pages)
```

Note: `src/shaders/` is added to the folder list Manuel gave so GLSL has a home; change it if you prefer GLSL next to the component.

## Code rules

- TypeScript strict. No `any`.
- Shared state lives in the Zustand store (selected tea, time of day, mute, pointer). Components don't own shared state.
- Subscribe with selectors, never the whole store. For per-frame reads use `useStore.getState()`.
- Animate in `useFrame` using refs and damping (`THREE.MathUtils.damp`). No `setState` in `useFrame`.
- No allocations in `useFrame` or render: no `new Vector3`, `new Color` or materials there. Create once (module scope, `useMemo` or a ref).
- Dispose textures, geometries and materials we create ourselves on unmount.
- Find model parts by the contract names in SPEC.md section 5. If a name is missing, fail loudly in development (throw with the missing name). Never guess. Positions that a marker Empty provides are read from the marker, never hard-coded.
- gltfjsx output stays in its own generated file (use `--types`). Behavior goes in wrapper components so regenerating doesn't overwrite it.
- Public asset URLs are built from `import.meta.env.BASE_URL` (for example `${import.meta.env.BASE_URL}models/nook.glb`), never a leading `/`, because the site is served from `/tea-nook/`.
- Pointer events on interactive meshes call `stopPropagation()` and show a pointer cursor on hover (reset on leave and unmount).
- Audio starts only after the first user interaction.
- Pointer-to-steam: pointer position is written to the store as plain numbers; only `useFrame` reads it (via `getState()`). No component subscribes to it.
- No runtime network assets (CDN HDRIs, remote fonts). Everything is bundled.

## Shader rules

- Time is a uniform, updated in `useFrame` from the clock (`uTime.value += delta` or `state.clock.elapsedTime`). Never React state.
- Keep uniform objects stable across remounts and hot reloads: store them on `material.userData` and reuse them. Three caches compiled programs and only calls `onBeforeCompile` for new ones, so recreated uniform objects silently stop updating.
- If a shader is built with `onBeforeCompile`, make `customProgramCacheKey` include the injected GLSL (or a version string of it). Otherwise two materials with different patches share one program.
- Keep GLSL in its own file or module in `src/shaders/`. Anything that needs CPU-side maths (noise, falloff curves, swirl) gets a TypeScript twin in `src/lib/` that is unit-tested, so the widget, the test and the shader use the same maths.
- Steam material: transparent, `depthWrite: false`, no lighting. Set side and blending deliberately and note why. Tea steam and kettle steam are the same material class with different uniform values.
- Set uniform values by mutating `uniform.value` (copy into existing `Vector3` and `Color`), never by replacing uniform objects.

## Blender and model rules

- The model contract is SPEC.md section 5. Node names live in two places that must stay in sync: `tools/blender/contract_spec.py` and `src/nook/contract.ts`.
- Run the contract check (names, applied transforms, origins, parent links, markers, materials, budgets) before every export.
- Export glTF binary (`.glb`), +Y up. Blender is Z up, front at -Y.
- All edits, live or by hand, must keep object and material names, applied transforms, origins and parent links. Replace meshes, never delete contract objects.
- Multi-material objects export as a group with child meshes (`Kettle_1`, `Kettle_2`). Find them with `getObjectByName('Kettle')`, never by child names.

### Blender MCP workflow (live session)

- We work in one shared live Blender session through the official Blender Lab MCP server (Blender 5.1+). Manuel starts the add-on server and opens `tools/blender/nook.blend`. Claude edits the open scene through the MCP, looks at the result (`get_screenshot_of_area_as_image`, viewport renders, headless previews) and explains each step in 2 to 3 sentences.
- Inspect the scene before editing, never assume values. Manuel may tweak the scene at any time, so re-inspect before the next step.
- Safety: before each session and before each risky step, copy the saved file to `nook-pre-<slice>.blend1` (git-ignored). Save with `bpy.ops.wm.save_mainfile()` at checkpoints and tell Manuel. Never save over a state Manuel is in the middle of editing without asking.
- Journal: every live step that worked goes into `tools/blender/steps/NN_<part>.py` as a small re-runnable function with its parameters at the top. Don't re-run old steps against `nook.blend` without asking.
- Repeated parts (books, window panes, plant leaves) are generated by parametric scripts. Organic shapes (mug, kettle, plant) are modeled live with Manuel's taste deciding.
- Prefer `bpy.data` and `bmesh` over `bpy.ops`. Before any `bpy.ops` call, check the mode and set the active object and selection explicitly. `execute_blender_code` is the last resort when a dedicated MCP tool exists.
- Contract check, export and previews run headless (`Blender -b`), not through the live session.
- After each part: contract check, preview (front, side, top), show Manuel, commit only after his OK.
- Before describing or planning Blender work, inspect the saved `.blend` headlessly (extents, vertex count, modifiers, scale) instead of judging from a screenshot. Verify menu and shortcut names against the Blender 5.2 manual bundled with the MCP server (`/Users/manuelannabring/.venvs/blender-mcp/lib/python3.13/site-packages/blmcp/data/manual`).
- The MCP server runs arbitrary Python with no guards. Never open untrusted `.blend` files while it is connected.
- `.mcp.json` and `*.blend1` are git-ignored. A plain `*.blend` copy (for example `nook-body-ok.blend`) is not git-ignored and must never be committed.

## Verify before saying "done"

1. `npm run typecheck`, `npm run lint` and `npm run build` pass (and `npm test` once tests exist).
2. Look at the result in the browser (screenshot) and read the console. No errors or new warnings.
3. Test the slice's behavior by hand (orbit, hover, click).
4. For model changes: the contract check passes and the GLB loads in the app.
5. Summarize what changed in 1 to 2 sentences, including anything not verified.

## Lessons learned

(Add hard-won lessons here as they come up.)

- The `react-hooks` lint rules (React Compiler) reject mutating a value that came from `useMemo`, `useState` or a hook argument inside a component, including `material.uniforms.x.value = ...` in `useFrame` or an effect. Put uniform mutations in plain helper functions (`applyLook`, `tickSteam` in `src/nook/steamMaterial.ts`) and call them from the component.
- After editing a file with several Edit calls, Vite hot reload can log a stale `does not provide an export named ...` error from the half-edited state. Reload the page before treating it as real.
