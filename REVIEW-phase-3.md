# Review: phase 3 (Interaction, UI and release prep)

> Fresh-context review of branch `phase/3-interaction` against `main` (commits `0c3c562` prep, `1ca3de5` 3.1, `d2e876f` 3.2, `1869400` 3.3, `1a64a75` 3.4), written 2026-11-19 by a reviewer who did not write the code. Evidence images are local in `review/phase-3/` (git-ignored, named below, not committed). Nothing in `src/`, `tools/`, SPEC, STATUS or DECISIONS was changed; this file is the only change.

**Verdict: PASS with should-fix items, no blockers.** The interaction loop works with real clicks in dev and in the production build, every budget holds, the code follows the CLAUDE.md rules with two small exceptions (nits), and the deploy workflow is well formed with existing action tags. The should-fix items are dead dev-panel controls, documentation drift, a dev-harness camera trap that explains the "odd camera pose" reports, a missing feedback on a same-bag click, and README claims that are not verified.

Counts: 0 blockers, 6 should-fix, 9 nits.

## 1. Findings

### Blockers

None.

### Should-fix

**S1. The Leva Tea folder shows colour, density and speed controls that no longer do anything (D-117).**
`src/nook/Steam.tsx:58` calls `applyLook(material, look, slot !== 'tea')`, so for the tea steam the store look's colour and density are skipped, and the tea speed comes from `dampAppearance`, not `look.speed`. `src/dev/DevSteam.tsx:10-12` still renders those three controls for both slots. Moving them changes `steamLooks.tea` and nothing on screen. For the product this is correct (the tea table is the source), but for the dev workflow it is a silent regression: Manuel cannot tune a tea's steam tint live any more and the panel suggests he can. Fix (either): hide the three controls in the tea folder, or make them edit the active `TEAS[teaIndex]` entry at runtime (dev only) and print the values to copy into `src/lib/teas.ts`. I would take the second, it keeps the tweak loop that CLAUDE.md asks for.

**S2. The camera trap behind the "odd camera pose" reports is in the dev harness, not in the app, but nothing protects against it.**
What I found (details in section 5): (a) drei's `OrbitControls` is the three-stdlib version, which uses no pointer capture and enters ROTATE on any `pointerdown` until a `pointerup` reaches the document; a `pointerdown` without its `pointerup` (a synthetic event from a test script, or one lost in the pane) turns every later plain mouse move into an orbit drag. I reproduced it: one synthetic `pointerdown`, then two hovers moved the camera from (25, 68, 2.3) to (40, 80, 2.3), a clamp corner; wheel zoom also still works in that state, so (0, 80, 1.9) is the opposite corner. (b) `applyPose` in `src/dev/DevHooks.tsx:150-158` lifts all orbit limits for an out-of-range pose (`?cam=side|top`, or `setCamera` with such a pose) and never restores them, so later drags in the same page can leave the allowed range ("rotated" views). Neither is phase 3 code, and nothing in the new code (hit boxes, overlay, `step`, hero 2.3, minimum 1.9) moves the camera. Fix: restore the limits in `applyPose` when the next pose is inside them (or on the next `setCamera`), and add a CLAUDE.md lesson: "pair every synthetic `pointerdown` with a `pointerup` on `document`; after a harness, reload before judging the camera".

**S3. Documentation drift after D-116 and the new dev hooks.**
SPEC still quotes the old camera: `SPEC.md:207` ("distance 1.8 to 3.2") and `SPEC.md:817` ("distance 1.8 to 3.2 m, hero (25, 68, 2.6)"); `look.ts` now has hero 2.3 and minimum 1.9 (D-116). CLAUDE.md's dev-hook list (`CLAUDE.md:99`) does not mention `step`, `useStore` or the new `stats()` fields (`materials`, `steamMaterials`, `programs`, ...). `STATUS.md:7` and `:10` still describe phase 2b as the current phase and next action, and the 3.4 row (`STATUS.md:36`) has "D-133 to D-135" in the Commit column. A dated one-line annotation in SPEC sections 6 and 10 and a CLAUDE.md line would fix it.

