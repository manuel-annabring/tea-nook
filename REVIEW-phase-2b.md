# Review: phase 2b (Details: back wall, tea box, cup and kettle polish)

> Fresh-context review of branch `phase/2b-details` (commits `f9cbd51` to `033f584`, D0 to D5), written 2026-11-06 by a reviewer who did not write the work. Evidence images of the slices (`review/phase-2b/`) are local only and not in the repository; this review used its own checks and one live look at the app. Nothing was fixed, no code, script, model or SPEC file was changed.

**Verdict: PASS with should-fix items, no blockers.** The contract, the GLB, the budgets and the pipeline are in good shape; every number I spot-checked matches STATUS.md. One SPEC criterion (shelf shadow) is knowingly unmet and needs Manuel's decision, and one latent coupling (Room AO map on the shared `Mat_Bag0..3` materials) works only by coincidence.

Counts: 0 blockers, 6 should-fix, 7 nits.

## 1. Findings

### Blockers

None.

### Should-fix

**S1. The Room AO map is applied to the tea bag meshes, which have no `UV_AO` (works by luck).**
`src/nook/roomAo.ts:12-20` (`roomMaterials`) and `:39-45` (`applyRoomAo`) set `aoMap` (texture channel 1) on every material under `Room`. Since D1, `Room_9..12` use `Mat_Bag0..3`, and glTF shares those materials with the separate `TeaBag_0..3` meshes (checked in the GLB: `TeaBag_i` has only `POSITION/NORMAL`, no `TEXCOORD_0` or `TEXCOORD_1`). The bags therefore read the AO texture with a constant default `uv1` of (0, 0). That is harmless today only because the texel at (0, 0) of `public/models/room_ao.png` is pure white (I read `getpixel((0,0))` = (255, 255, 255)); the bake writes white at the border, but nothing guarantees it. D-093 avoided exactly this trap for `Mat_Mug` ("applyRoomAo would put the Room AO map on the mug") but the same reasoning was not applied to the bags and no decision records it.
Fix (either): in `applyRoomAo` skip, or later detach, the AO map on materials that are also used by a mesh without `uv1` (or clone the bag material per bag); or add a unit test that asserts the (0, 0) texel is white and log the coupling in `DECISIONS.md`. Also note for slice 3.1: any colour change on `Mat_Bag<i>` (for example a highlight of the active bag) also recolours the jar.

**S2. SPEC criterion D5 "the new shelf shadow on the back wall reads as a soft shadow" is not met (D-111).**
Confirmed by reading `look.ts:69-77`: sun position (-1.123, 1.0, -0.02) in glTF axes. The back wall's normal is glTF +Z and the sun's z component is -0.02, so the sun does not light the room-side face of the back wall at all (N dot L is slightly negative); the front fill does not cast. No shelf, jar or frame shadow can appear on that wall. See "Open questions" for my recommendation (waive and reword).

**S3. Steam readability at the hero view is weaker than D-112 says.**
In the 3x crop of the hero snapshot (`__nook.snapshot()`, 2x pixel ratio) the kettle steam is a thin, pale-grey wisp on the cream wall and the tea steam is only a little stronger; in the plain 1280 x 720 pane screenshot I could see the tea steam but only just the kettle steam. This is the known D-070 issue, not a regression, and nothing hides a steam. But the SPEC criterion says "shows both steams clearly" and the steam is the star of the project. Suggest a decision before phase 3 (whiter or slightly more opaque steam colour, or a slightly darker wall behind it), see open questions.

**S4. The "each bag can be hit" evidence only tests the projected centre; the real hit areas are small.**
At the hero pose each packet is only about 10 to 17 px wide and 33 px high on a 1280 x 720 view (12 px pitch between the centres of neighbours; I sampled the projected bounding box of each bag with `__nook.pick`). At azimuth 40 / polar 60 the neighbour covers 25 to 45 % of a bag's bounding box (an edge-on view of the 22 mm wide, 30 mm pitch packets). The centre pixel is hit for every bag at all poses (re-verified: hero, azimuth 0 and 40), so the D3 criterion as written is met, but a mouse user will mis-click and touch devices (slice 5.2) will not work. Plan for slice 3.1: an invisible larger hit proxy per bag, or accept and tune the pitch; `contract.ts` does not need to change for a proxy that lives in code.

