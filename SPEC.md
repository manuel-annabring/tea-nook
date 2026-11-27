# Tea Nook: Stylized 3D Tea Nook Diorama (SPEC)

Status: Draft v2 (phase structure added 2026-11-04, pending approval)
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

`reference/` holds a local mood board of six images, chosen with Manuel on 2026-11-04 after two search rounds. They are third-party material: git-ignored and never committed (only `.gitkeep` is tracked). The files exist on Manuel's machine only; the sources below say where to find them again.

### Decisions from the reference rounds

- **Look:** clean flat shapes in soft colors with baked-looking AO. No hand-painted textures. Bright, friendly, tidy, minimalist, but with enough small details. Not dark, no game or fantasy look, no comic outlines, not cluttered (few plants).
- **Realism:** the near-photorealistic kids room (image 03) is a reference for the quality of the light only. Materials stay stylized and flat, as in section 1 (no realistic PBR).
- **Camera:** perspective "dollhouse" view: a cut-away corner seen from the front through a perspective camera with limited orbit (image 02). Not isometric or orthographic. This matches the existing orbit camera proposal (section 10).
- **Light:** natural. A warm sun patch from the window lands on the counter and floor, shadows are soft with a cool fill, and the window is not blown out. This is the Morning preset below. Dust motes and light rays (Phase 2) as in image 02.
- **Palette:** confirmed by Manuel, kept as in the table below.
- **Steam:** no reference needed, the Phase 1 steam is accepted.

### Composition target (slice 2.0, variant A "counter in the corner")

Chosen by Manuel on 2026-11-04 from three sketched variants (counter in the corner, little table by the window, tabletop slab). Draft, pending Manuel's approval in slice 2.0.

