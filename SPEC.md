# Tea Nook: Stylized 3D Tea Nook Diorama (SPEC)

Status: Draft v1, 2026-10-27
Owner: Manuel

## 1. Goal

A cozy, stylized low-poly 3D diorama of a small kitchen tea nook (a tabletop corner): a counter, two walls, a window, a tea mug, a kettle and a few small props. The star is the custom-shader steam rising from the mug and the kettle spout.

Purpose:
- Portfolio piece for 3D web / creative developer roles.
- Practice for custom shaders in plain three.js (uniforms, noise, time-based animation), built on the coffee-steam lesson from Three.js Journey.
- Third project in the spec-first, agent-driven workflow ("vibe coding") used for Typewriter, with a live Blender MCP session for the model.

Look: stylized low-poly, soft flat colors, baked-looking ambient occlusion (AO). No realistic PBR, no toon outlines.

Performance target: 60 fps on a typical laptop, desktop first.

## 2. Tech stack

| Area | Choice |
|---|---|
| Rendering | three.js, @react-three/fiber (r3f), @react-three/drei |
| App | Vite, React, TypeScript (strict) |
| State | Zustand, only for real shared state (selected tea, time of day, mute) |
| Model | Blender, exported as GLB, turned into components with gltfjsx |
| Hosting | GitHub Pages (Vite `base` = `/tea-nook/`, deploy workflow) |

Exact pinned versions live in `CLAUDE.md`. The r3f major must match the React major (r3f 9 with React 19).

### Shader approach (to be confirmed by the spike in slice 1)

Three ways to put a custom shader on a mesh:

- **`ShaderMaterial`**: you write the vertex and fragment shader yourself; three.js only adds a few built-in uniforms. Best for effects that are not lit like a normal surface.
- **`onBeforeCompile` on a standard material**: you patch GLSL snippets into three's built-in lit material. Best when the effect should keep three's lighting, shadows and fog.
- **drei `shaderMaterial`**: a helper that wraps `ShaderMaterial` into a React-friendly class with typed uniform props. It is a convenience layer, not a different technique.

Recommendation: plain `ShaderMaterial` for steam. Steam is unlit, transparent, noise-driven and needs full control of vertex displacement (twist) and alpha, so there is nothing to gain from three's lighting code. The drei wrapper is optional sugar; the spike decides whether it is worth the extra dependency surface (it is already installed with drei). `onBeforeCompile` stays on the table only for the window light rays or a Phase 2 effect on a lit surface. The same material is used for tea steam and kettle steam with different uniform values.