**S5. SPEC text and the as-built model disagree in three places that were logged only in `DECISIONS.md`.**
(a) `SPEC.md:500,502` and the amendment at `SPEC.md:184` still say pictograms use `Mat_Mug` (and `Mat_Kettle`), the built model uses `Mat_Pot` (D-093). (b) The layout table (`SPEC.md` tea bag row) still says 0.050 deep, built 0.040 (D-097). (c) Saucer "about 0.006 high" versus built 0.008 (see unlogged deviations). A reader of SPEC alone gets the wrong picture; CLAUDE.md says SPEC is the source of truth. Fix: annotate the table rows with "as built" notes (a dated line, no contract change).

**S6. Mixed-in test gap: the new `TeaBag` branch of `applyShadowFlags` is untested.**
`src/nook/shadows.ts:21-26` throws for a missing bag and sets `castShadow` from `SHADOW.teaBagsCast`; there is no `shadows.test.ts`. A stub-scene test (like `contract.assert.test.ts`) with a missing `TeaBag_2` and with `teaBagsCast: false` would take 10 lines. Not a blocker, but the D-099 decision lives only in this branch.

### Nits

1. `src/config/look.test.ts:46-50` ("derives the jar and tea bag colours from TEAS") is a tautology: `PALETTE.Mat_Bag<i>` is computed from `TEAS[i].liquidColor` in `look.ts`, so the test cannot fail. The real guard is the existing "matches the Blender-side defaults" test, which now also reads `NEW_MATERIAL_COLORS` from `04_room.py`. Only `expect(TEAS.length).toBe(4)` has teeth. Keep it, but do not count it as a drift guard.
2. `tools/blender/steps/03_kettle.py:28` (`DETAIL_HEX = "#3D3A38"`) duplicates `PALETTE.Mat_KettleDetail` with no test (the existing test only compares `01_blockout.py` and `NEW_MATERIAL_COLORS`). Add `03_kettle.py` to the palette test, or have the test grep `DETAIL_HEX`.
3. `tools/blender/steps/08_tea_bags.py:73-82` (`steam_radii`) is a second regex parser of `steamDefaults.ts`, next to `steam_columns()` in `04_room.py`. It reads only the radius, so no formula drift, but one parser would do (the shared `tea_layout.py` is a natural home).
4. `tools/blender/steps/04_room.py:1068` still encodes the saucer as 0.006 high in `expected_boxes`; the built part is 0.008, passes only because of the 5 mm tolerance. Update the number (or the layout table) so the check is meaningful.
5. The D2 pictograms use `Mat_Pot` (D-093); the cup in the frame is a flat silhouette and reads well, but both brown/terracotta pictograms use the same material as the plant pot, so a later palette change to the pot also changes them. Fine for now, mention in the next palette round.
6. `contract_check.py` checks bag origin, material and parent, but not the bag position or that `Mat_Bag<i>` is also in `Room`; both are enforced by `04_room.py`/`08_tea_bags.py` asserts, so this is fine, just not in the contract check. (Negative test below.)
7. Console buffer: the pane's console history contains four `Cannot read properties of undefined (reading 'geometry')` errors from `NookModel.generated.tsx` with timestamps about 25 minutes before my load. They come from hot reload in a half-edited state (see the CLAUDE.md lesson) and are not from the current code; my fresh load printed only the known `THREE.Clock` warning.

## 2. Unlogged deviations (and half-logged ones)

Known and logged (checked, all present in `DECISIONS.md`): `Mat_Pot` for cup and heart pictograms (D-093), bag depth 40 mm (D-097), sage kettle lid (D-106), `Mat_KettleDetail` colour (D-107), opaque jars (D-085), bags do not cast (D-099), shelf shadow (D-111).

Not logged, or logged without calling it a deviation:

1. **Saucer height 8 mm versus the layout table "about 0.006".** D-105 states 8 mm but does not say it differs from the table, and `expected_boxes` still uses 0.006 (within the 5 mm tolerance, so the check passes silently).
2. **`Nook.tsx` is not changed, although the D1 and D3 scope lists it** ("apply the palette", "find the bags by name, assert in dev"). The behaviour is covered by the generic `applyPalette`, `assertContract` (via `REQUIRED_NODE_NAMES`) and `applyShadowFlags`. Benign, but a scope deviation without a line in `DECISIONS.md`.
3. **The Room AO map reaches `Mat_Bag0..3` and the bag meshes** (S1): the D-093 reasoning for `Mat_Mug` was not applied here and nothing is logged.
4. **D-107 touches an explicit "out of scope" item of D4** ("palette changes ... stay"). It is logged, but the SPEC D4 text is not annotated.
5. **The amendment text says the jars hold "contents" in `Mat_Bag0..3`** (glass body plus 0.060 contents). With opaque jars (D-085) the whole body is `Mat_Bag<i>`. Logged in D-085, not reflected in the amendment text (S5 family).
6. **CLAUDE.md "Lessons learned" gained two entries** (`tube()` frames, transparent-in-Room sorting). Allowed by the file's own rule, no problem; mentioned for completeness.

Layout-table comparison (constants of `04_room.py` and `tea_layout.py` against SPEC): shelf, brackets, jars (x, y, diameter, body, lid), rail, hooks, hanging mugs (54 x 70, top 0.195), frames A/B/C (x, z, 15 mm deep, 8 mm border), tea box (centre and size), bag x positions, mug and kettle positions all equal the table. Exceptions are the three in this section and S5.

## 3. Checks I ran

| Command | Result |
|---|---|
| `npm run typecheck` | pass, no output |
| `npm run lint` | pass, no output |
| `npm test` | 8 files, 43 tests, all pass |
| `npm run build` | passes; one chunk 1241.30 kB (gzip 343.08 kB), the known over-500-kB warning |
| `grep -r "__nook" dist` | prints nothing |
| `grep -r leva dist` | prints nothing |
| `$B -b tools/blender/nook.blend --python tools/blender/contract_check.py` | `0 error(s), 0 warning(s), 6716 triangles`, PASS; the working tree stayed clean |
| Negative test on a copy (shifted `TeaBag_1` origin by 10 mm, wrong material on `TeaBag_2`, `TeaBag_3` parented to `Mug`) | three errors: `TeaBag_1: origin must be at the center of its base`, `TeaBag_2: must have exactly the material Mat_Bag2 (has ['Mat_Bag3'])`, `TeaBag_3: must be top-level (is child of Mug)`. The check really enforces origin, material and parent |
| Re-run pipeline on a copy in the scratchpad: `08` twice, `04 --force`, `05` (PNG to a scratch path), contract check | no `.001` names (`08` run twice), contract check PASS (6716 triangles), regenerated AO PNG md5 `34cac6b14df0707a86dac36f04810f0e` equals the committed `room_ao.png` (byte-identical) |
| `git ls-files` filtered for `.blend`, `review/`, images | only `tools/blender/nook.blend` and `public/models/room_ao.png`; `.gitignore` covers `*.blend1`, `review/`, `reference/*` |
| `git log main..HEAD` trailers | all 7 commits carry `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` |
| `package.json` / lockfile diff `main..HEAD` | no change (no new dependency) |
| Dev server (port 5174, existing), `?cam=hero&panel=0`, ready flag set | `stats()`: 40 draw calls, 16342 triangles; `benchmark(1000)` 1.879 ms per frame; `materialColors()` shows `Mat_Bag0..3` = 8A4B2A, B5B84A, E0B84A, B3213F (`TEAS`), `Mat_KettleDetail` 3D3A38, 18 names; `pick` at the projected centre returns `TeaBag_0..3` correctly at hero |

I also read the diffs of `04_room.py`, `08_tea_bags.py`, `02_mug.py`, `03_kettle.py`, `05_ao_bake.py` (two lines), `tea_layout.py`, `contract_spec.py`, `contract_check.py`, `contract.ts`, the tests, `look.ts`, `shadows.ts` and the generated model component.

Code rules (CLAUDE.md) in the TypeScript changes: no `any`; no allocations in `useFrame` (no frame code was touched); hex colours only in `look.ts` (`Mat_Iron`, `Mat_KettleDetail`; bag colours derived from `TEAS`); no `BASE_URL` change needed (no new asset URL); no new disposables; dev hooks untouched and stripped (grep above); Zustand untouched. Blender scripts: re-runnable (`--force`, `setup_extra_slots`, stray `.NNN` removal in `08`), deterministic AO (md5 above), write only to the given output path or the defaults in `tools/blender/` and `public/models/`. Steam numbers are read from `steamDefaults.ts` and the width formula is asserted against `steamMath.ts` (a real drift guard).