**S4. Clicking the already active tea bag gives no feedback, and D-125 says this case does not exist.**
`src/store/useStore.ts:46` ignores `setTea` for the current index, so the tea name does not show. D-125's reasoning ("a click always advances it, so every click changes `teaIndex`; a same-tea click does not exist") holds for the mug only. Verified: at hero with tea 0 active, a real click on `TeaBag_0` left `teaIndex` 0 and no `.tea-name` element. Fix (either): show the name again on a same-bag click (a click counter in the store, or an explicit `showTeaName` action), or keep the behaviour and correct D-125.

**S5. README claims that are not verified (SPEC 3.4: "No claims that were not verified").**
- `README.md:17` "Node 22 or newer": vitest 5.0.5 requires `^22.12.0 || ^24.0.0 || >=26.0.0` and eslint 10 `^22.13.0`, so Node 22.0 to 22.12 and Node 23 and 25 do not work (read from the installed `package.json` engines). Write "Node 22.13+, 24 or 26+". The workflow's `node-version: 22` resolves to the latest 22.x, so CI is fine.
- `README.md:26` "verifies ... materials and budgets": the contract check enforces the triangle cap and the material count (`contract_check.py:179`), not GLB size or draw calls.
- `README.md:33` "scroll or pinch to zoom": pinch was never tested (touch is slice 5.2).
- `README.md:39` "goes away with a later r3f update": a guess.
- `README.md:5` the Pages URL: plausible, unverifiable until a remote exists; say "should".

**S6. The steam column composition at the new hero (H1 and prep, visible in every phase 3 image).**
The taupe wall works (section 6), but at hero the kettle steam rises through the right edge of the red jar and past the shelf and rail ends, and at the closest corner (azimuth 40, polar 55, distance 1.9) it runs straight through the red jar (`rev-corner-az40-p55-d1.9.jpg`). The tea steam rises in front of the white hanging cups, where white-on-white loses it. D-115's clearance numbers are plan-view distances; on screen the overlap is a projection effect. Not a phase 3 code issue, but the steam is the star, so it needs a decision (open question 2).

### Nits