> **AMENDMENT 2026-10-27 (slice 1 spike): `ShaderMaterial` confirmed.** Plain `ShaderMaterial`, no drei `shaderMaterial` (the spike needed no typed-props sugar: uniforms are plain objects on `material.userData.uniforms`, mutated by helper functions in `src/nook/steamMaterial.ts`). `onBeforeCompile` stays reserved for lit surfaces. Material flags: `transparent`, `depthWrite: false`, normal blending (additive blows out on the cream background), `DoubleSide` (the twist can turn the plane's back to the camera). New dev dependency, approved by Manuel: `leva` 0.10.1 (dev panel only, loaded lazily under `import.meta.env.DEV`; verified absent from the production bundle).

## 3. Visual reference

`reference/` holds a mood board of cozy low-poly kitchen dioramas. **Status: images not yet provided.** Manuel adds 3 to 6 images and a line on what to take from each; this section is then filled in.

Working palette until the references are in (flat colors, sampled again from the references later):

| Part | Color | Material |
|---|---|---|
| Wall | cream `#F2E6D0` | `Mat_Wall` |
| Counter | warm wood `#C98F5B` | `Mat_Wood` |
| Mug | terracotta `#D9694A` | `Mat_Mug` |
| Kettle | sage `#8FB8A0` | `Mat_Kettle` |
| Plant leaves | green `#6E9A5B` | `Mat_Leaf` |
| Window frame | off-white `#F7F3EA` | `Mat_Frame` |

Light mood (live lights, animated between the two presets in Phase 2):

| | Sun (directional) | Fill (hemisphere sky) | Feel |
|---|---|---|---|
| Morning | `#FFF1D6`, high, from the window | `#BFD8F0` | bright, fresh, cool shadows |
| Evening | `#FF9A57`, low, from the window | `#3C4E7A` | amber light, deep blue shadows, steam glows |

What NOT to trust in references: proportions of real kitchens (we exaggerate the props for readability) and any realistic materials.

## 4. Scope

### Phase 1: Core (must work before anything else)

1. **Diorama model**: counter, two walls (back and left), window in the left wall, and 5 props (section 5). Contract-compliant GLB.
2. **Tea steam** shader on the mug, driven from the `Steam_Tea` marker.
3. **Kettle steam**: the same shader, stronger uniforms, driven from the `Steam_Kettle` marker. (Moved up from Phase 2: it proves the shader is reusable and costs almost no new code.)
4. **Pointer-reactive steam**: the pointer position, projected into the scene, is a uniform; steam swirls away from it. (Moved up from Phase 2: it is one uniform and it is what makes the steam feel alive.)
5. **Click the mug to cycle tea types** (4 teas): steam color, density and speed change, tea surface color changes, with damped transitions.
6. **Orbit camera** with limited azimuth, polar angle and distance, no panning.
7. **Scene basics**: live lights in the morning preset, baked-looking AO, loader, title, hint text.
8. **Release**: deployed on GitHub Pages.

### Phase 2: Extras (built after Phase 1 works, one slice each)

- **Window light rays**: soft, noisy, additive planes from the window to the counter.
- **Dust motes**: floating `Points` in the light, own shader.
- **Time-of-day toggle** (morning / evening): light colors, sky card, rays, steam react.
- **Ambient audio**: kitchen / kettle loop, starts only after the first user interaction, mute button.
- **Mobile support**: touch-friendly controls, portrait framing, reduced quality tier. Desktop comes first.

### Out of scope

- Realistic PBR, toon outlines, post-processing (bloom, depth of field) unless the frame budget clearly allows it later.
- Physics, real fluid simulation, characters.
- Accounts, backend, analytics, localization.
- Runtime network assets (CDN HDRIs, remote fonts): everything is bundled so Pages stays self-contained.

### Phase split rationale

The first outline put kettle steam and pointer-reactive steam in Phase 2. They move to Phase 1 because they reuse the same shader and make Phase 1 a complete, shareable piece. The Phase 1 model already contains every prop, the window and all markers (including the ones only Phase 2 uses: `Rays_*`, `Dust_*`), so Phase 2 never changes the model contract. Deployment is also pulled forward (slice 6) so the Pages `base` path is proven before Phase 2 work starts.

## 5. Model contract (Blender to code)

The code finds and animates parts by name, so the names and rules below are fixed. Sizes below are proposals; the blockout (slice 2) fixes the final numbers and they are amended here with a dated note.

### Coordinate frame

Blender is Z up, the exporter maps it to glTF +Y up. World origin is the center of the counter top surface. Front (the camera side) is Blender -Y, the back wall is at +Y, the left wall (with the window) is at -X. Units are meters. Proposed footprint: counter 0.60 (x) by 0.45 (y), walls 0.30 high, mug about 0.09 high, kettle about 0.20 high (props are exaggerated for readability).

### Objects

| Object | Type | Parent | Notes |
|---|---|---|---|
| `Room` | mesh | none | Merged static scenery: counter, back wall, left wall, window frame, plant with pot, tea tin, book stack. Origin at world origin. One mesh, shares the AO map |
| `Mug` | mesh | none | Click target and tea-change anchor. Origin at the center of its base, resting on the counter |
| `TeaSurface` | mesh | `Mug` | Disc of tea inside the mug, a few mm below the rim. Own material so its color changes per tea. Origin at its center |
| `Steam_Tea` | Empty | `Mug` | Center of the mug opening at rim height. Steam emits from here. Position only |
| `Kettle` | mesh | none | Origin at the center of its base, resting on the counter |
| `Steam_Kettle` | Empty | `Kettle` | Center of the spout opening. Position only |
| `Window_Glass` | mesh | none | Single quad in the window opening, faces into the room. Origin at its center. Code reads its bounds for the light rays |
| `Window_Sky` | mesh | none | Quad a few cm outside `Window_Glass`, same size or larger. The "outside" color card; its color changes with time of day (Phase 2) |
| `Rays_Origin` | Empty | none | Center of the window opening, where light rays start. Position only |
| `Rays_Target` | Empty | none | Point on the counter where the light patch lands. The ray direction is `Rays_Target - Rays_Origin`. Position only |
| `Dust_Min`, `Dust_Max` | Empty | none | Opposite corners of the box in which dust motes float. Position only |
| `Orbit_Target` | Empty | none | Point the orbit camera looks at (visual center of the diorama). Position only |

### Separate objects versus merged

- **Must stay separate** (animated, clickable or an effect anchor): `Mug`, `TeaSurface`, `Kettle`, `Window_Glass`, `Window_Sky`, and every marker Empty.
- **Merged into `Room`** (static, no interaction): counter, both walls, window frame, plant, pot, tin, books. They share one AO map. If a prop later needs to animate or be clickable (for example the plant swaying), it is split out of `Room` and added here by amendment.

### Rules

- Export glTF binary (`.glb`), +Y up, file `public/models/nook.glb`.
- Apply scale and rotation on all objects. Meters, unit scale 1.0.
- Marker Empties have identity rotation and scale 1; only their position carries meaning. Code never hard-codes a position that a marker provides.
- Origins: `Mug` and `Kettle` at the center of their base; `Room` at the world origin; quads and discs at their center.
- No Blender duplicate suffixes (`.001`) in any name.
- Multi-material meshes export as a group named like the object with child meshes (`Kettle_1`, `Kettle_2`). Code finds them with `getObjectByName('Kettle')`, never by child names.
- Material names are fixed (final list confirmed after the blockout):
  `Mat_Wall`, `Mat_Wood`, `Mat_Frame`, `Mat_Leaf`, `Mat_Pot`, `Mat_Tin`, `Mat_Book`, `Mat_Mug`, `Mat_Tea`, `Mat_Kettle`, `Mat_KettleDetail`, `Mat_Glass`, `Mat_Sky`.
- AO: `Room` gets a second UV layer `UV_AO` and a baked AO texture in slice 5 (amendment then). Until then only the first UV layer `UVMap` is required.

### Budgets (proposed, confirm after the first export)

| Item | Budget |
|---|---|
| Triangles (whole GLB) | target 30k, hard cap 100k |
| GLB file size | under 3 MB |
| Textures | AO map 1024 x 1024 (2048 max); no other textures unless justified in the spec |
| Materials | at most 14 |
| Draw calls in the scene (incl. steam, dust) | under 40 |

### Contract check

`tools/blender/contract_check.py` (adapted from Typewriter's) runs headless before every export and refuses to export on errors. It checks: required names present, no duplicate suffixes, unit scale 1.0, transforms applied, parent links (`TeaSurface`, `Steam_Tea` under `Mug`; `Steam_Kettle` under `Kettle`), origins (`Mug` and `Kettle` at base center within 1 mm), markers exist and are Empties, markers sit where expected (`Steam_Tea` near the mug rim, `Steam_Kettle` near the kettle's spout side), only contract materials are used and all are used, and the triangle budget. `tools/blender/contract_spec.py` holds the contract as data; `src/nook/contract.ts` is its TypeScript twin and the two must stay in sync.

## 6. Architecture notes

- **Scene**: `Canvas` with `dpr` clamped to `[1, 2]`, live lights (one directional, one hemisphere), drei `OrbitControls` (damping on, pan off, azimuth, polar and distance limits, target from `Orbit_Target`). Camera and limits are proposed in slice 2 and tuned in slice 5.
- **Model**: `NookModel.generated.tsx` is generated by `npm run gen:model` and never edited. `Nook.tsx` wraps it and holds behavior: finds parts by contract names, attaches steam at the markers, handles clicks.
- **Steam**: one `ShaderMaterial` (see section 2). Tea steam and kettle steam are two instances of the same material with different uniform values.
  > **AMENDMENT 2026-10-27 (slice 1 spike), decisions:**
  > - **Geometry: camera-facing billboard around Y.** One plane, 1 unit tall, 16 x 48 segments (the width segments matter: the pointer push and twist move vertices, so a 1-segment plane only stretches). The vertex shader scales y to `uHeight` and turns the plane to face the camera. Compared with an open tube (the twist rotates round rings about their own axis, so it is nearly invisible) and crossed planes (thin when seen edge-on); the billboard keeps the twist visible and is one draw call. **Known limit:** looking straight down it collapses into a smear, so the polar minimum chosen in slice 2 must stay well away from vertical.
  > - **Noise: tileable Perlin texture generated at startup,** not procedural GLSL and not a shipped PNG. `src/lib/perlin.ts` (unit-tested) fills a 128 x 128 `DataTexture`; R drives the twist and wind, G drives the alpha mask. One texture fetch per fragment, no asset to load.
  > - **Uniforms:** `uTime`, `uPhase`, `uColor`, `uDensity`, `uHeight`, `uNoise`, `uNoiseScale`, `uCut`, `uTwistMax`, `uTwistPower`, `uFadeIn`, `uFadeOut`, `uWind`, `uFacing`, `uPointer` (world position), `uPointerRadius`, `uPointerStrength`, `uPointerPower`, `uPointerAnchor`, `uPointerBlend`. **Deviation: there is no `uSpeed` uniform.** Speed is a CPU-side value; the CPU accumulates `uPhase += delta * speed`, so damping speed between teas never makes the pattern jump (with `uTime * uSpeed` it would).
  > - **Maths:** twist angle, height fade and pointer falloff live in `src/lib/steamMath.ts` (unit-tested) with GLSL twins in `src/shaders/steam.common.glsl`. Tuned defaults are in `STEAM_DEFAULTS` and `src/nook/steamDefaults.ts`.
- **Tea data**: `src/lib/teas.ts` is a plain typed list of 4 teas (proposed: Earl Grey, Green, Chamomile, Hibiscus) with steam color, density, speed and liquid color. Values are tuned in the spike. A click advances `teaIndex` in the store; components damp their uniforms toward the active tea in `useFrame`.
- **Pointer to steam**: a ray-plane intersection (not an invisible mesh) writes world-space `pointerX, pointerY, pointerZ` and `pointerActive` into the store; `useFrame` reads them with `getState()` and damps them into `uPointer` and `uPointerBlend`. No component subscribes to those fields, so no React re-render per mouse move.
  > **AMENDMENT 2026-10-27 (slice 1 spike): decided.** `src/input/PointerProbe.tsx` listens on the canvas element (so it never blocks mesh pointer events, which slice 4 needs for the mug click), intersects the pointer ray with a horizontal plane at steam height, and writes the hit to the Zustand store. The push is applied in the vertex shader on the horizontal plane, scaled by height (`uPointerAnchor` keeps the base on the mug).
- **Time of day (Phase 2)**: `timeOfDay` in the store; `src/lib/timeOfDay.ts` holds the two presets (light colors, intensities, sky color, ray strength, steam tint). A `useFrame` damps the live values toward the active preset.
- **Audio (Phase 2)**: created inside the first user-interaction handler; `muted` in the store; mute button in the overlay.
- **UI overlay** (`src/ui`, plain React DOM next to the `Canvas`; `pointer-events: none` except on buttons):
  - Title "Tea Nook", top-left.
  - Hint, bottom-center: "Drag to orbit · Click the mug to change tea".
  - Tea name, bottom-center, fades in after each click.
  - Loader: full screen, progress bar from drei `useProgress`.
  - Phase 2: time-of-day toggle top-right, mute button bottom-right.
- **Hosting**: `vite.config.ts` sets `base: '/tea-nook/'`. All public asset URLs are built from `import.meta.env.BASE_URL`, never a leading `/`. Deploy workflow at `.github/workflows/deploy.yml` (build, upload Pages artifact, deploy); action versions are checked and pinned when written.
- **Quality tiers (Phase 2, mobile)**: a single `quality` flag drives DPR cap, steam plane count and dust count. Not built in Phase 1.

## 7. Build order

Each slice ends with something visible, is tested, and is committed before the next. Each slice has a recommended model and effort (Opus or Sonnet high for planning and architecture, Sonnet medium for routine work, Sonnet high then Opus for tricky bugs, low for chores).

0. **Setup.** Vite, React, TS strict, r3f, drei, ESLint, vitest, `base` path, .gitignore, `git init`. SPEC.md and CLAUDE.md committed. Visible: a blank canvas with a spinning cube. *Sonnet medium.*
1. **Shader spike** on a placeholder (cylinder or crossed planes above a placeholder mug cylinder). Get the steam looking right in isolation with all uniforms exposed (debug sliders via a plain dev-only panel or `leva` only if approved). Decide: `ShaderMaterial` vs `onBeforeCompile` vs drei `shaderMaterial`, steam geometry, noise source. Include a fake pointer uniform driven by the mouse. Record the decisions in section 6. *Opus or Sonnet high.*
2. **Blockout in Blender via MCP**, contract-compliant. Adapt `contract_spec.py`, `contract_check.py`, `export_glb.py`, `render_preview.py` and `gen-model.mjs` from Typewriter. Export a rough GLB, generate the component, load it with light and orbit controls in r3f. Fix final dimensions and camera limits and amend section 5. Visible: the boxy diorama, orbitable. *Sonnet medium for the Blender journal, Opus or Sonnet high for the contract and scripts.*
3. **Effect on the real model.** Tea steam and kettle steam attached at `Steam_Tea` and `Steam_Kettle`. Visible: both steams rising from the model. *Sonnet medium.*
4. **Interaction and UI overlay.** Click-to-cycle tea with damped transitions, pointer-reactive steam, pointer cursor, loader, title, hints. Visible: the complete interaction loop. *Sonnet medium.*
5. **Model detail pass.** Real shapes, materials, AO bake (`UV_AO`), environment lighting tuning, shadows decision, camera limits tuning. Amend section 5. *Sonnet medium for modeling, Sonnet high for the bake pipeline.*
6. **Phase 1 release.** Deploy workflow, `base` verified on Pages, performance check against budgets, loading state check, short README write-up. Visible: the live URL. *Sonnet medium; low for the workflow chore.*
7. **Phase 2 extras, one slice each, in this order:**
   - 7a Window light rays.
   - 7b Dust motes.
   - 7c Time-of-day toggle (lights, sky card, rays, steam).
   - 7d Ambient audio and mute.
   - 7e Mobile (touch, portrait framing, quality tier).
8. **Final release.** Full performance pass, write-up of the shader work for the portfolio, redeploy. *Sonnet medium.*

Deviation from the original outline: the original single "Release" step is split into slice 6 (Phase 1 release) and slice 8 (final release) because Phase 1 includes deployment.

## 8. Definition of done (Phase 1)

- The live GitHub Pages URL loads with no console errors or warnings (known noise from dependencies is listed in `CLAUDE.md`).
- Contract check passes; GLB under 3 MB, under 100k triangles (target 30k), at most 14 materials.
- Tea steam and kettle steam rise from their markers and are visibly the same shader with different uniforms.
- Clicking the mug cycles 4 teas; steam color, density, speed and tea surface color change smoothly.
- The pointer visibly pushes the steam away.
- The orbit camera is limited so the diorama always looks good; no panning.
- Loader, title and hint text are in place; the page works at 1280 x 720 and larger.
- About 60 fps on the owner's laptop, plus an acceptable result with Chrome DevTools 4x CPU throttling as a proxy for weaker machines.
- `npm run typecheck`, `lint`, `test` and `build` pass.

## 9. How the agent verifies its work

1. `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass.
2. Open the dev server in the browser, take a screenshot, read the console. No errors or new warnings.
3. Test the slice by hand (orbit, hover, click, resize).
4. Shader slices: check from at least 3 camera angles and with the pointer inside and outside the steam.
5. Model slices: headless contract check passes, headless preview renders (front, side, top) are looked at, the GLB loads in the app, triangle count and file size are compared with the budgets.
6. Performance slices: dev-only stats panel for fps, draw calls and triangle counts; compare with section 5 budgets.
7. Summarize in 1 to 2 sentences, including anything not verified.

## 10. Open questions

- **Reference images** are not in `reference/` yet (section 3 is a stub).
- **AO bake**: single AO texture on `Room` only, or also for `Mug` and `Kettle` (or vertex colors for those)? Decided in slice 5.
- **Shadows**: baked-only contact shading, or one live shadow-casting directional light with a small map? Decided in slice 5 after measuring cost.
- ~~**Steam geometry and noise source**~~ Resolved 2026-10-27 (slice 1): camera-facing billboard around Y, tileable Perlin texture generated at startup (see section 6).
- ~~**Dev tweak panel**~~ Resolved 2026-10-27 (slice 1): `leva` 0.10.1, approved by Manuel, dev only.
- **Pointer swirl** (idea from slice 1, not built): add a tangential component to the pointer push so the steam curls around the cursor instead of only moving away. Decide in slice 4 once it is on the real model.
- **Repo name**: assumed `tea-nook` (Pages URL `/tea-nook/`). Confirm before slice 6, or change `base` if different.
- **Typography**: system font stack for Phase 1, or one bundled web font? Proposed: system stack in Phase 1.
- **Audio source and license** (Phase 2): TBD; must be free to use and bundled.
- **Camera defaults and limits**: proposed in slice 2 (3/4 view from front-right, azimuth about +-35 degrees, polar about 55 to 80 degrees, distance range tuned on the model).
