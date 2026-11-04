# Review: phase 2 (Real shapes and AO)

Branch `phase/2-shapes`. Slice 2.0 (composition) was done together with Manuel; slices 2.1 to 2.5 ran autonomously and headless (D-035). One commit per slice. A fresh-context reviewer found no blockers; its should-fix items are fixed in the last commit. The phase branch is not merged into `main` yet.

## 1. Try this

Run `npm run dev` and open the URL it prints (add `/tea-nook/` if it is not already there).

1. **Orbit and look at the whole scene.** Azimuth 0 to 40 degrees (the window wall would hide the cabinet from the other side), polar 55 to 80, distance 1.8 to 3.2, no panning. Is this the nook you wanted? ![hero](review/phase-2/light-hero.jpg)
2. **Look at the light.** The sun comes through the left-wall window and lands on the worktop and the floor, with the window cross in the shadow. Compare `?shadow=off` (baked AO only) with the default (one live shadow). ![before and after](review/phase-2/light-noshadow-hero.jpg)
3. **Look at the mug and the kettle up close.** `review/phase-2/mug-close-a.png`, `mug-close-b.png`, `kettle-close-a.png`, `kettle-close-b.png`. Reference 01 is the target: soft, round, thick handle.
4. **Look at the details.** Window with four panes and sill, cabinet doors with handles, floor boards, baseboards, plant, tin, books: `room-close-*.png`.
5. **Look at the AO.** `ao-on-hero.jpg` against `ao-off-hero.jpg`, and `ao-diff-hero.png` (the difference times 8). Contact shadows under props, cabinet and plant, and in the corners.
6. **Move the pointer through both steams** (unchanged from phase 1) and check that the steam still starts at the rim and the spout and reads well against the brighter wall.

## 2. Decisions

Full table in `DECISIONS.md` (D-032 to D-053). Foundation first:

- **D-035:** phase 2 runs autonomously and headless from slice 2.1; Manuel reviews at the end.
- **D-048:** one live directional shadow (1024 map, `PCFShadowMap`, shadow camera fitted to the diorama). It costs about 0.15 ms per frame more than no shadow (proxy measurement in the built-in browser pane, see open issues), 27 instead of 16 draw calls. The evening preset (phase 4) will need a refitted shadow frustum.
- **D-032 to D-034:** composition variant A (cut-away corner with cabinet, worktop, wood floor on a plinth, walls 0.50 above the worktop, larger window).
- **D-043 to D-047:** AO pipeline: second UV layer by Smart UV Project plus Pack Islands, Cycles bake (128 samples, distance 0.20 m), levels floor 0.40, texture 1024 x 1024.

Taste values to look at (easy-to-change, in `src/config/look.ts` unless noted):

- **D-049:** sun `#FFF1D6` intensity 4.8 from the left window, fill `#BFD8F0` 3.6.
- **D-050:** tone mapping `Neutral` instead of ACES (ACES greyed the flat palette). You did not ask for this one.
- **D-051:** AO intensity 1.3; no patch to dim the sun with AO (0.9 percent of pixels would change).
- **D-052:** camera azimuth 0 to 40 (was -35 to 35), distance 1.8 to 3.2.
- **D-036 to D-042:** mug (20 segments, barrel body, D handle), kettle (18 segments, cone body, hollow spout angled up, D handle), room details (four panes, no new materials, pages in `Mat_Frame`).

## 3. Contract changes (SPEC section 5)

Section 5 differs from the version at `da90c0b` in exactly these places:

1. **Wall height** 0.30 to 0.50 above the counter top (dated amendment, asked for by Manuel in slice 2.0, D-034).
2. **`UV_AO` and `room_ao.png`** (dated amendment, approved in advance for slice 2.4), plus an "As built" sentence listing the checks that the contract check performs (D-046). The older sentence "AO ... in slice 5 (amendment then)" was reworded to point at the amendment, because it contradicted it.