## 4. Numbers spot-checked

| Item | STATUS.md | My measurement | Match |
|---|---|---|---|
| Triangles, contract-checked model | 6716 | 6716 (contract check) and 6716 (index counts of the GLB) | yes |
| GLB size | 406012 bytes | 406012 bytes (`ls`, and file length in my GLB reader) | yes |
| Materials | 18 | 18 in the GLB (list below) | yes |
| `room_ao.png` | 322709 bytes, 1024 x 1024 | 322709 bytes, 1024 x 1024 RGB | yes |
| Draw calls with shadow pass at hero | 40 | 40 | yes |
| Triangles in the app at hero | 16342 | 16342 | yes |
| Average frame | 1.889 / 1.881 ms | 1.879 ms (benchmark 1000 ms, 533 frames) | yes |

GLB inspection (glTF JSON chunk): nodes `TeaBag_0..3` exist, no parent, one mesh each with exactly `Mat_Bag0..3`, translation (0.145 / 0.175 / 0.205 / 0.235, 0.015, 0.15) in glTF axes (base z 0.015 Blender); `Room` is one mesh with 12 primitives (the 7 old materials, then `Mat_Iron`, `Mat_Bag0..3`); `Kettle` is one node with a mesh of two primitives (`Mat_Kettle`, `Mat_KettleDetail`; three builds the group `Kettle_1`, `Kettle_2`, as the generated component shows); no images or textures in the GLB. The 18 materials: `Mat_Kettle`, `Mat_KettleDetail`, `Mat_Tea`, `Mat_Mug`, `Mat_Wall`, `Mat_Wood`, `Mat_Frame`, `Mat_Leaf`, `Mat_Pot`, `Mat_Tin`, `Mat_Book`, `Mat_Iron`, `Mat_Bag0..3`, `Mat_Glass`, `Mat_Sky`. Contract objects, parents (`TeaSurface`, `Steam_Tea` under `Mug`; `Steam_Kettle` under `Kettle`) and marker names are as in `contract_spec.py` and `contract.ts` (twins in sync: the twin test passes and I compared both lists by eye).

## 5. What the screenshots show

Hero (`?cam=hero`, 1280 x 720): the whole diorama is inside the frame with plenty of empty margin (it fills about 44 % of the width); left wall with the window and the hanging plant, back wall with the shelf (four jars brown, green, yellow, red), the rail with four white hanging mugs, three picture frames on the right (cup, leaf and heart are all readable; the cup has a saucer), a retro mint kettle with a black base plate, ring, knob and handle, a terracotta teacup on a white saucer, a small wooden tea box with four coloured packets, books and the tin, floor plant at the right. A warm sun patch with the window cross lies on the worktop. At the default size the details are small: jars about 4 px apart in colour, hanging mugs about 14 px wide, bags about 12 px apart. Closer look (distance 0.75 and a 3x crop of the hero snapshot): no clipping, no floating parts, no visible z-fighting, no part intersecting the steam columns; the cup sits on the saucer; the shelf's left end touches the window casing (3 mm overlap, hidden). The packets read as small gabled "houses", with a tiny pointed tab at the front; fine as a taste call but a bit chunky. Kettle steam passes to the right of the shelf end and close to the red jar; at azimuth 15 to 25 it overlaps nothing but is very faint on the cream wall (S3). Tea steam rises from the saucer-mounted cup and is visible but faint.

## 6. Phase 3 readiness (slice 3.1)

Good: `TeaBag_i` origin is at the base (verified in the GLB translation y 0.015 and the contract check), transforms applied, no parent, lookup by name works (`getObjectByName('TeaBag_2')`, throws if missing in `applyShadowFlags`), `TEA_BAG_NAMES` is exported from `contract.ts`, `SHADOW.teaBagsCast` exists, the slot is 30 mm deep so a 15 mm lift leaves 15 mm in the slot and 45 mm above the rim, and nothing sits above the box. The dev `pick` skips transparent meshes; the steam columns are x of the cup (about 0) and the kettle spout, 100 mm or more from the bags, so no steam mesh lies between the camera and a bag at azimuth 0 to 40.