1. `src/nook/Steam.tsx:48`: `useRef({ color: new Color(), ... })` evaluates `new Color()` on every render of `Steam` (the initial value is discarded after the first). CLAUDE.md forbids allocations in render. Cost is nil (Steam re-renders only when the look changes); use a lazy init or a module-level factory.
2. `src/input/useHoverCursor.ts:40`: the mug handlers and the bag hit boxes each call `useHoverCursor()`, so two independent hover sets write the same `canvas.style.cursor`. It works because r3f fires `onPointerOut` before `onPointerOver`, but an unmount reset of one clears the cursor while the other is hovered. One set per canvas (module map keyed by element) would be cleaner. Verified by hand: hover on mug and on bag 2 gives `pointer`, leaving gives `''`.
3. `src/nook/Nook.tsx:55` and `src/nook/teaSelection.ts`: the bag rig finds the hit boxes by a global scene name (`TeaBagHit_i`). The pane console history from the implementation session contains 11 `TeaBagHit_0 is missing` errors from Fast Refresh; a fresh load is clean (I checked with a marker log and a reload). Letting `TeaBagHits` apply the bag's lift to its own boxes would remove the cross-component lookup.
4. `src/input/TeaInput.tsx:37`: hit box positions add the GLB node position directly, which assumes the `Model` group has an identity transform. True today; a comment or an assert would help.
5. `src/config/look.ts:29`: `PALETTE.Mat_Tea` is the literal `#8A4B2A`, equal to `TEAS[0].liquidColor` only by convention. If tea 0 changes, the tea surface fades in from the old colour for about 1 s at startup (the steam snaps, the surface does not). Derive it with `teaColor(0)` like the bags.
6. `src/ui/Overlay.tsx:38`: the `aria-live` element is remounted per change (`key`); screen readers announce changes inside an existing live region more reliably than a new one. Keep a persistent live region and key only the animated child.
7. Pointer cost: the handlers sit on the whole `Model` group, so r3f raycasts the model (Room's 12 meshes, about 6.9k triangles) plus four hit boxes on every pointer move. My CPU hit map took 2.5 s for 10,890 rays, about 0.23 ms per ray: fine on desktop, worth a look in slice 5.2 (mobile).
8. `src/dev/DevHooks.tsx:277-281`: `step()` also runs drei's OrbitControls frame callback (`controls.update()`), so it fast-forwards pending drag damping. At rest it is harmless (azimuth changed by 2e-6 degrees after `step(150)`); worth one sentence in CLAUDE.md.
9. At hero the right end of the hint pill (x 487 to 793, y 670 to 698 css px) touches the floor plinth's front corner (about x 784, y 672); at distance 1.9 the plinth runs out of the bottom of the frame and both pills sit on the floor (`rev-corner-az40-p55-d1.9.jpg`). The pill keeps the text legible (9.15 : 1 worst case, recomputed), so this is taste (open question 3).

## 2. Unlogged deviations (and half-logged ones)

Logged and checked present in `DECISIONS.md`: D-116 to D-135 (taupe wall, framing, AO skip for bag materials, damped appearance, input split, hit boxes, dev hooks, overlay look, CSS variables test, tea name, `sceneReady`, hint, stats readout, material count, frame-time harness, no code splitting, no fix in 3.3, action pins, workflow, YAML parser).

Not logged, or logged without calling it a deviation:

1. SPEC sections 6 and 10 still carry the old camera numbers (S3). D-116 logs the change; SPEC was not annotated.
2. CLAUDE.md's dev-hook list was not updated for `step`, `useStore` and the `stats()` fields (D-122, D-128).
3. Slice 3.2 touched files outside its scope (`vite.config.ts`, `src/scene/Scene.tsx`, `src/store/useStore.ts`). The content is logged (D-124, D-126), the scope step is not called out.
4. D-125's claim about same-tea clicks is wrong (S4).
5. The 3.2 loader criterion asks for a slow-3G throttle or a delayed GLB response; neither was done (the bar was caught mid-load). Logged in D-126 and STATUS as "not verified", so half-logged, fine.
6. 3.3 measured the production frame time with a back-to-back harness, not a real 10 s cadence. Logged (D-130), with the limits stated. Fine.

## 3. Checks I ran

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` | 10 files, 47 tests, all pass |
| `npm run build` | pass; one chunk 1,247.16 kB (gzip 345.11 kB), the known over-500-kB warning |
| `grep -r "__nook" dist` | prints nothing (exit 1) |
| `grep -r leva dist` | prints nothing (exit 1); `grep -ril` hits three's `sampleValues`, as before |
| `dist/index.html` | script and CSS under `/tea-nook/assets/`; the only model path in the bundle is `/tea-nook/models/nook.glb` (from `BASE_URL`) |
| Remote URLs | none in `index.html`, `src/ui`, `src/index.css`, CSS bundle (no `url(`); the JS bundle has library strings only. drei's Draco decoder URL (gstatic) is never fetched: the GLB uses no extensions |
| `vite.config.ts` | `base: '/tea-nook/'`; new `test.css.include` only affects vitest |
| Contract check (headless) | `0 error(s), 0 warning(s), 6894 triangles`, PASS; working tree stayed clean |
| GLB (own parser) | 383,184 bytes, 18 materials (all `Mat_*`), 6,894 triangles, no images, no extensions; `Mat_Tea` used only by `TeaSurface`, `Mat_Bag0` by `Room` and `TeaBag_0` |
| `deploy.yml` (`ruby -ryaml`) | parses; jobs `build` (checkout, setup-node 22 with npm cache, `npm ci`, typecheck, lint, test, build, configure-pages, upload-pages-artifact `dist`) and `deploy` (deploy-pages, `github-pages` environment); permissions `contents: read, pages: write, id-token: write`; trigger push to `main` and manual |
| `git ls-remote --tags` | `checkout` v7 (v7.0.0, v7.0.1), `setup-node` v7 (v7.0.0, v7.1.0), `configure-pages` v6 (v6.0.0), `upload-pages-artifact` v5 (v5.0.0), `deploy-pages` v5 (v5.0.0, v5.0.1): all pinned majors exist |
| Engines | vite `^20.19 \|\| >=22.12`, vitest `^22.12 \|\| ^24 \|\| >=26`, eslint `^20.19 \|\| ^22.13 \|\| >=24`: CI's Node 22 (latest) is fine, README's "22 or newer" is not exact (S5) |
| `package.json` / lockfile diff `main...HEAD` | no change (no new dependency) |
| Commit trailers | all 5 commits end with `Co-Authored-By: Claude Sonnet 5.5`; one commit per slice plus the prep commit |
| Dev server (5174), `?cam=hero&panel=0`, 1280 x 720 | ready flag set; camera (25, 68, 2.30) |
| `__nook.stats()` at hero | 40 draw calls, 16,698 triangles, 18 model materials + 2 steam materials, 6 programs, 24 geometries, 6 textures (equal to the 3.3 table) |
| Mug, real clicks at `project('Mug')` | `teaIndex` 1, 2, 3, 0 (wrap); camera unchanged |
| Bags, real clicks at `project('TeaBag_i')` | hero: 3, 2, 1, 0; azimuth 40: 3, 2, 1, 0 |
| Hit areas (CPU raycast map emulating r3f's propagation) | hero: 541 to 581 px per bag, about 15 x 40 px each (phase 2b review: 10 to 17 px wide); azimuth 40: 470 to 584 px; the real clicks at each projected centre (rows above) all selected the right bag |
| Clicks elsewhere | empty background and counter top (`pick` = `Room_2`): `teaIndex` unchanged |
| Drag from the mug (about 19 css px) | `teaIndex` unchanged, azimuth 25 to 15.5 (the drag orbits) |
| Drag over the title | azimuth to 0 (clamped); `elementFromPoint` over the title is the `CANVAS`, title `pointer-events: none` |
| Hover | mug and bag 2: `cursor: pointer`; background: `''` |
| Tea name | appears ("Green") on a mug click, opacity 0 at start, 1 at 0.15 s animation time, 0.056 near 2.75 s (the pane throttles the animation clock; the implementer's seek-based read gave 0 / 1 / 0) |
| Same-bag click | no name, `teaIndex` unchanged (S4) |
| Tea converge | after `step(150)` the tea uniforms equal the `TEAS` values (green: colour e3efdc, density 0.6; hibiscus f3d5dc, 1.0); I did not re-sample the monotone curve (implementer: largest step 6.4 %, bag 12.5 %) |
| Contrast (recomputed from colours) | title on page 10.06 : 1; hint on the pill over the darkest floor 9.15 : 1; text on the taupe wall would be 3.45 : 1 (it never sits there at 1280 x 720) |
| Loader, dev reload | visible with the bar early in the load (`rev-loader-dev.jpg`), removed after ready |
| Production (`npm run preview`, then stopped) | `/tea-nook/` 200; JS, CSS, `models/nook.glb`, `models/room_ao.png` all 200 under `/tea-nook/`; `window.__nook` undefined; loader removed after load; a real mug click shows "Green" (`rev-prod-click-green.jpg`); console only the `THREE.Clock` warning |
| Console, fresh dev load | only the `THREE.Clock` warning (older errors in the buffer are from HMR, nit 3) |
| Camera investigation | see section 5 |

Code rules (CLAUDE.md), read in the diff: no `any`; selectors only (`sceneReady`, `teaIndex`, `steamLooks[slot]`; nothing subscribes to pointer fields, grep); no `setState` in any `useFrame` (`ReadySignal` calls a store action once, outside React state, after two frames); per-frame code allocates nothing (`Color.set(string)` only when the index changes); `Steam.tsx:48` allocates in render (nit 1); mug and bag handlers call `stopPropagation()` (the mug only for hits inside `Mug`, by design D-120), cursor resets on leave and on unmount; created resources: hit box geometry and material are JSX (r3f disposes them), the AO texture is disposed, nothing else new; assets from `assetUrl` (`BASE_URL`); uniforms mutated in place (`dampAppearance`, `applyLook`), helpers outside components per the react-hooks lesson; no remote URLs.

## 4. Numbers spot-checked (slice 3.3)

| Item | STATUS (3.3 table) | Mine | Match |
|---|---|---|---|
| Draw calls at hero | 40 | 40 | yes |
| Triangles in the app at hero | 16,698 | 16,698 | yes |
| Triangles, contract check | 6,894 | 6,894 (check and GLB indices) | yes |
| Materials | 18 + 2 steam = 20 | 18 model (GLB and `stats()`), 2 steam | yes |
| GLB size | 383,184 bytes | 383,184 bytes (`ls`, parser) | yes |
| `room_ao.png` | 327,127 bytes | 327,127 bytes | yes |
| Production JS | 1,247.16 kB, gzip 345.11 kB | same | yes |

Material count (D-129): I agree that the budget is 18 of 20. The 2026-11-06 amendment counts contract materials ("13 + 5 = 18"), `contract_check.py:179` enforces `MAX_MATERIALS = 20` on the contract materials, and every earlier budget table reported 18 without the steam. The renderer cost is the 6 programs, not the material count. If Manuel wants the steam counted, the budget text should say so; there is headroom of 2 either way only if it is not counted.

Frame time: not re-measured (the pane is a proxy and the harness was throwaway, D-130). The 60 fps and 4x CPU throttle check stays for Manuel.

## 5. The camera question

Two implementers saw an odd pose once (azimuth 0, polar 80, distance 1.9; and a "rotated" view after a benchmark harness) and could not reproduce it. What I checked:

- **New code does not write the camera.** The only camera writes are `frameCamera` (once on mount, guarded by `framed`) and the dev hooks `applyPose` / `settle`. The overlay is `pointer-events: none` (verified: drags over the title orbit). The hit boxes and the mug handlers live in r3f's event system; r3f's `stopPropagation()` stops only r3f propagation, not the DOM event, and the controls listen on the canvas DOM element and the document. Verified: a drag that starts on the mug orbits normally. Plain hovers with nothing pending do not move the camera (control run: two hovers, camera stayed at 25, 68, 2.3).
- **`step()` cannot add rotation.** It runs every frame callback, including drei's `controls.update()`. With damping, `update()` applies a decaying share of the pending rotation, so extra calls only finish a drag that is already in progress (measured: 2e-6 degrees after `step(150)` at rest). The 3.3 production harness ran the r3f frame callback in tight batches, which does the same.
- **Reproduced mechanism.** drei uses three-stdlib's `OrbitControls` (not three's `examples/jsm` version): no pointer capture, ROTATE starts on `pointerdown` and ends only on a `pointerup` at the document, and the wheel still zooms while rotating. I dispatched one synthetic `pointerdown` (pointerId 1, no `pointerup`) and then moved the real mouse twice: the camera went from (25, 68, 2.3) to (40, 80, 2.3), the clamp corner. Moving the other way gives azimuth 0 and polar 80, and a wheel step during it gives distance 1.9. A synthetic `pointerup` ended it. That is exactly the kind of pose reported: a clamp corner, after scripted input.
- **Second dev-only path.** `applyPose` lifts all limits for out-of-range presets and never restores them (S2), so after `?cam=side|top` or `setCamera` with such a pose, drags can go beyond the limits.

Conclusion: most likely a test-harness artifact (stuck ROTATE from an unpaired synthetic `pointerdown`, or lifted limits), not app behaviour. For a real user the risk is low: Chrome keeps delivering mouse events to the document during a drag that started on the page, so the `pointerup` arrives even when released outside the window. I did not test Safari or Firefox.

## 6. What the screenshots show

- `rev-hero.jpg` (pane, 1280 x 720 shown at 800 x 450): title top-left on the cream page, hint pill bottom-centre, the whole diorama inside the frame with tighter margins than in phase 2b (Room bounding box x 299 to 944, y 68 to 697 css px). The taupe walls frame the white cabinet, the mint kettle and the terracotta cup well; both steams read clearly against the wall.
- `rev-tea-0.jpg` to `rev-tea-3.jpg` (`__nook.snapshot()`, 2560 x 1440 canvas only, after `step(150)`): Earl Grey (brown surface, cream steam, brown bag lifted), Green (yellow-green surface, pale green steam, green bag lifted), Chamomile (gold surface, pale yellow steam, yellow bag lifted), Hibiscus (red surface, pink steam, red bag lifted). The four tints are distinguishable on the taupe wall; Hibiscus reads best, Green is the faintest (density 0.6 and a grey-green tint). The lifted bag is visible at the 2x crop but only a few pixels at 1x. The kettle steam crosses the right edge of the red jar and the shelf and rail ends; the tea steam passes in front of the white hanging cups and gets lost there (S6).
- `rev-hero-green-overlay.jpg`: hero with the overlay after the Green selection; text colours and pills are unaffected by the wall because they sit on the page background or on their own pill.
- `rev-corner-az40-p55-d1.9.jpg`: the closest orbit corner. Jar tops about 29 px below the top edge (clear), the floor plinth runs out of the bottom edge and both pills sit on the floor (nit 9); the kettle steam runs through the red jar.
- `rev-loader-dev.jpg`: loader with the title and an early progress bar on the cream page.
- `rev-prod-click-green.jpg`: production build after a real mug click, "Green" fading in above the hint.

Wall colour (D-116), my judgement: it works. The steam now has the contrast that the phase 2b review asked for, the overlay text is never on the wall (title 10 : 1 on the page, hint 9 : 1 on its pill), and the four tea tints stay distinct. The taupe is darker and moodier than the cream references; with the cream page around it the diorama reads as a lit box, which suits a portfolio piece. The remaining readability problems are the steam crossing the jar and the white cups, not the wall.

## 7. Try this (for Manuel)

Run `npm run dev` and open `http://localhost:5173/tea-nook/?panel=0` (Leva hidden), or `npm run build && npm run preview` for the production build at `/tea-nook/`.

1. Click the mug four times: Earl Grey, Green, Chamomile, Hibiscus, back to Earl Grey. Watch the steam tint, the tea surface and the lifted bag change smoothly (about 1 s), and the name fade in and out above the hint.
2. Click each tea bag directly, at the start view and after orbiting fully to the right. Then click the bag that is already active: nothing happens (S4, your call).
3. Hover the mug and a bag (pointer cursor), then start a drag on the mug: it orbits, it does not change the tea. Drag across the title: it orbits too.
4. Reload with DevTools open, Network throttled to "Slow 3G": the loader bar should fill and fade out (not tested in the pane).
5. On your laptop in Chrome: check about 60 fps in the Performance panel, then repeat with CPU 4x slowdown (SPEC section 8). Not measurable in the pane.
6. Zoom fully in at the right orbit limit and look at the kettle steam against the red jar, and at the tea steam in front of the white cups (S6, question 2). Then decide on the hint pill over the floor at close zoom (question 3).
7. When you are happy: add the remote (`git remote add origin ...`), enable Pages with Source "GitHub Actions", merge to `main` and push; the workflow runs typecheck, lint, test and build before deploying.

## 8. Open questions for Manuel

1. **Leva tea controls (S1).** Hide the dead colour, density and speed controls in the Tea folder, or make them edit the active tea live (dev only)? I recommend live editing of the active tea, so the tweak loop for the star effect is back.
2. **Steam against the jar and the cups (S6).** Options: shift the shelf and rail back to the left (part of the 35 mm from H1) so the kettle column passes beside the red jar on screen; swap the jar order so a lighter jar stands next to the steam; give the hanging cups an existing darker material (for example `Mat_Kettle` sage; `Mat_Frame` is shared with the window and the saucer, so it cannot simply change) so white steam reads in front of them. My recommendation: shelf about 20 mm back to the left and sage hanging cups (a model change with existing materials, no contract change), then re-check at hero and the right corner.
3. **Hint pill at close zoom (nit 9).** Accept the pill on the floor at close zoom, fade the hint after the first interaction (D-127 alternative), or nudge the hero framing up a little? I recommend fading the hint after the first successful click; it also frees the bottom for the tea name.
4. **Same-bag click (S4).** Show the tea name again when the active bag is clicked? I recommend yes (cheap and it confirms the click).
5. **Materials budget (D-129).** Agree that the 20-material budget counts contract materials only (18 now)? I agree with the implementer.
6. **Dev harness fix (S2).** Approve the small `applyPose` change (restore limits) and the CLAUDE.md lesson? It removes the false camera reports.

## 9. Not verified

- 60 fps and the 4x CPU throttle on Manuel's laptop; no frame time re-measured by me.
- The loader under a real slow-3G throttle (only an early bar on reload in dev).
- The deploy workflow on GitHub (no remote); the Pages URL in the README.
- The monotone damping curve over time (I checked the end values and the implementer's numbers, not the curve).
- Safari and Firefox (the camera conclusion is for Chrome).
- Touch input and pinch zoom (phase 5).
- Window sizes other than 1280 x 720 (for example narrow windows where the title could sit over the taupe wall at 3.45 : 1).
- `npm run gen:model` and the Blender export (not run; they write into `src/` and `public/`).