No names, parents, origins, markers or materials changed. Only marker positions moved (`Steam_*`, `Rays_*`, `Dust_*`, `Orbit_Target`).

## 4. Acceptance

Each slice was checked by its worker; the coordinator re-ran typecheck, lint, tests, build and the contract check after every slice and looked at the images.

| Slice | Result | Evidence |
|---|---|---|
| 2.0 Composition | pass | Contract check passes; whole diorama inside 1280 x 720; both steams at their markers; `comp-*.jpg`, `iso/front/side/top.png` |
| 2.1 Mug | pass | Mug 540 triangles, `Steam_Tea` exactly at the rim centre; `mug-*` and `mug-close-*` |
| 2.2 Kettle | pass | Kettle 888 triangles, `Kettle_1`/`Kettle_2` group intact, `Steam_Kettle` exactly at the spout opening; `kettle-*` |
| 2.3 Room details | pass | `Room` still one mesh, 1490 triangles; `Window_Glass` faces into the room, `Rays_Target` on the worktop; `room-*` |
| 2.4 AO bake | pass | Contract check requires `UV_AO` and fails on the old file; bake re-runnable (byte-identical PNG); AO on/off pair and diff; `ao-*` |
| 2.5 Light, shadows, camera | pass | Both shadow variants measured; camera clamp reads exactly the limits at all eight corner poses; `light-*` |

Budgets: 2940 triangles (target 30k), GLB 211 KB (limit 3 MB), AO texture 312 KB, 13 of 14 materials, 27 draw calls (limit 40).

## 5. History

```
85a02f4 Slice 2.5: lighting, shadows decision, camera tuning
aee749c Slice 2.4: AO bake pipeline
44bf459 Slice 2.3: room details
13eaee6 Slice 2.2: kettle
4a7c19b Slice 2.1: mug and tea surface
4a12ce5 Add close-up render script and mug close-ups
ec2a4b2 Phase 2 runs autonomously from slice 2.1; pre-approve the UV_AO amendment
85fb7b3 Slice 2.0: composition, variant A (counter in the corner)
```

Plus `513ba57` (reference set, made in a separate chat on `spec/visual-references`, already in this branch's history) and the review-fix commit. Any slice can be reverted alone, with the dependency order 2.0 to 2.5 in mind.

## 6. Open issues

- **Not verified on real hardware:** frame times are a proxy (the hidden browser pane runs `requestAnimationFrame` at 1 Hz, so the worker measured with back-to-back renders and a pixel read). Orbit and pointer were tested with synthetic events. Your laptop and the 4x CPU throttle check are still open (slice 3.3).
- **Looks weak, your call:** the plant is spiky like an agave; the steam reads fainter against the brighter wall; the shaded floor is a dark brown and the sun patch is small at hero distance; the cabinet side has no detail; at hero distance the books, handles and tin lid are tiny; the mug has a hard belly crease; the kettle is slimmer than in reference 01 (the contract fixes height and radius).
- **Repository size:** `review/phase-2` is about 26 MB (29 Workbench PNGs of 0.6 to 1.1 MB). The repo is about 31 MB. Shrinking it only helps if the history is rewritten before the first push (destructive, so not done). Recommendation: convert the PNGs to JPEG, rewrite the history once before adding a remote. Your decision.
- **Tone mapping change** (D-050) and the shadow default are outside what you asked for; both are one value in `look.ts`.
- **Phase 3 hints:** the shadow frustum is fitted to the morning sun and must be refitted for the evening preset; `Mat_Tea` colour must be damped on the cached material by name; the steam meshes need `raycast={() => null}` before the Mug click handler is added (see STATUS notes).
- **Notification:** push notifications reached your phone only if you saw one; the earlier test was suppressed while the app was active.
- **Next:** merge `phase/2-shapes` into `main` (it also brings the reference commit), then phase 3 (interaction, UI, release prep).