Will bite or needs care:
- S1 (AO and shared material) and the shared `Mat_Bag<i>` with the jars when highlighting a bag.
- S4: the hit area. r3f raycasts only objects that have handlers, so a handler-less `Room` or `Kettle` in front of a bag will not block a click (the dev `pick` is stricter than r3f here), while the `Mug` (with a handler) does cover about 120 px of `TeaBag_0` at azimuth 40 / polar 75 / distance 1.8: its `stopPropagation()` must be right.
- The previous reviewer's hints still stand: give `SteamMesh_*` `raycast={() => null}` before the first handler is added, reset the cursor on leave and unmount. `PointerProbe` caches marker lookups (stale after a hot reload).
- The AO map has contact darkening baked under the bags (D-102): after a lift a small dark patch stays in the slot. Fine, it reads as a shadow.

## 7. Try this (for Manuel)

Run `npm run dev` (open `/tea-nook/`, add `?cam=front` for the front view and `?cam=hero&panel=0` for the clean hero).

1. Orbit from azimuth 0 to 40 (the full allowed range) and look for anything crowding the steam: does the kettle steam stay clear of the shelf end and the red jar?
2. Hover the pointer through both steams (tea above the cup, kettle above the spout): the swirl must still react.
3. Look at the jars (four colours in the tea order brown, green, yellow, red), the four hanging mugs, the three frames (cup, leaf, heart) and the tea box with four packets. Are the packets what you want (they look like small gabled sachets)?
4. Look at the cup on its saucer and the retro kettle against reference 01 and the tea-station photo. The cup is rounder and wider; the lid is sage (not graphite as in the photo).
5. Compare `?shadow=off` with the default: the shelf throws no shadow on the back wall (see question 1), only baked contact darkening.
6. At hero, can you see both steams clearly? (question 2)
7. Try `?cam=front` and `?cam=side`: nothing should clip or float.

## 8. Open questions for Manuel

1. **Shelf shadow (SPEC D5 criterion, D-111).** The sun at azimuth -91 runs parallel to the back wall and its z component (-0.02) points slightly away from the wall's room-side face, so that wall is never lit by the sun and cannot show a shelf, jar or frame shadow; moving the sun in front of the wall (the F5 position at -58, which Manuel rejected as "coming through the front wall") would grazing-light the wall and still depends on the left wall and window casing. A second shadow-casting directional fill would cost a second shadow pass (about 10 to 20 more draw calls, at the 50 budget limit) and a lighting look nobody asked for. **My recommendation: waive and reword the criterion** to "the shelf, jars, rail and frames show baked contact darkening on the wall (AO)", which is what exists and looks right. If a drop shadow is wanted later, bake a soft fake directional term in `05_ao_bake.py` (no runtime cost), as a separate small slice.
2. **Steam readability.** Do you want the steam made more visible before phase 3 (whiter or slightly more opaque steam colour, or a slightly darker wall behind the kettle steam), or keep it as it is and decide in slice 3.3 or phase 4? My recommendation: a small tuning step in `look.ts` (values only) at the start of phase 3, with your picks in the widget.
3. **Hero framing.** The diorama fills 44 % of the 1280 px width and the details are small (hanging mugs 14 px, bags 12 px pitch); the closest orbit corner leaves only 5 px above the jar tops (D-110). A default distance of about 2.3 instead of 2.6, with a minimum of 1.9, would help both. Your call (taste); I would try 2.3 with the minimum raised to 1.9.
4. **Tea bag hit area (S4).** Accept the 10 to 17 px targets, or give slice 3.1 an invisible larger hit proxy per bag? I recommend the proxy.
5. **S1 fix.** Approve a small code change in `roomAo.ts` (skip materials used by meshes without `uv1`) so the bags no longer depend on texel (0, 0) being white?
6. **Merge.** After your review the branch can be merged into `main` (no remote, so a local merge); the old history bundle `tea-nook-before-rewrite.bundle` is still next to the project folder.

## 9. Not verified

- The production build was not opened in a browser (only built and grepped); the frame time is from the dev server in the built-in pane, not from your laptop with a 4x throttle.
- I did not run `npm run gen:model` or the Blender export (they would write into `src/` and `public/`); STATUS.md reports byte-identical results, and the committed GLB and generated file are consistent with each other (the generated component lists the same nodes and materials as the GLB).
- Eight orbit corners and the shadow frustum were not re-measured (only hero and a few close poses were looked at).