- **Reading:** a cut-away corner of a small kitchen, seen from the front-right through the perspective orbit camera. It reads as a room corner with a floor, not as a block: a plinth, a wood floor, a base cabinet with a worktop, two walls, a window above the worktop.
- **Worktop and cabinet:** the worktop keeps the section 5 footprint (0.60 x 0.45, top surface at the world origin, z = 0). A base cabinet (about 0.30 high, cream fronts with simple door panels, `Mat_Frame`) stands under it, flush with the back wall and the left wall. Worktop and floor use `Mat_Wood`.
- **Floor and plinth:** the floor lies about 0.33 below the origin and extends the footprint forward (-Y, about 0.25) and to the right (+X, about 0.30), so the floor is about 0.90 x 0.70 in total, on a thin plinth slab (about 0.05) of `Mat_Wood`. The floor catches the window sun patch.
- **Walls:** back wall (+Y) and left wall (-X) rise from the floor. The walls are 0.50 above the worktop (amendment of section 5, 2026-11-04) and continue down to the floor behind the cabinet. The window sits in the left wall above the worktop (sill about 0.12 above it, opening about 0.36 x 0.30), frame `Mat_Frame`, glass and sky card as in the contract.
- **Props:** mug and kettle on the worktop as today (tea steam and kettle steam markers unchanged in meaning). Tin and books on the worktop. The plant in its pot stands on the floor to the right of the cabinet.
- **Contract impact (to confirm in slice 2.0):** no new object or material names; footprint, origin and wall height above the origin unchanged. Moves, no renames: `Orbit_Target` (visual centre now lower and more forward), `Rays_Origin`, `Rays_Target`, `Dust_Min/Max` re-placed for the new volume. Everything below z = 0 (cabinet, floor, plinth) and the floor extension are inside `Room`. Triangle and material budgets stay well within limits (14 materials max, none added).
- **Camera:** limits as tuned in slice 2.5 (azimuth 0 to 40 degrees, polar 55 to 80 degrees, distance 1.9 to 3.2 since the phase 3 review, hero distance 2.3 (D-116); the hero framing was re-fitted to the taller scene.

### Images

| File | Source | Take | Don't take |
|---|---|---|---|
| `01-morning-tea-props.webp` | [Morning Tea, jordannemari (The Rookies)](https://www.therookies.co/projects/67782) | Shapes of mug and kettle: soft, round, simple volumes with a thick handle. Sage, cream and wood palette. | Nothing in particular. |
| `02-cozy-little-kitchen-light.webp` | [Cozy Little Kitchen (BlenderNation)](https://www.blendernation.com/2022/05/25/behind-the-scenes-cozy-little-kitchen/) | Window light as a patch on the floor, soft shadows, dust motes, bright cream mood, front dollhouse view with perspective. | Depth-of-field blur (optional). |
| `03-kids-room-daylight.webp` | [Cozy kid's room, Marie Aufinger (ArtStation)](https://marieaufinger.artstation.com/projects/KRazDy) | Quality of natural sunlight and shadow, warm wood and colors. | Photorealism, number of objects. |
| `04-kitchen-nook-palette.webp` | [Isometric kitchen nook (CGTrader)](https://www.cgtrader.com/3d-models/interior/kitchen/isometric-kitchen-nook) | Palette (cream wall, warm wood, sage), wood floor, corner with a window, clean flat shapes. | Chrome fridge, amount of props. |
| `05-tidy-kitchen-clean.webp` | [Daylight kitchen (BlenderArtists)](https://blenderartists.org/t/daylight-kitchen/1411892) | Tidy, clean, enough detail, light patch from the window. | Overexposed window glow. |
| `06-pink-room-tone.webp` | [Isometric room, ansiso (The Rookies)](https://www.therookies.co/projects/99552) | Design tone: bright, friendly, clear lines, minimalist with details. | Pink as a color world, isometric view. |

Sources are the pages found by the search; the match between each image and its page was not checked against the page itself.

The composition target for the corner (one paragraph) is written in slice 2.0, not here.

Palette (confirmed by Manuel on 2026-11-04; flat colors, may still be tuned at runtime through `look.ts`):

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

> **AMENDMENT 2026-11-27 (slice 4.0), chosen by Manuel in the planning widgets:** the evening sun comes through the window at azimuth -75 and elevation 22 degrees (`sunAngles` convention; position (-1.347, 0.563, 0.361)); it replaces the untested `evening` position in `look.ts`, which shone from the front right. A pendant lamp over the right end of the worktop is the second evening light. The page behind the canvas turns plum `#3A3350` with cream text `#F2E6D0` (contrast 9.6 : 1). Light colours and intensities are tuned in slice 4.2 against the real render.

What NOT to trust in references: proportions of real kitchens (we exaggerate the props for readability) and any realistic materials.

## 4. Scope

### Core (phases 1 to 3 in section 7; must work before anything else)

1. **Diorama model**: counter, two walls (back and left), window in the left wall, and 5 props (section 5). Contract-compliant GLB.
2. **Tea steam** shader on the mug, driven from the `Steam_Tea` marker.
3. **Kettle steam**: the same shader, stronger uniforms, driven from the `Steam_Kettle` marker. (Moved up from Phase 2: it proves the shader is reusable and costs almost no new code.)
4. **Pointer-reactive steam**: the pointer position, projected into the scene, is a uniform; steam swirls away from it. (Moved up from Phase 2: it is one uniform and it is what makes the steam feel alive.)
5. **Click the mug to cycle tea types** (4 teas): steam color, density and speed change, tea surface color changes, with damped transitions.
6. **Orbit camera** with limited azimuth, polar angle and distance, no panning.
7. **Scene basics**: live lights in the morning preset, baked-looking AO, loader, title, hint text.
8. **Release**: deployed on GitHub Pages.

### Extras (phases 4 and 5 in section 7; built after Core works, one slice each)

- **Window light rays**: soft, noisy, additive planes from the window to the counter.
- **Dust motes**: floating `Points` in the light, own shader.
- **Time-of-day toggle** (morning / evening): light colors, sun direction, sky card, page background, rays, dust and steam react.
- **Pendant lamp** (added 2026-11-27): hangs from the back wall over the right end of the worktop and gives warm light in the evening.
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

Blender is Z up, the exporter maps it to glTF +Y up. World origin is the center of the counter top surface. Front (the camera side) is Blender -Y, the back wall is at +Y, the left wall (with the window) is at -X. Units are meters. Proposed footprint: counter 0.60 (x) by 0.45 (y), walls 0.50 high above the counter top, mug about 0.08 high (0.09 before the 2026-11-19 amendment), kettle about 0.20 high (props are exaggerated for readability).

> **AMENDMENT 2026-11-04 (slice 2.0), asked for by Manuel after seeing the variant A blockout:** wall height above the counter top raised from 0.30 to 0.50 so the walls read as a room and the window can be larger. Nothing else in this section changes: names, parents, origins, markers and materials are untouched. Composition target: section 3.

### Objects

| Object | Type | Parent | Notes |
|---|---|---|---|
| `Room` | mesh | none | Merged static scenery: counter, back wall, left wall, window frame, plant with pot, tea tin, book stack. Origin at world origin. One mesh, shares the AO map |
| `Mug` | mesh | none | Click target and tea-change anchor. Origin at the center of its base, resting on the counter |
| `TeaSurface` | mesh | `Mug` | Disc of tea inside the mug, a few mm below the rim. Own material so its color changes per tea. Origin at its center |
| `Steam_Tea` | Empty | `Mug` | Center of the mug opening at rim height. Steam emits from here. Position only |
| `Kettle` | mesh | none | Origin at the center of its base, resting on the counter |
| `Steam_Kettle` | Empty | `Kettle` | Center of the spout opening. Position only |
| `TeaBag_0` to `TeaBag_3` | mesh | none | **Added by the 2026-11-06 amendment.** One tea bag packet each, standing in the tea box, index = tea index in `TEAS`. Click target and tea-selection indicator (phase 3). Origin at the center of the packet's base, applied transforms, material `Mat_Bag0` to `Mat_Bag3` (one each) |
| `Window_Glass` | mesh | none | Single quad in the window opening, faces into the room. Origin at its center. Code reads its bounds for the light rays |
| `Window_Sky` | mesh | none | Quad a few cm outside `Window_Glass`, same size or larger. The "outside" color card; its color changes with time of day (Phase 2) |
| `Rays_Origin` | Empty | none | Center of the window opening, where light rays start. Position only |
| `Rays_Target` | Empty | none | Point on the counter where the morning light patch roughly lands. Reference only since the 2026-11-27 amendment: the app takes the ray direction from the live sun. Position only |
| `Lamp_Light` | Empty | none | **Added by the 2026-11-27 amendment.** Position of the pendant lamp's point light, inside the lower rim of the shade. Position only |
| `Dust_Min`, `Dust_Max` | Empty | none | Opposite corners of the box in which dust motes float. Position only |
| `Orbit_Target` | Empty | none | Point the orbit camera looks at (visual center of the diorama). Position only |

### Separate objects versus merged

- **Must stay separate** (animated, clickable or an effect anchor): `Mug`, `TeaSurface`, `Kettle`, `TeaBag_0` to `TeaBag_3`, `Window_Glass`, `Window_Sky`, and every marker Empty.
- **Merged into `Room`** (static, no interaction): counter, both walls, window frame, plants, pots, tin, books, and since the 2026-11-06 amendment the wall shelf, jars, bracket rail, hanging mugs, picture frames, tea box body and saucer. They share one AO map. If a prop later needs to animate or be clickable (for example the plant swaying), it is split out of `Room` and added here by amendment.

### Rules

- Export glTF binary (`.glb`), +Y up, file `public/models/nook.glb`.
- Apply scale and rotation on all objects. Meters, unit scale 1.0.
- Marker Empties have identity rotation and scale 1; only their position carries meaning. Code never hard-codes a position that a marker provides.
- Origins: `Mug` and `Kettle` at the center of their base; `Room` at the world origin; quads and discs at their center.
- No Blender duplicate suffixes (`.001`) in any name.
- Multi-material meshes export as a group named like the object with child meshes (`Kettle_1`, `Kettle_2`). Code finds them with `getObjectByName('Kettle')`, never by child names.
- Material names are fixed (final list confirmed after the blockout):
  `Mat_Wall`, `Mat_Wood`, `Mat_Frame`, `Mat_Leaf`, `Mat_Pot`, `Mat_Tin`, `Mat_Book`, `Mat_Mug`, `Mat_Tea`, `Mat_Kettle`, `Mat_KettleDetail`, `Mat_Glass`, `Mat_Sky`.
- AO: `Room` gets a second UV layer `UV_AO` and a baked AO texture (added by the amendment below, slice 2.4).

> **AMENDMENT 2026-11-04 (approved in advance by Manuel for slice 2.4):** `Room` additionally requires a second UV layer `UV_AO` (non-overlapping, 0 to 1) and a baked ambient-occlusion texture `public/models/room_ao.png`, 1024 x 1024 (2048 at most), loaded by the app through `import.meta.env.BASE_URL` and applied as `aoMap` on the `Room` materials. `Mug` and `Kettle` get no AO texture and stay flat colored. The contract check verifies the UV layer; the texture size is checked by the bake script. As built (D-046): the check requires the layers `UVMap` then `UV_AO`, all `UV_AO` coordinates inside 0 to 1, no zero-area face and a total UV area of at most 1; the bake script tests overlap per pixel and asserts a texture size of at most 2048. All other rules of this section stay as they are.

> **AMENDMENT 2026-11-06 (phase 2b, slice D0; APPROVED by Manuel on 2026-11-06).** Asked for by Manuel: more detail on the back wall and the counter, and a clickable tea bag box for phase 3. Layout: section 7, slice D0.
> - **New objects:** `TeaBag_0`, `TeaBag_1`, `TeaBag_2`, `TeaBag_3` (meshes, no parent, origin at the centre of the packet's base, applied transforms). They stand in the tea box (the box body is part of `Room`) and are separate because phase 3 lifts the active one and makes each clickable. Index i matches `TEAS[i]`.
> - **New materials:** `Mat_Iron` (shelf brackets, rail, hooks) and `Mat_Bag0` to `Mat_Bag3` (one per bag, also used by the jar contents in `Room`, so the colour language is one). 13 + 5 = 18 materials. Other new parts reuse existing materials: hanging mugs and saucer `Mat_Frame`, shelf, jar lids and picture frames `Mat_Wood`, jar glass `Mat_Glass` (if the spike in D1 shows transparency sorting problems with the steam, the jars become opaque tinted glass instead, logged), pictograms `Mat_Mug`, `Mat_Leaf` and `Mat_Kettle`.
> - **Budgets:** materials at most 20, draw calls under 50 (counted with the shadow pass). Triangles (target 30k, cap 100k) and GLB size (3 MB) are unchanged. Both new limits are our own proposals from the first outline, not technical limits; the estimate for the new scene is 36 to 44 draw calls.
> - **Markers, existing names, parents, origins:** unchanged. The `Mug` and `Kettle` shapes may change in D4 (wider cup, kettle base plate and dark handle), but their names, origins at the base centre, heights (about 0.09 and 0.20), parents and marker meanings stay; `Steam_Tea` and `Steam_Kettle` move to the new rim and spout centre (a marker move, not a contract change).
> - **Code twins:** `tools/blender/contract_spec.py` and `src/nook/contract.ts` get the new names in D3 (the twin test covers it). `MATERIAL_NAMES` and the palette in `look.ts` get the five new materials; `PALETTE.Mat_Bag0..3` are derived from `TEAS` (same colours as the liquid), not duplicated.

> **AMENDMENT 2026-11-19 (slice H1, requested by Manuel):** the hero `Mug` is scaled to 0.9 about its base centre: about **0.08 high** (0.081, was 0.09), rim radius 0.0416; `TeaSurface` and `Steam_Tea` follow, the saucer in `Room` has radius 49.5 mm. Names, origins, parents and marker meanings are unchanged. Wherever this spec says the mug is "about 0.09" high, read 0.08. The wall shelf, jars and rail sit 35 mm further right (`SHIFT_X`), the hanging cups hang by the handle on J hooks and lean 16 degrees (cup pitch 64 mm); the layout table in section 7 is superseded where it differs (decision D-115).

> **AMENDMENT 2026-11-27 (phase 4, slice 4.0; APPROVED by Manuel on 2026-11-27).**
> - **New material:** `Mat_Lamp` (the pendant lamp shade; its glow is set at runtime). 18 + 1 = 19 contract materials, budget 20 unchanged (the shader materials of steam, rays and dust are not counted, D-137).
> - **New marker:** `Lamp_Light` (Empty, no parent, identity rotation, scale 1).
> - **New static geometry in `Room`:** the pendant lamp (layout in section 7, slice 4.0). Bracket and cord use `Mat_Iron`.
> - **Changed meaning:** the ray direction comes from the live sun direction, not from `Rays_Target - Rays_Origin`. `Rays_Target` stays required but the app does not read it. `Rays_Origin` and the `Window_Glass` bounds still place the rays.
> - **Budgets:** unchanged. Estimate with lamp, rays and dust: 44 draw calls of under 50, counted with the shadow pass.
> - **Code twins:** `tools/blender/contract_spec.py`, `src/nook/contract.ts` and `PALETTE.Mat_Lamp` get the new names in slice 4.1.

### Budgets (proposed, confirm after the first export)

| Item | Budget |
|---|---|
| Triangles (whole GLB) | target 30k, hard cap 100k |
| GLB file size | under 3 MB |
| Textures | AO map 1024 x 1024 (2048 max); no other textures unless justified in the spec |
| Materials | at most 20 (was 14, amended 2026-11-06) |
| Draw calls in the scene (incl. steam, dust) | under 50 (was 40, amended 2026-11-06; counted with the shadow pass, as `__nook.stats()` does) |

### Contract check

`tools/blender/contract_check.py` (adapted from Typewriter's) runs headless before every export and refuses to export on errors. It checks: required names present, no duplicate suffixes, unit scale 1.0, transforms applied, parent links (`TeaSurface`, `Steam_Tea` under `Mug`; `Steam_Kettle` under `Kettle`), origins (`Mug` and `Kettle` at base center within 1 mm), markers exist and are Empties, markers sit where expected (`Steam_Tea` near the mug rim, `Steam_Kettle` near the kettle's spout side), only contract materials are used and all are used, and the triangle budget. `tools/blender/contract_spec.py` holds the contract as data; `src/nook/contract.ts` is its TypeScript twin and the two must stay in sync.

## 6. Architecture notes

- **Scene**: `Canvas` with `dpr` clamped to `[1, 2]`, live lights (one directional, one hemisphere), drei `OrbitControls` (damping on, pan off, azimuth, polar and distance limits, target from `Orbit_Target`). Camera and limits were proposed in slice 1.4 and tuned in slice 2.5 (azimuth 0 to 40, polar 55 to 80, distance 1.8 to 3.2); one live directional shadow (1024 map) is on, see section 10.
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
- **Time of day (Phase 2)**: `timeOfDay` in the store; the two presets live in `look.ts`, `src/lib/timeOfDay.ts` holds the pure blend between them (sun angles, light colors and intensities, lamp, sky color, page background, ray strength, steam tint). One `useFrame` damps a single blend factor from 0 (morning) to 1 (evening) and derives every live value from it, so nothing can drift apart (amended 2026-11-27).
- **Evening lamp (amended 2026-11-27)**: one point light at `Lamp_Light`, no shadow (a point light shadow costs six extra passes). It is always in the scene with intensity 0 in the morning, because three compiles the number of lights into every shader program and adding one later would recompile them.
- **Rays and dust (amended 2026-11-27)**: the ray direction is the direction from the live sun position to the world origin. The sun patch (shadow map), the rays and the brighter dust share this one source.
- **Audio (Phase 2)**: created inside the first user-interaction handler; `muted` in the store; mute button in the overlay.
- **UI overlay** (`src/ui`, plain React DOM next to the `Canvas`; `pointer-events: none` except on buttons):
  - Title "Tea Nook", top-left.
  - Hint, bottom-center: "Drag to orbit · Click the mug to change tea".
  - Tea name, bottom-center, fades in after each click.
  - Loader: full screen, progress bar from drei `useProgress`.
  - Phase 2: time-of-day toggle top-right, mute button bottom-right. In the evening the page background, title and pills switch to the evening colours.
- **Hosting**: `vite.config.ts` sets `base: '/tea-nook/'`. All public asset URLs are built from `import.meta.env.BASE_URL`, never a leading `/`. Deploy workflow at `.github/workflows/deploy.yml` (build, upload Pages artifact, deploy); action versions are checked and pinned when written.
- **Quality tiers (Phase 2, mobile)**: a single `quality` flag drives DPR cap, steam plane count and dust count. Not built in Phase 1.

## 7. Phases and slices

**Terminology.** Section 4 splits the product into *Core* and *Extras*. A *phase* here is a review unit as defined in `WORKFLOW.md`: a group of slices that ends in something Manuel can try. Core is built in phases 1 to 3, Extras in phases 4 and 5. Section 4's "Phase 1" and "Phase 2" mean Core and Extras; sections 5, 6 and 10 still refer to the old slice numbers, which map like this:

| Old slice | New slice(s) |
|---|---|
| 0 Setup | 0.1 |
| 1 Shader spike | 0.2 |
| 2 Blockout | 1.2, 1.3, 1.4 |
| 3 Effect on the real model | 1.5 |
| 4 Interaction and UI | 3.1, 3.2 |
| 5 Model detail pass | 2.0 to 2.5 |
| 6 Phase 1 release | 3.3, 3.4 |
| 7a to 7e Extras | 4.1 to 4.4 (renumbered 2026-11-27), 5.1, 5.2 |
| 8 Final release | 5.3 |

**Conventions for all slices**

- "Base checks" means `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass.
- "Console clean" means no console errors and no warnings except the known noise listed in `CLAUDE.md` (`THREE.Clock` deprecation).
- Screenshots are taken in the built-in browser pane at 1280 x 720 after the ready flag is set (slice 1.1), with the dev panel hidden (`?panel=0`). Evidence images are saved to `review/phase-N/`, which is git-ignored: they stay local and are deleted after the review.
- Look values live in `src/config/look.ts` (slice 1.1). A slice that needs a new tweakable value adds it there.
- Any change to section 5 (the model contract) is a stop. Slices that need one say so up front.

Overview:

| Phase | Name | Mode | Ends in |
|---|---|---|---|
| 0 | Setup and shader spike | done | steam on a placeholder mug |
| 1 | Pipeline, blockout, steam on the model | autonomous | boxy diorama, lit, orbitable, both steams rising |
| 2 | Real shapes and AO | slice 2.0 collaborative (done); 2.1 to 2.5 autonomous, headless Blender (Manuel's decision 2026-11-04) | the finished-looking model |
| 2b | Details: back wall, tea box, cup and kettle polish | D0 collaborative (Manuel's decision 2026-11-06), D1 to D5 autonomous and headless | a richer scene with the tea bag objects in place for phase 3 |
| 3 | Interaction, UI and release prep | autonomous | complete interaction loop, deployable build |
| 4 | Extras: light | 4.0 collaborative (2026-11-27), 4.1 to 4.5 autonomous | pendant lamp, morning/evening toggle, window rays, dust |
| 5 | Extras: audio, mobile, final release | autonomous | audio, mobile tier, final write-up |

Phase 4 was refined after the phase 3 review (slice 4.0, 2026-11-27). Phase 5 is an outline; Claude refines it after the phase 4 review, using what was learned (`WORKFLOW.md` section 11).

---

### Phase 0: Setup and shader spike (done)

| Slice | Name | Status |
|---|---|---|
| 0.1 | Setup (commit "Slice 0: project setup") | done |
| 0.2 | Shader spike on a placeholder mug (commit "Slice 1: steam shader spike...") | done, decisions in sections 2 and 6 |

---

### Phase 1: Pipeline, blockout, steam on the model (autonomous)

Branch `phase/1-blockout`. Look-defining first: palette, light and camera framing are visible after slice 1.4, the steam look on the real model after 1.5. Shapes stay boxy on purpose; Phase 2 replaces them.

| Slice | Name | Model and effort |
|---|---|---|
| 1.1 | Look config and verification harness | Sonnet, medium |
| 1.2 | Blender pipeline scripts | Sonnet, high |
| 1.3 | Scripted blockout | Sonnet, high |
| 1.4 | Scene: model, lights, camera | Sonnet, medium |
| 1.5 | Steam on the model | Sonnet, medium |

### Slice 1.1: Look config and verification harness
Goal: every tweakable look value sits in one module, and dev-only hooks let Claude take reproducible screenshots and locate things on screen.
Scope: new `src/config/look.ts`; `src/scene/Scene.tsx` and `src/dev/` (read values from the config, add the hooks); `src/nook/steamDefaults.ts` (re-exported by the config, values unchanged); `CLAUDE.md` Commands section (document the hooks).
Out of scope: the model, Blender, the overlay UI, any new dependency, steam look changes.
Depends on: 0.2
Taste-critical: no
Details: `look.ts` exports `PALETTE` (section 3 colors keyed by material name), `LIGHT_PRESETS` (`morning` and `evening` from section 3; `evening` unused until 4.3), `CAMERA` (pose presets `hero`, `front`, `side`, `top`; fov; limits as placeholders), and re-exports `TEAS` and the steam defaults. Dev-only hooks, all under `import.meta.env.DEV`: URL `?cam=<preset>` sets the camera pose; `?panel=0` hides the Leva panel; `document.documentElement.dataset.nookReady` becomes `"true"` after the first rendered frame once the scene content is mounted; `window.__nook` offers `getCamera()`, `project(objectName)` (screen pixels), `pick(x, y)` (name of the topmost object under that pixel), `stats()` (draw calls, triangles) and `worldPosition(objectName)`. The placeholder mug is named `Mug` so the hooks can be tested before the model exists.
Acceptance criteria:
- [ ] Base checks pass.
- [ ] `src/config/look.ts` exists; `grep -rnE '#[0-9a-fA-F]{6}' src/scene src/ui` prints no lines.
- [ ] `?cam=hero`, `front`, `side`, `top` produce four different camera positions, each equal to its `CAMERA` preset (read with `javascript_tool` via `__nook.getCamera()`).
- [ ] `data-nook-ready="true"` appears within 5 s of load; a screenshot taken after it shows the mug and steam (not an empty background).
- [ ] `?panel=0` hides the Leva panel (screenshot).
- [ ] `__nook.pick(...Object.values(__nook.project('Mug')))` returns `"Mug"`.
- [ ] `grep -r "__nook" dist` prints nothing after `npm run build` (hooks are stripped from production).
- [ ] `CLAUDE.md` Commands section documents the hooks.
- [ ] Console clean.

### Slice 1.2: Blender pipeline scripts
Goal: the headless contract check, export, preview and model generation tooling exists, adapted from Typewriter, and refuses bad input.
Scope: `tools/blender/contract_spec.py`, `contract_check.py`, `export_glb.py`, `render_preview.py`; `tools/gen-model.mjs`; the `gen:model` script in `package.json`; `src/nook/contract.ts` and `src/nook/contract.test.ts`. Sources to adapt: `~/Projects/typewriter/tools/` (read only).
Out of scope: `nook.blend` and any model, any change to section 5, new dependencies (`gltfjsx` 6.5.3 via `npx` is already approved in `CLAUDE.md`).
Depends on: 0.2
Taste-critical: no
Acceptance criteria:
- [ ] Base checks pass.
- [ ] `contract_spec.py` encodes section 5 exactly: object names, types, parents, marker names, material names, budgets. `contract.ts` is its twin; a vitest test extracts both name lists and asserts they are equal.
- [ ] `contract_check.py` run on Blender's factory scene (`Blender -b --python ...`) exits non-zero and prints every missing contract name (paste the output).
- [ ] `export_glb.py` on that same scene exits non-zero and writes no `public/models/nook.glb`.
- [ ] `render_preview.py` renders front, side and top PNGs of an arbitrary scene to a given directory without saving the `.blend`.
- [ ] `gen-model.mjs` applies the same patches as Typewriter's (React 19, strict TS) and `npm run gen:model` exists. If `npx` cannot fetch `gltfjsx` (network), this is a stop (new network dependency), not a workaround.
- [ ] Console clean (app unchanged).

### Slice 1.3: Scripted blockout
Goal: a contract-compliant blockout model, built by a re-runnable headless script, exported and turned into a component.
Scope: `tools/blender/steps/01_blockout.py`; `tools/blender/nook.blend` (created by the script); `public/models/nook.glb`; `src/nook/NookModel.generated.tsx`; `review/phase-1/`.
Out of scope: real shapes (boxes and cylinders only), `UV_AO` and the AO bake, any change to section 5, the live MCP session.
Depends on: 1.2
Taste-critical: yes (proportions). Criterion is "built with the proposed sizes of section 5, decision logged".
Details: counter 0.60 x 0.45, walls 0.30 high (0.50 since the slice 2.0 amendment), mug about 0.09 and kettle about 0.20 high, all from section 5. Room is one merged mesh (counter, two walls, four window-frame boxes, plant as pot cylinder plus cone, tin cylinder, three books). The kettle gets two materials (`Mat_Kettle`, `Mat_KettleDetail` on the lid knob) so the group-export rule is exercised. Material base colors come from the section 3 palette.
Acceptance criteria:
- [ ] Base checks pass.
- [ ] `Blender -b tools/blender/nook.blend --python tools/blender/contract_check.py` exits 0 (paste the output).
- [ ] `export_glb.py` writes `public/models/nook.glb`: under 3 MB, under 100k triangles, at most 14 materials (report the real numbers).
- [ ] `npm run gen:model` writes `NookModel.generated.tsx`; running it twice gives an identical file (`git diff` empty); the file is not hand-edited.
- [ ] `01_blockout.py` run against a fresh temporary path produces a file that passes the contract check (proves it is re-runnable).
- [ ] Preview PNGs (front, side, top) in `review/phase-1/` each show counter, both walls, window, mug and kettle; Claude looks at them and states what it sees.
- [ ] Material base colors in the GLB equal the section 3 palette (script or `get` check, output pasted).
- [ ] `nook.blend` was only created by the script; no `.blend` copy other than `nook.blend` is added to git.

### Slice 1.4: Scene: model, lights, camera
Goal: the app shows the blockout lit by the morning preset, framed and limited by the orbit camera.
Scope: new `src/nook/Nook.tsx` (wrapper); contract validation helper; `src/scene/Scene.tsx` (remove the placeholder, add lights and orbit controls); `src/config/look.ts` (values); `src/dev/` hooks.
Out of scope: steam (absent in this slice), click handling, overlay UI, shadows, AO.
Depends on: 1.1, 1.3
Taste-critical: yes (palette, light, framing). Criterion is "implemented with the values below, decision logged".
Details: Lights from `LIGHT_PRESETS.morning` (one directional, one hemisphere). Camera: 3/4 view from front-right, azimuth about +-35 degrees, polar 55 to 80 degrees (the minimum stays well away from vertical because the steam billboard collapses when seen from above), distance range chosen so the whole diorama fits at 1280 x 720, no panning, target from `Orbit_Target`. Palette: the app sets the color of each contract material by name from `PALETTE` after load, so palette tweaks need no re-export (decision D-009).
Acceptance criteria:
- [ ] Base checks pass.
- [ ] A vitest test for a pure `assertContract(root)` helper: given a stub scene graph missing `Steam_Kettle`, it throws an error that contains `Steam_Kettle`; given a complete graph it does not throw.
- [ ] The model URL is built from `import.meta.env.BASE_URL` (`grep -rn "nook.glb" src` shows no leading slash).
- [ ] `?cam=hero` screenshot: the whole diorama is visible, nothing cropped (projected bounding-box corners from `__nook.project` are inside the viewport), and `Orbit_Target` projects within 10% of the viewport centre.
- [ ] Orbit limits: after extreme drags (`left_click_drag`) in each direction, azimuth, polar angle and distance read from `__nook.getCamera()` stay inside the configured limits.
- [ ] Panning is off: a right-button drag does not change the controls target.
- [ ] Runtime material colors equal `PALETTE` (read with `javascript_tool`); the grep from 1.1 still prints no hex colors in `src/scene` or `src/ui`.
- [ ] `__nook.stats()` reports fewer than 40 draw calls.
- [ ] Screenshots `?cam=hero`, `front`, `side` saved to `review/phase-1/`.
- [ ] Console clean.

### Slice 1.5: Steam on the model
Goal: tea steam rises from `Steam_Tea`, kettle steam from `Steam_Kettle`, both pushed by the pointer, same material class with different uniform values.
Scope: `src/nook/Nook.tsx` (attach steam to the markers); `src/nook/Steam.tsx` (only if needed); `src/config/look.ts` (`KETTLE_STEAM_LOOK`); `src/input/PointerProbe.tsx` (plane height from the marker); `src/dev/` (panel for both steams).
Out of scope: click handling, the tea store and cycling, new steam maths, pointer swirl.
Depends on: 1.4
Taste-critical: yes (kettle steam strength). Criterion is "implemented with the recommended value, decision logged". Recommended: kettle density 1.4 times and height 1.5 times the tea steam, same noise and twist.
Acceptance criteria:
- [ ] Base checks pass.
- [ ] Both steams are visible in the `?cam=hero` screenshot and rise from their openings (screenshot, described).
- [ ] The steam mesh base of each steam is within 1 cm of `__nook.worldPosition('Steam_Tea')` and `('Steam_Kettle')`. `grep` finds no numeric steam positions in `src`.
- [ ] Both steams use `createSteamMaterial`; the kettle's `uDensity` and `uHeight` are larger than the tea steam's (read via `javascript_tool`).
- [ ] Pointer: with the mouse over the tea steam, `uPointerBlend` is above 0.5 and the steam region differs from a screenshot with the mouse outside the canvas; the same for the kettle (two screenshot pairs).
- [ ] Screenshots from `hero`, `front` and `side` show no clipping or flat-plane artifacts. `top` is excluded (known limit, section 6).
- [ ] No `new` expressions inside `useFrame` callbacks in `src/nook` (grep); materials, geometries and textures are disposed on unmount.
- [ ] `__nook.stats()` reports fewer than 40 draw calls.
- [ ] Console clean.

Phase 1 review ("Try this"): orbit the diorama and look at palette, light and framing; hover the pointer through both steams; compare tea and kettle steam; open the dev panel and change a steam value; check the model preview PNGs.

---

### Phase 2: Real shapes and AO (2.0 collaborative and done, 2.1 to 2.5 autonomous)

Slice 2.0 was done together with Manuel (live review of previews). From 2.1 on Manuel decided on 2026-11-04 that the modeling runs without him and that he reviews the results at the end of the phase. Rules for 2.1 to 2.5:

- **Headless only.** Each part is a re-runnable script `tools/blender/steps/0N_<part>.py` that opens `tools/blender/nook.blend`, replaces the mesh of one contract object with a real shape (`bpy.data` and `bmesh`, no deletion of contract objects, names, origins, parents and applied transforms kept) and saves it. `01_blockout.py` is never re-run on `nook.blend` again. Before each step copy `nook.blend` to `tools/blender/nook-pre-<slice>.blend1` (git-ignored). The live Blender MCP session is not used.
- **No shape gate.** Shape and look criteria are "implemented against the references (section 3 "Take" and "Don't take" columns), decision logged in `DECISIONS.md`", not "Manuel approves". The worker looks at its own previews (front, side, top, iso and the in-app `?cam=hero` screenshot), compares them with the references, and iterates up to three times per part before accepting. Manuel judges the shapes at the phase review; changes come as small fix slices.
- **Each slice ends with:** contract check, export, `npm run gen:model`, previews and the in-app screenshot saved to `review/phase-2/`, budget numbers, and a short "what I did in Blender and why" note (2 to 3 sentences per edit, which Blender concept) in the slice's `STATUS.md` notes, so Manuel still learns from the journal.
- **Effort.** Slice 2.1 runs on Sonnet at medium as a test. If the coordinator finds its previews clearly weaker than the references (proportions, handle, silhouette), 2.1 is rerun once at high and the following taste slices (2.2, 2.3) start at high. Opus is not used (cost on the Pro plan; the weak point is visual judgement, not reasoning depth).
- **Stops** are the usual four (phase complete, same problem failed twice, SPEC or contract change needed beyond the pre-approved `UV_AO` amendment below, new dependency or anything destructive). A change of marker positions is not a contract change; a rename or a new object or material name is.

| Slice | Name | Model and effort |
|---|---|---|
| 2.0 | Composition: what the nook looks like | Sonnet, high |
| 2.1 | Mug and tea surface | Sonnet, medium |
| 2.2 | Kettle | Sonnet, medium |
| 2.3 | Room details: window, plant, books, tin | Sonnet, medium (parametric parts scripted) |
| 2.4 | AO bake pipeline | Sonnet, high |
| 2.5 | Lighting, shadows decision, camera tuning | Sonnet, high |

### Slice 2.0: Composition: what the nook looks like
Goal: the overall structure of the diorama matches Manuel's target (what stands where, how the counter, walls and window read, scale) before any detail modeling starts.
Scope: `reference/` (Manuel's images), SPEC section 3 (a short composition target and a line per image); `tools/blender/steps/01_blockout.py` and `tools/blender/nook.blend` (rebuilt from the script, still boxes and cylinders); `src/config/look.ts` (hero camera, orbit limits, `?cam=` presets, light direction if the window moves); regenerated GLB and component; `review/phase-2/`.
Out of scope: real shapes for mug, kettle and props (slices 2.1 to 2.3), `UV_AO`, changes to the model contract other than what the composition decision needs (see below).
Depends on: 1.5, and Manuel's reference images in `reference/`
Taste-critical: yes
Mode: collaborative. Claude proposes variants as previews (headless iso, front, side) and Manuel picks. No coding of variants before the composition target is written down and approved.
Contract: the names, parents, origins and markers stay. If the composition needs different sizes (counter footprint, wall height, window opening), that is an amendment of the section 5 "proposed" sizes: written with a dated note and Manuel's OK in this slice. `nook.blend` is rebuilt with `01_blockout.py --force` only in this slice, while it still has no hand edits (D-023); after this slice the script is no longer re-run on it.
Acceptance criteria:
- [ ] The composition target is written in SPEC section 3 (one paragraph plus one line per reference image) and Manuel has approved it in the session (logged in `DECISIONS.md`).
- [ ] Previews (iso, front, side, plus the in-app `?cam=hero` screenshot) of the chosen composition are saved to `review/phase-2/`; each shows counter, both walls, window, mug and kettle, and Claude states what it sees.
- [ ] Contract check passes; any size change is written into section 5 as a dated amendment with Manuel's OK; budgets reported (GLB size, triangles, materials).
- [ ] Both steams still start at their markers (`__nook.worldPosition` equals the mesh base within 1 cm) and `Orbit_Target` projects within 10% of the viewport centre in `?cam=hero`.
- [ ] Hero view: the whole diorama is inside 1280 x 720 (projected bounding-box corners); orbit limits still hold (drag test from slice 1.4); no steam clipping through walls in `hero`, `front`, `side`.
- [ ] Base checks pass; console clean.
- [ ] Manuel approves the composition in the session.

### Slice 2.1: Mug and tea surface
Goal: a real mug shape with a tea disc, marker moved to the real rim.
Scope: `Mug`, `TeaSurface`, `Steam_Tea` in `nook.blend`; steps journal `02_mug.py`; regenerated GLB and component.
Out of scope: other objects, the contract text.
Depends on: 2.0
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes; origins, parents and applied transforms unchanged (names are not changed).
- [ ] `Steam_Tea` sits within 5 mm of the rim center (read from the file).
- [ ] Mug and tea disc triangle counts reported; GLB still under budget.
- [ ] Previews and the in-app `?cam=hero` screenshot saved to `review/phase-2/`; the steam still starts at the rim.
- [ ] The shape follows the references (section 3, reference 01 for the mug); the choices (proportions, handle, rim, tea level) are logged in `DECISIONS.md`.
- [ ] Base checks pass; console clean.

### Slice 2.2: Kettle
Goal: a real kettle shape with spout; `Steam_Kettle` at the spout opening.
Scope: `Kettle`, `Steam_Kettle`; journal `03_kettle.py`.
Out of scope: other objects.
Depends on: 2.1
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes (two-material group export still found by `getObjectByName('Kettle')`).
- [ ] `Steam_Kettle` within 5 mm of the spout opening center.
- [ ] Budgets reported; previews and hero screenshot in `review/phase-2/`.
- [ ] The shape follows the references (section 3, reference 01 for the kettle: round body, short spout, thick handle, knob); the choices are logged in `DECISIONS.md`.
- [ ] Base checks pass; console clean.

### Slice 2.3: Room details
Goal: window with panes, plant, tin and books with real shapes, inside `Room`.
Scope: `Room`, `Window_Glass`, `Window_Sky`, marker positions that depend on the window (`Rays_Origin`, `Rays_Target`); journals `04_room.py` (repeated parts are parametric scripts).
Out of scope: `UV_AO` (slice 2.4).
Depends on: 2.2
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes; `Room` is still one mesh.
- [ ] `Window_Glass` faces into the room and `Rays_Target` lies on the counter surface (read from the file).
- [ ] Triangles under the 30k target (hard cap 100k); materials at most 14.
- [ ] Previews and screenshots from `hero`, `front`, `side` in `review/phase-2/`.
- [ ] The details follow the references (section 3) and the composition target; the choices are logged in `DECISIONS.md`.
- [ ] Base checks pass; console clean.

### Slice 2.4: AO bake pipeline
Goal: `Room` carries a baked AO texture on a second UV layer, used by the app.
Scope: `Room` mesh (`UV_AO` layer); `tools/blender/steps/05_ao_bake.py` (headless bake); `public/models/` AO texture; `src/nook/Nook.tsx` (assign `aoMap`); SPEC section 5 amendment (see below).
Out of scope: AO for `Mug` and `Kettle` (recommended: not baked, they stay flat colored), live shadows.
Depends on: 2.3
Taste-critical: yes
Contract change: yes, pre-approved by Manuel on 2026-11-04 (see the amendment in section 5): `UV_AO` on `Room`, texture `public/models/room_ao.png`. `contract_spec.py` and `contract.ts` get the new requirement in this slice. No other contract change is allowed.
Acceptance criteria:
- [ ] `contract_spec.py` and `contract.ts` require `UV_AO` on `Room` and the twin test passes; the section 5 amendment text matches what was built.
- [ ] Contract check passes including a `UV_AO` check; AO texture 1024 x 1024 (2048 maximum), GLB under 3 MB.
- [ ] The bake script is re-runnable headless on a temporary copy.
- [ ] Screenshot pair in `review/phase-2/`: AO on and AO off (`aoMapIntensity` 0), corners and contact areas visibly darker with AO on.
- [ ] Base checks pass; console clean.

### Slice 2.5: Lighting, shadows decision, camera tuning
Goal: final light values, the shadow decision from section 10, final camera limits.
Scope: `src/config/look.ts` (light, camera values), `src/scene/` (shadow setup if chosen), SPEC section 10 (record the decision).
Out of scope: the model, time of day.
Depends on: 2.4
Taste-critical: yes. Criterion is "implemented with the recommended value, decision logged".
Details: Recommendation: baked AO only, no live shadow map, unless one directional shadow (1024 map) costs less than 1 ms per frame in the measurement and clearly improves the contact shadows. Measure both with `__nook.stats()` and frame times.
Acceptance criteria:
- [ ] Measured numbers (draw calls, triangles, average frame time over 5 s, both variants) are in `DECISIONS.md` with the chosen option.
- [ ] Camera limits: the orbit clamp test from slice 1.4 passes with the final values; at the extreme allowed poses no object is clipped (screenshots at the four corners of the allowed range).
- [ ] Hero screenshot saved; the dev light values match `LIGHT_PRESETS.morning`.
- [ ] Base checks pass; console clean.

---

### Phase 2b: Details: back wall, tea box, cup and kettle polish (D0 collaborative, D1 to D5 autonomous)

Added 2026-11-06 on Manuel's request, between the phase 2 fixes and phase 3: the scene gets more small details, taken from a tea-station reference photo (shelf with jars, rail with hanging mugs, framed signs, tea bag box, saucer, retro kettle), and the tea bags become real contract objects so phase 3 can click them. Branch `phase/2b-details`. D0 was done with Manuel (layout in the widget, amendment in section 5); D1 to D5 run autonomously and headless under the same rules as phase 2 slices 2.1 to 2.5 (the rules list in "Phase 2" above applies: headless Blender only, one `tools/blender/steps/NN_<part>.py` per part, `nook-pre-<slice>.blend1` backups, no shape gate, up to three iterations per part against the references, a "what I did in Blender and why" note in `STATUS.md`, the usual four stops). Additional rules:

- **`04_room.py` stays the single owner of `Room`** (D-064, D-077). New `Room` parts are new builder functions in it. Every slice that touches `Room` ends with `04_room.py --force` and then `05_ao_bake.py` (the contract check fails in between because `UV_AO` is dropped), then contract check, export, `npm run gen:model`.
- **Steam stays the star.** Nothing may enter the steam columns (clearance of at least 15 mm in plan view, computed from the steam look values in `look.ts` with the same formulas as `steamMath.ts`), and nothing light-coloured and large sits in the area behind the kettle steam at azimuth 0 to 40 degrees (D0 widget: apparent steam position = marker x minus (0.225 minus marker y) times tan(azimuth)).
- **Not cluttered** (section 3): items not on the list below are not added. Out of scope: teapot, sugar and biscuit jars, tea towel crate, blinds, vase with branches, further plants, candle and lamp (phase 4), lettering on the frames (pictograms only, no textures).
- Evidence images go to `review/phase-2b/` (git-ignored). Budgets after the 2026-11-06 amendment: materials at most 20, draw calls under 50, triangles target 30k, GLB under 3 MB.

**Layout (decided in D0, 2026-11-06, metres; Blender axes: x right, y back, z up; worktop top is z = 0, the back wall's inner face is y = 0.225, the worktop spans x -0.30 to 0.30).** Every number is the parameter of a script constant; positions are the bounding boxes' lower-left and size unless noted.

| Part | Where and how big |
|---|---|
| Shelf | plank x -0.295 to 0.005, top z 0.290, 0.020 thick, depth 0.070 (y 0.155 to 0.225), `Mat_Wood`. Two L brackets in `Mat_Iron`, 0.015 wide, 0.045 tall, at x -0.270 and x -0.035. Must end left of the kettle steam |
| 4 jars | on the shelf, centres at x -0.2575, -0.1825, -0.1075, -0.0325 and y 0.190, diameter 0.060, glass body 0.090 high (`Mat_Glass`), lid 0.010 (`Mat_Wood`), contents 0.060 high in `Mat_Bag0` to `Mat_Bag3` (jar i has tea i) |
| Rail with 4 hanging mugs | bar x -0.255 to -0.015 at z 0.215, `Mat_Iron`; hooks and mugs (`Mat_Frame`, 0.054 wide, 0.070 high, hook 0.016) at x -0.225, -0.170, -0.115, -0.060, top of the mugs at z 0.195; nothing in front of y 0.153 |
| Frame A (cup) | x 0.32 to 0.48, z 0.25 to 0.36, 0.015 deep on the back wall, 8 mm `Mat_Wood` border, `Mat_Frame` inside, a cup pictogram in `Mat_Mug` |
| Frame B (leaf) | x 0.50 to 0.59, z 0.22 to 0.34, leaf pictogram in `Mat_Leaf` |
| Frame C (heart) | x 0.33 to 0.41, z 0.13 to 0.21, heart pictogram in `Mat_Mug` |
| Tea box | centre (0.19, -0.15), 0.12 x 0.07 x 0.045 (x, y, z), open top with four slots, `Mat_Wood`, in `Room` |
| 4 tea bags | `TeaBag_0` to `TeaBag_3`, centres at x 0.145, 0.175, 0.205, 0.235 and y -0.15, 0.022 wide, 0.050 deep, standing in the slots, about 0.030 above the box rim at rest; room to lift about 0.015 (phase 3) |
| Saucer | radius 0.055 around the mug (0, -0.07), about 0.006 high, `Mat_Frame`, in `Room`; `Mug` itself does not move |
| Mug (D4) | wider, rounder teacup profile (still about 0.09 high, origin at the base centre) |
| Kettle (D4) | handle and a thin base plate in `Mat_KettleDetail`, lid ring, same height and footprint class (about 0.20 high, origin at the base centre) |

Unchanged: tin (-0.20, -0.13), books (-0.01, 0.17), kettle (0.17, 0.11), mug (0, -0.07), the plants, the window, every marker except `Steam_Tea` and `Steam_Kettle` (which follow the reshaped rim and spout).

| Slice | Name | Model and effort |
|---|---|---|
| D0 | Layout and contract amendment | Sonnet, high (collaborative, done with Manuel) |
| D1 | Back wall: shelf, jars, rail, hanging mugs | Sonnet, medium |
| D2 | Picture frames with pictograms | Sonnet, medium |
| D3 | Tea box and the four `TeaBag` objects | Sonnet, high |
| D4 | Cup, saucer and kettle polish | Sonnet, medium (high if the previews are clearly weaker than the reference) |
| D5 | AO re-bake, shadow, budgets, framing | Sonnet, high |

### Slice D0: Layout and contract amendment
Goal: Manuel decides what goes where, the contract amendment is written, and phase 2b is specified.
Scope: SPEC (this section, section 5 amendment, slice 3.1 note), `DECISIONS.md`, `STATUS.md`.
Out of scope: any model or code change.
Mode: collaborative. Layout chosen in the interactive planner (back wall elevation and worktop plan, real steam profiles, shelf depth check, azimuth parallax). Manuel kept the default layout on 2026-11-06.
Acceptance criteria:
- [ ] The layout table above is complete and approved by Manuel (logged in `DECISIONS.md`).
- [ ] The section 5 amendment is written and Manuel approved it (logged).
- [ ] Slices D1 to D5 below are specified with criteria; slice 3.1 mentions the tea bags.

### Slice D1: Back wall: shelf, jars, rail, hanging mugs
Goal: the shelf with four jars and the rail with four hanging mugs stand on the back wall, inside `Room`.
Scope: `tools/blender/steps/04_room.py` (new builders), `05_ao_bake.py` only if the bake needs it, `tools/blender/contract_spec.py` and `src/nook/contract.ts` (materials `Mat_Iron`, `Mat_Bag0` to `Mat_Bag3`, the new budgets), `src/config/look.ts` (`PALETTE`: `Mat_Iron`; `Mat_Bag0..3` derived from `TEAS`), `Nook.tsx` (apply the palette), regenerated GLB and component.
Out of scope: frames, tea box, mug and kettle shapes.
Depends on: D0 approved
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes; `Room` is still one mesh (new slots appended after the existing seven); material count and all budget numbers reported (materials at most 20, GLB under 3 MB, triangles).
- [ ] Positions and sizes equal the layout table within 5 mm (the script prints the bounding boxes of the new parts, output pasted; it fails if a part leaves its box).
- [ ] Steam clearance: the script computes the plan-view distance of every new part to the tea and kettle steam columns (steam values from `look.ts`, same width formula as `steamMath.ts`); minimum at least 15 mm (output pasted).
- [ ] Jar glass: a spike compares transparent `Mat_Glass` jars and opaque tinted jars with the kettle steam in front at azimuth 0, 25 and 40; the choice and the reason are logged. If transparency shows sorting artefacts, opaque tinted glass is used.
- [ ] `04_room.py --force` and `05_ao_bake.py` run twice give a byte-identical `room_ao.png` of at most 2048 x 2048; if 1024 no longer gives enough texels (contact shadows under the shelf visible), the move to 2048 is logged.
- [ ] Previews (iso, front, side, top) and in-app `?cam=hero`, `front`, `side` screenshots in `review/phase-2b/`; Claude states what it sees (the jars carry four different colours, the mugs hang clear of the books and the steam).
- [ ] Base checks pass; console clean; `grep -r "__nook" dist` prints nothing.

### Slice D2: Picture frames with pictograms
Goal: three frames with cup, leaf and heart pictograms hang on the right part of the back wall.
Scope: `04_room.py` (frame builder), regenerated GLB and component.
Out of scope: lettering, textures, new materials (frames use `Mat_Wood`, `Mat_Frame` and existing colours for the pictograms).
Depends on: D1
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes; `Room` still one mesh; no new materials.
- [ ] Frame positions and sizes equal the layout table within 5 mm; the frames are 15 mm deep and flush on the wall (script output pasted).
- [ ] No frame overlaps the apparent kettle steam or tea steam area at azimuth 0, 10, 20, 30 and 40 degrees (script table pasted, using the D0 formula) and none overlaps the kettle handle, the floor plant or another wall part.
- [ ] Pictograms are geometry (raised 2 mm), readable as cup, leaf and heart in the hero screenshot; choices logged.
- [ ] `04_room.py --force` then `05_ao_bake.py` repeatable (byte-identical PNG); previews and hero, front, side screenshots in `review/phase-2b/`.
- [ ] Base checks pass; console clean.

### Slice D3: Tea box and the four TeaBag objects
Goal: a tea box with four coloured packets stands on the worktop; the packets are contract objects ready for phase 3.
Scope: `04_room.py` (box body), a new step `tools/blender/steps/08_tea_bags.py` (the four meshes), `contract_spec.py` and `contract.ts` (objects `TeaBag_0` to `TeaBag_3`, parent none, material per bag), `Nook.tsx` (find the bags by name, assert in dev, colours from `TEAS` through the palette), `src/config/look.ts`, regenerated GLB and component.
Out of scope: click handling, lifting, hover (phase 3, slice 3.1).
Depends on: D2
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes with the new names; the twin test of `contract_spec.py` and `contract.ts` passes; each bag has origin at its base centre within 1 mm, applied transforms, no parent, and exactly its own `Mat_Bag<i>`.
- [ ] Positions equal the layout table within 5 mm; the box does not touch mug, saucer, kettle or tin (script output pasted).
- [ ] Runtime colours: `Mat_Bag0` to `Mat_Bag3` equal the `TEAS` colours in the palette (read with `__nook.materialColors()`).
- [ ] Each bag can be hit: `__nook.pick(...Object.values(__nook.project('TeaBag_i')))` returns `TeaBag_i` for i = 0 to 3 at `?cam=hero` and `front`, and at azimuth 0 and 40 (output pasted). If a bag is hidden, the box or bag size is adjusted (within the layout) and logged.
- [ ] Draw calls under 50 and triangles reported with the live shadow (decision logged: do the bags cast a shadow? default no).
- [ ] `npm run gen:model` twice gives an identical file; GLB under 3 MB; previews and hero, front, side screenshots in `review/phase-2b/`.
- [ ] Base checks pass; console clean.

### Slice D4: Cup, saucer and kettle polish
Goal: a wider, rounder teacup on a saucer and a retro-style kettle with dark handle and base plate.
Scope: `tools/blender/steps/02_mug.py` and `03_kettle.py` (or successor steps that keep the journal re-runnable), `06_smooth_shading.py` rerun, `04_room.py` (saucer), markers `Steam_Tea`, `Steam_Kettle`, regenerated GLB and component.
Out of scope: palette changes (terracotta mug and sage kettle stay), speckle textures, a teapot.
Depends on: D3
Taste-critical: yes
Acceptance criteria:
- [ ] Contract check passes; names, origins at the base centre, parents and applied transforms unchanged; `Mug` about 0.08 (amendment 2026-11-19) and `Kettle` about 0.20 high (within 5 mm).
- [ ] `Steam_Tea` within 5 mm of the new rim centre and `Steam_Kettle` within 5 mm of the spout opening centre; the steam meshes start at the markers (`__nook.worldPosition` equals the mesh base within 1 cm).
- [ ] `Kettle` still exports as a two-mesh group found by `getObjectByName('Kettle')`; handle and base plate use `Mat_KettleDetail`.
- [ ] The tea surface is visible from the hero camera: at least half of a grid of points on the `TeaSurface` disc projected with `__nook.projectPoint` pick `TeaSurface` (output pasted).
- [ ] The saucer sits in `Room` under the mug without moving the mug; the saucer touches no other part.
- [ ] The shapes follow reference 01 and the tea-station photo (round teacup, retro kettle); choices logged; triangle counts reported (Mug about 540 and Kettle about 900 are guides, not caps).
- [ ] `05_ao_bake.py` rerun; previews and hero, front, side screenshots in `review/phase-2b/`; base checks pass; console clean.

### Slice D5: AO re-bake, shadow, budgets, framing
Goal: the finished scene is checked against every budget and the camera and light still work with the new details.
Scope: `look.ts` (hero framing if needed), `STATUS.md` budget table, fixes inside existing files only.
Out of scope: new parts.
Depends on: D4
Taste-critical: yes (framing). Criterion is "implemented with the recommended value, decision logged".
Acceptance criteria:
- [ ] Budget table in `STATUS.md`: triangles, GLB size, materials, draw calls with shadow, average frame time over `__nook.benchmark(2000)` (two runs, compared with the 1.6 ms of F5), each against its section 5 budget.
- [ ] Hero view: the whole diorama is inside 1280 x 720 (projected bounding-box corners) and `Orbit_Target` projects within 10% of the viewport centre; the orbit clamp test passes at the four corners and both distances with no important object clipped (screenshots).
- [ ] Shadow: no clipping and no acne at hero, front and the four corners (`fitShadowFrustum` still fits, texel sizes reported); the shelf, jars, rail and frames show baked contact darkening (AO) on the back wall (reworded 2026-11-19: a sun-cast shelf shadow is not possible with the sun parallel to that wall, D-111).
- [ ] Steam readability: a screenshot pair (kettle and tea steam against the new back wall) shows both steams clearly; if a part hides a steam, it is moved within the layout and logged.
- [ ] `grep -r "__nook" dist` and `grep -r leva dist` print nothing; base checks pass; console clean.
- [ ] A fresh-context reviewer runs and `REVIEW-phase-2b.md` is written; Manuel is notified; phase 3 is not started.

Phase 2b review ("Try this"): orbit through 0 to 40 degrees and look for anything crowding the steam; hover the pointer through both steams; look at the jars (colours match the four teas), the hanging mugs, the frames and the tea box; compare cup and kettle with the references; run `npm run dev` with `?cam=front`.

---

### Phase 3: Interaction, UI and release prep (autonomous)

Branch `phase/3-interaction`. Tea colors and steam transitions come first (look-defining), the overlay second, release prep last. Needs no git remote; deployment itself happens after Manuel adds one.

| Slice | Name | Model and effort |
|---|---|---|
| 3.1 | Click to cycle tea | Sonnet, medium |
| 3.2 | Overlay: title, hint, tea name, loader | Sonnet, medium |
| 3.3 | Performance and budget check | Sonnet, high |
| 3.4 | Deploy workflow and README | Sonnet, low |

### Slice 3.1: Click to cycle tea
Goal: clicking the mug advances the tea, and clicking a tea bag (`TeaBag_0` to `TeaBag_3`, phase 2b) selects that tea directly; the active bag stands lifted above the others. Steam color, density, speed and the tea surface color damp toward the new tea.
Scope: `src/store/useStore.ts` (`teaIndex`, `nextTea`, `setTea`); `src/input/` (mug and bag click and hover); `src/nook/Nook.tsx`, `Steam.tsx`; `src/lib/teas.ts` (values only if tuning is needed). The bag lift is a damped `position.y` offset in `useFrame` (about 0.015 m, value in `look.ts`), read from the store with `getState()`.
Out of scope: overlay UI, audio, pointer swirl, new steam maths.
Depends on: 2b (D3: the bag objects exist), or 2.5 for the mug click alone
Taste-critical: yes. Criterion is "implemented with the values in `TEAS`, decision logged".
Acceptance criteria:
- [ ] Base checks pass.
- [ ] Clicking at `__nook.project('Mug')` increases `teaIndex` by 1; the 4th click wraps to 0 (`useStore.getState().teaIndex`, exposed under the dev hook).
- [ ] Clicking at `__nook.project('TeaBag_i')` sets `teaIndex` to i for i = 0 to 3; the active bag's lift converges to its target within 1 s without a jump and the other three are at rest (sample with `javascript_tool`); the bag handler calls `stopPropagation()` and sets the pointer cursor on hover like the mug.
- [ ] Clicking elsewhere (the counter, empty background) does not change `teaIndex`; a drag that starts on the mug or a bag and moves more than 5 px does not count as a click.
- [ ] After a click the steam uniforms and the `TeaSurface` material color converge to the new tea's values within 2 s without a jump (sample over time with `javascript_tool`: monotone change, no step larger than 25% of the total in one frame).
- [ ] Hover over the mug sets `cursor: pointer` on the canvas; leaving or unmounting resets it. The mug handler calls `stopPropagation()`.
- [ ] No component subscribes to pointer fields; no `setState` and no allocations in `useFrame` (grep).
- [ ] Four screenshots, one per tea, in `review/phase-3/`.
- [ ] Console clean.

### Slice 3.2: Overlay: title, hint, tea name, loader
Goal: the HTML overlay from section 6.
Scope: `src/ui/`, `src/App.tsx`, `src/index.css`.
Out of scope: Phase 4 and 5 buttons, web fonts, new dependencies.
Depends on: 3.1
Taste-critical: yes (type and placement). Criterion is "implemented with the recommended values: system font stack, as in section 6, decision logged".
Acceptance criteria:
- [ ] Base checks pass.
- [ ] Title "Tea Nook" top-left and hint "Drag to orbit · Click the mug to change tea" bottom-center are legible at 1280 x 720 (screenshot; computed contrast ratio at least 4.5 : 1 measured with `javascript_tool`).
- [ ] After a click, the tea name appears bottom-center and fades out (opacity read at 0 s, 0.5 s and 3 s).
- [ ] The overlay has `pointer-events: none` except on buttons; orbit drag works over the title area.
- [ ] The loader shows a progress bar during load (throttled to slow 3G through `javascript_tool` or a delayed GLB response in a screenshot) and is gone when `data-nook-ready` is set.
- [ ] `grep` finds no remote URLs in `index.html`, `src/ui` or CSS.
- [ ] Console clean.

### Slice 3.3: Performance and budget check
Goal: measure against the budgets and fix cheap violations.
Scope: `src/dev/` (a stats readout), measurement notes in `STATUS.md`, fixes inside existing files.
Out of scope: new features, quality tiers (Phase 5), changing budgets.
Depends on: 3.2
Taste-critical: no
Acceptance criteria:
- [ ] Table in `STATUS.md`: triangles, GLB size, materials, draw calls, and average frame time over 10 s in the production build (`npm run preview`) at 1280 x 720, each against its section 5 budget.
- [ ] Draw calls under 50 (counted with the shadow pass); triangles under 100k; GLB under 3 MB; materials at most 20 (limits of the 2026-11-06 amendment; they were 40 and 14 before). A violation that needs a budget change is a stop.
- [ ] The measured frame time and the machine are recorded. The pane's frame rate is only a proxy; the 60 fps and 4x throttle check on Manuel's laptop is listed in the review.
- [ ] Base checks pass; console clean.

### Slice 3.4: Deploy workflow and README
Goal: a Pages deploy workflow that works as soon as a remote exists, and a short README.
Scope: `.github/workflows/deploy.yml`, `README.md`.
Out of scope: creating the repo or a remote, pushing, changing `base`.
Depends on: 3.3
Taste-critical: no
Acceptance criteria:
- [ ] Base checks pass.
- [ ] `deploy.yml` parses as YAML (`python3 -I -c "import yaml..."` or equivalent), runs install, build, uploads the Pages artifact and deploys; every action is pinned to a version that exists (checked against the action's releases when written, source noted in `DECISIONS.md`).
- [ ] `npm run build && npm run preview`: loading `/tea-nook/` fetches the GLB, texture and JS under `/tea-nook/` with no 404 (network log pasted).
- [ ] README has what it is, how to run, the stack, the model pipeline in 5 lines. No claims that were not verified.
- [ ] Console clean.

Phase 3 review ("Try this"): click through all four teas; hover and drag the mug; reload with a slow network to see the loader; run `npm run preview`; on your laptop check fps and the 4x CPU throttle; then add a remote and push.

---

### Phase 4: Extras: light (4.0 collaborative, 4.1 to 4.5 autonomous)

Refined on 2026-11-27 with Manuel (slice 4.0). Branch `phase/4-light`. The time of day comes before the effects (look-defining first): both looks are visible after slice 4.2, and rays and dust are built for both from the start. 4.1 to 4.5 run autonomously; Blender work is headless and follows the phase 2b rules (re-runnable scripts, `nook-pre-<slice>.blend1` backups, `04_room.py` owns `Room`, previews, a "what I did in Blender and why" note, no shape gate). The only contract change is the 2026-11-27 amendment in section 5; any other one is a stop. Evidence goes to `review/phase-4/` (git-ignored). Pointer swirl, shelf shadow and other ideas stay notes in `STATUS.md`.

| Slice | Name | Model and effort |
|---|---|---|
| 4.0 | Evening look, lamp and amendment | Sonnet, high (collaborative, with Manuel) |
| 4.1 | Pendant lamp model | Sonnet, medium |
| 4.2 | Time of day: presets, lamp light, toggle | Sonnet, high |
| 4.3 | Window light rays | Sonnet, high |
| 4.4 | Dust motes | Sonnet, medium |
| 4.5 | Budgets, performance, polish and review | Sonnet, high |

### Slice 4.0: Evening look, lamp and amendment
Goal: Manuel decides the evening sun, the page background and the lamp; phase 4 is specified and the contract amendment written.
Scope: SPEC (sections 3 to 7), `DECISIONS.md`, `STATUS.md`.
Out of scope: any model or code change.
Mode: collaborative, with two planning widgets (sun and rays, lamp) built from the scene's dimensions.

**Chosen values (2026-11-27).** Metres, Blender axes (x right, y back, z up; worktop top z = 0).

| Part | Value |
|---|---|
| Evening sun | azimuth -75, elevation 22 degrees, same distance as the morning sun |
| Evening page | background `#3A3350`, text `#F2E6D0` |
| Lamp shade | pendant, centre (0.27, 0.00), lower rim z 0.280, 0.050 high, radius 0.045 at the lower rim narrowing to about 0.029 at the top, `Mat_Lamp` |
| Lamp holder | arm from the back wall (y 0.225) forward to y 0.00 at z 0.410, cord down to the shade, small wall plate, `Mat_Iron` |
| `Lamp_Light` | (0.27, 0.00, 0.285) |

Starting values for slice 4.2, tunable there: `PALETTE.Mat_Lamp` `#E8C48A`, lamp light `#FFB35C`, evening sky card `#E8946A`, evening sun `#FF9A57`, hemisphere sky `#3C4E7A`.

Acceptance criteria:
- [x] The chosen values are in the table above and logged in `DECISIONS.md`.
- [x] Manuel approved the section 5 amendment (logged).
- [x] Slices 4.1 to 4.5 are specified with criteria.

### Slice 4.1: Pendant lamp model
Goal: the pendant lamp hangs over the worktop, with the new material and marker in the contract.
Scope: `tools/blender/steps/04_room.py` (lamp builder, marker), `05_ao_bake.py` only if the bake needs it, `contract_spec.py`, `src/nook/contract.ts`, `src/config/look.ts` (`PALETTE.Mat_Lamp`), `src/nook/` where the palette is applied, regenerated GLB and component.
Out of scope: any light, glow or time-of-day code; moving or reshaping existing parts.
Depends on: 4.0 approved
Taste-critical: yes (shade shape; recommended values, decision logged)
Acceptance criteria:
- [ ] Base checks pass; console clean; `grep -r "__nook" dist` prints nothing.
- [ ] Contract check passes with `Mat_Lamp` and `Lamp_Light`; the twin test passes; `Room` is still one mesh, the new slot is appended after the existing ones.
- [ ] Shade and holder equal the slice 4.0 table within 5 mm and `Lamp_Light` within 1 mm (script output pasted).
- [ ] Steam clearance at least 15 mm in plan view for every lamp part (script output pasted); a script table shows that the shade covers neither steam column on screen at azimuth 0, 10, 20, 25, 30 and 40.
- [ ] `04_room.py --force` and `05_ao_bake.py` run twice give a byte-identical `room_ao.png`; `npm run gen:model` twice gives an identical file.
- [ ] Budgets reported: 19 materials, draw calls under 50, GLB under 3 MB, triangles.
- [ ] Previews (iso, front, side, top) and in-app `hero` and `front` screenshots; Claude states what it sees, including whether the arm crosses a steam column on screen.

### Slice 4.2: Time of day: presets, lamp light, toggle
Goal: a morning/evening toggle that damps sun direction, lights, lamp, sky card, page colours and steam tint to the active preset.
Scope: `src/store/useStore.ts` (`timeOfDay`, toggle), `src/lib/timeOfDay.ts` with tests, `src/scene/`, `src/nook/` (sky card, lamp glow, steam tint), `src/ui/` and `src/index.css` (toggle top-right, evening colours), `src/config/look.ts`, `src/dev/` (hooks and Leva).
Out of scope: rays, dust, audio, mobile, the model, persisting the choice.
Depends on: 4.1
Taste-critical: yes (evening look; the slice 4.0 values, the rest recommended and logged)
Details: the app starts in the morning. The sun direction is blended as angles, so it keeps its distance. Dev only: `?time=evening` selects the preset on load, and the Leva `Light` folder edits the active preset. Colours and intensities are tuned against the real render.
Acceptance criteria:
- [ ] Base checks pass; console clean; `grep -r "__nook" dist` prints nothing.
- [ ] Unit tests: the blend returns the morning preset at 0 and the evening preset at 1, and the evening sun equals azimuth -75 and elevation 22 within 0.1 degrees.
- [ ] A real click on the toggle (top-right, usable with the keyboard, `aria-pressed`) switches `timeOfDay`; a second click returns to the morning.
- [ ] After a click every live value converges within 2 s without a jump (sampled with `__nook.step`: monotone, no frame step larger than 25% of the total change).
- [ ] `Window_Sky`, the lamp glow, the lamp light intensity (0 in the morning), the page background and the steam tint differ between the presets (values read in the app); the program count does not change when toggling.
- [ ] The evening sun comes through the window; its shadow is not clipped at the start, three points inside and the end of the transition (screenshots); `?shadow=static` also updates.
- [ ] Evening readability: the four tea bags stay distinguishable (sampled pixel colours differ pairwise by at least 30 in RGB distance) and the title, toggle and pills have a contrast of at least 4.5 : 1 in both presets.
- [ ] No allocations and no `setState` in `useFrame` (grep and reading the callbacks).
- [ ] Screenshots morning and evening at `hero`, `front` and azimuth 40; the morning looks as before apart from the lamp (compared with the phase 4.1 screenshot).

### Slice 4.3: Window light rays
Goal: soft, noisy, additive planes from the window along the live sun direction, sized from `Window_Glass` bounds.
Scope: `src/nook/Rays.tsx`, `src/shaders/rays.*`, `src/lib/` twin for the CPU maths, `src/config/look.ts` (including a ray strength per preset), `src/dev/` (Leva folder).
Out of scope: dust, changes to the light presets beyond ray values, the model.
Depends on: 4.2
Taste-critical: yes (recommended values, decision logged)
Acceptance criteria:
- [ ] Base checks pass; console clean; `grep -r "__nook" dist` prints nothing.
- [ ] Unit tests of the pure functions: the ray direction points from the sun position to the world origin for both presets; a ray ends at the first of worktop top, back wall or floor.
- [ ] The rays follow the sun during the transition (screenshot halfway) and their ends lie on the sun patch in both presets (screenshots).
- [ ] Additive blending, `depthWrite: false`, raycasting disabled, one draw call; uniforms on `material.userData`, mutated and not replaced (grep).
- [ ] No hard plane edges at azimuth 0, 25 and 40 in both presets (screenshots).
- [ ] Both steams stay readable (screenshot pairs with rays on and off); real clicks on the mug and on a tea bag still select a tea.
- [ ] Draw calls under 50.

### Slice 4.4: Dust motes
Goal: `Points` floating inside the box `Dust_Min` to `Dust_Max`, own shader, brighter inside the window beam.
Scope: `src/nook/Dust.tsx`, `src/shaders/dust.*`, `src/lib/` twin, `src/config/look.ts`.
Out of scope: audio, mobile quality tier, the model.
Depends on: 4.3
Taste-critical: yes (recommended values, decision logged)
Acceptance criteria:
- [ ] Base checks pass; console clean; `grep -r "__nook" dist` prints nothing.
- [ ] Every mote stays inside the `Dust_Min`/`Dust_Max` box over 60 s of simulated time (unit test of the position function).
- [ ] Unit test of the beam function: a point on a ray from the glass centre is inside, a point beside the beam is outside, for both presets.
- [ ] Count is a single constant in `look.ts`; one draw call; `depthWrite: false`; raycasting disabled.
- [ ] Screenshots from `hero` in both presets show motes that are brighter in the beam; draw calls under 50.

### Slice 4.5: Budgets, performance, polish and review
Goal: the finished phase is measured against every budget, checked in both presets and handed to Manuel.
Scope: fixes inside existing files, `look.ts` values, `README.md`, `STATUS.md`.
Out of scope: new features, quality tiers, changing budgets.
Depends on: 4.4
Taste-critical: no
Acceptance criteria:
- [ ] Base checks pass; console clean; `grep -r "__nook" dist` and `grep -r leva dist` print nothing; contract check passes.
- [ ] Budget table in `STATUS.md` for both presets: triangles, GLB size, materials, draw calls with the shadow pass, `__nook.benchmark(2000)` twice, and the production-build frame time, compared with the slice 3.3 numbers.
- [ ] The orbit corners at both distances in both presets: nothing clipped, both steams readable (screenshots).
- [ ] `README.md` mentions the new features without unverified claims.
- [ ] A fresh-context reviewer runs and `REVIEW-phase-4.md` is written; Manuel is notified; phase 5 is not started.

Phase 4 review ("Try this"): toggle morning and evening several times, also in the middle of a transition; orbit in both looks and watch the rays and dust; click through the teas in the evening; check fps and the 4x CPU throttle on your laptop against the phase 3 numbers.

---

### Phase 5: Extras: audio, mobile, final release (outline, refine after phase 4)

| Slice | Name | Model and effort |
|---|---|---|
| 5.1 | Ambient audio and mute | Sonnet, medium |
| 5.2 | Mobile support | Sonnet, high |
| 5.3 | Final performance pass and write-up | Sonnet, medium |

### Slice 5.1: Ambient audio and mute
Goal: a bundled audio loop that starts only after the first user interaction, with a mute button.
Scope: `src/audio/`, `src/store/useStore.ts` (`muted`), `src/ui/`, `public/` audio file.
Out of scope: more sound effects.
Depends on: 3.2
Taste-critical: yes (recommended: a short bundled loop, decision logged)
Needs input first: audio source and license (section 10); a stop if it is still open when the slice starts.
Acceptance criteria:
- [ ] Base checks pass.
- [ ] No `AudioContext` is created or resumed before the first pointer or key event (checked by instrumenting the constructor before load).
- [ ] The mute button toggles `muted`; the gain reaches 0 within 0.3 s.
- [ ] The audio file license is recorded in `DECISIONS.md`; no remote audio URLs.
- [ ] Console clean.

### Slice 5.2: Mobile support
Goal: touch controls, portrait framing and a reduced quality tier.
Scope: `src/config/look.ts` (quality tiers), `src/scene/`, `src/ui/`.
Out of scope: native apps.
Depends on: 4.5
Taste-critical: no
Acceptance criteria:
- [ ] Base checks pass.
- [ ] At 390 x 844 (`resize_window` mobile) the whole diorama is visible in a screenshot; the overlay text does not overlap the model.
- [ ] A single `quality` flag drives the DPR cap, steam plane count and dust count (grep shows no other switches).
- [ ] Touch orbit works (emulated touch drag changes the camera).
- [ ] Desktop screenshots are unchanged from phase 4 (pixel diff under 1%).
- [ ] Console clean.

### Slice 5.3: Final performance pass and write-up
Goal: final measurements, portfolio write-up of the shader work, redeploy.
Scope: README, `STATUS.md`, measurement notes.
Out of scope: new features.
Depends on: 5.2
Taste-critical: no
Acceptance criteria:
- [ ] Base checks pass; the budget table from 3.3 is repeated and within budget.
- [ ] README shader write-up covers uniforms, noise, twist, pointer push and the decisions from section 2 and 6.
- [ ] Console clean.

## 8. Definition of done (Core, end of phase 3)

- The live GitHub Pages URL loads with no console errors or warnings (known noise from dependencies is listed in `CLAUDE.md`).
- Contract check passes; GLB under 3 MB, under 100k triangles (target 30k), at most 20 materials (14 before the 2026-11-06 amendment).
- Tea steam and kettle steam rise from their markers and are visibly the same shader with different uniforms.
- Clicking the mug cycles 4 teas; steam color, density, speed and tea surface color change smoothly.
- The pointer visibly pushes the steam away.
- The orbit camera is limited so the diorama always looks good; no panning.
- Loader, title and hint text are in place; the page works at 1280 x 720 and larger.
- About 60 fps on the owner's laptop, plus an acceptable result with Chrome DevTools 4x CPU throttling as a proxy for weaker machines.
- `npm run typecheck`, `lint`, `test` and `build` pass.

## 9. How the agent verifies its work

1. `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` pass.
2. Open the dev server in the built-in browser at 1280 x 720, wait for `data-nook-ready`, take a screenshot (use `?cam=<preset>&panel=0`, see slice 1.1), read the console. No errors or new warnings.
3. Test the slice by hand (orbit, hover, click, resize).
4. Shader slices: check from at least 3 camera angles and with the pointer inside and outside the steam.
5. Model slices: headless contract check passes, headless preview renders (front, side, top) are looked at, the GLB loads in the app, triangle count and file size are compared with the budgets.
6. Performance slices: dev-only stats panel for fps, draw calls and triangle counts; compare with section 5 budgets.
7. Summarize in 1 to 2 sentences, including anything not verified.

## 10. Open questions

**Need Manuel's answer before phase 1 starts** (each with a recommendation; if you say "all as recommended", they become decisions D-010 to D-012):

1. **Section 5 sizes and budgets.** The sizes ("proposals") and budgets ("proposed, confirm after the first export") are not final. Slice 1.3 builds the blockout with them unchanged. Recommendation: accept them as the working values; if the blockout shows a problem, the fix is an amendment in phase 2, made with you present. Without an answer, any needed change in phase 1 is a stop.
2. **Phase order.** Recommended: phase 1 (autonomous), then you review and we do phase 2 (live Blender, you present) in the same sitting, then phase 3 runs while you are away. Alternative: phase 3 before phase 2, which gets interaction early but builds it on boxes.
3. **Usage window.** The plan is Pro: a 5-hour window and a weekly limit, extra usage off. Phase 1 has five slices with subagents and screenshots and will probably not fit one window. Recommendation: start phase 1 right after a window reset, accept the pause-and-resume behavior (`WORKFLOW.md` section 10), keep extra usage off.

**Needed later, not blocking phase 1:**

- **Git remote and repo name.** There is no remote. Assumed repo name `tea-nook` (Pages URL `/tea-nook/`). Needed after phase 3 for the first deploy; phases 1 to 3 do not need it. Recommendation: you create the repo and add the remote; Claude never does.
- **Audio source and license** (slice 5.1). Must be free to use and bundled. Recommendation: decide before phase 5.

**Settled by recommendation** (veto any of them now, otherwise they are decisions):

- **AO bake scope** (slice 2.4): `Room` only; `Mug` and `Kettle` stay flat colored.
- ~~**Shadows** (slice 2.5): baked AO only, unless one live shadow costs under 1 ms per frame and clearly improves contact shadows.~~ **Decided 2026-11-04 (slice 2.5, D-048):** one live directional shadow (1024 map, `PCFShadowMap`, shadow camera fitted to the diorama; casters `Room`, `Mug`, `Kettle`). Measured in the built-in pane, back-to-back render with readPixels over 5 s: off 16 draw calls, 6014 triangles, 1.43 to 1.47 ms; live 27 draw calls, 8950 triangles, 1.57 to 1.64 ms (+0.15 ms); static 16 and 6014, 1.52 to 1.57 ms. Under 1 ms, and it creates the window sun patch that baked AO cannot. A proxy only (this Mac's GPU, not the owner's laptop). `SHADOW.mode` in `look.ts` can switch to `static` or `off`.
- **Typography** (slice 3.2): system font stack, no web font.
- **Pointer swirl** (idea from slice 0.2): not built. Noted in `STATUS.md`; it can become a slice after the phase 3 review.
- ~~**Camera defaults and limits**: slice 1.4 uses the proposal (3/4 view from front-right, azimuth about +-35 degrees, polar 55 to 80 degrees); slice 2.5 tunes them on the final model.~~ **Tuned 2026-11-04 (slice 2.5, D-052):** azimuth 0 to 40 degrees (the window wall hides the nook from the left), polar 55 to 80, distance 1.8 to 3.2 m, hero (25, 68, 2.6) unchanged. Section 6 and the slice 1.4 and 2.0 texts above still quote the old numbers.
- **Palette at runtime**: the app sets contract material colors from `look.ts` by name after load (D-009), so palette changes after review need no re-export.

**Resolved:**

- ~~Steam geometry and noise source~~ Resolved 2026-10-27 (slice 0.2): camera-facing billboard around Y, tileable Perlin texture generated at startup (section 6).
- ~~Dev tweak panel~~ Resolved 2026-10-27 (slice 0.2): `leva` 0.10.1, approved by Manuel, dev only.
- ~~Reference images~~ Resolved 2026-11-04: six images chosen, notes and decisions in section 3. The images stay local and are not committed.
