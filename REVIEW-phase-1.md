# Review: phase 1 (Pipeline, blockout, steam on the model)


> Evidence images (`review/phase-1/`) were local only and are not in the repository. File names in this document are historical.

Branch `phase/1-blockout`, base `main` at 651df52. Five slices, one commit each. A fresh-context reviewer found no blockers; its three should-fix items (stale STATUS, overwrite guard in `01_blockout.py`, palette drift test) are fixed in the last commit.

## 1. Try this

Run `npm run dev` and open `http://localhost:5173/tea-nook/`.

1. **Orbit the diorama.** Drag to orbit, scroll to zoom. Azimuth is limited to +-35 degrees, polar 55 to 80, distance 0.8 to 1.6, no panning. Look at palette, light and framing. Reference:
2. **Move the pointer through both steams.** The steam bends away from the cursor. Reference pairs: `review/phase-1/steam-pointer-tea-on.jpg` / `-off.jpg` and `steam-pointer-kettle-on.jpg` / `-off.jpg`.
3. **Compare tea and kettle steam.** Same shader, kettle is 1.4 times as dense and 1.5 times as tall. It leaves the top of the hero frame. Is that too much?
4. **Open the Leva panel (top-right).** Each steam has its own folders. Change a value and watch it live. Add `?panel=0` to hide the panel.
5. **Try the camera presets** `?cam=front`, `?cam=side`, `?cam=top` (dev only; `side` and `top` are outside the orbit limits on purpose). Look from the top: the steam collapses into a smear (known limit).
6. **Look at the blockout previews** `review/phase-1/blockout-{iso,front,side,top}.png` and ask whether the proportions work as a base for phase 2.

## 2. Decisions

Full table in `DECISIONS.md`. Foundation first:

- **D-016** (foundation): Mug and Kettle origin check uses the centre of the underside, not the bounding-box centre.
- **D-023** (foundation): `01_blockout.py` builds from an empty factory state and must not be re-run against `nook.blend` once phase 2 edits it (it now refuses without `--force`).
- **D-009 / D-025** (planned in the SPEC, built in 1.4): the app sets contract material colors from `PALETTE` in `src/config/look.ts` by name (colour only; glass alpha comes from the model).
- **D-010** (accepted): section 5 sizes and budgets used unchanged.

Taste values to look at (all easy-to-change, all in `src/config/look.ts` or `steamDefaults.ts`):

- **D-026:** sun 2.4, hemisphere 1.6, background `#E9DFCB` (first values of 0.7 looked grey).
- **D-024:** hero view azimuth 25, polar 66, distance 1.12.
- **D-028:** kettle steam density x1.4, height x1.5.
- **D-020:** blockout layout (mug at the centre front, kettle back-right with the spout to the left, plant back-left, tin front-left, books back-centre).
- **D-021:** glass is see-through (alpha 0.35).

Others (D-013 to D-015, D-017 to D-019, D-022, D-027, D-029 to D-031) are implementation details, all `easy-to-change`, status `open` until you have seen them.

## 3. Acceptance

All criteria below were checked by the slice worker; the coordinator re-ran typecheck, lint, tests, build and the contract check after every slice, and looked at the screenshots.

| Slice | Result | Evidence |
|---|---|---|
| 1.1 Look config and harness | pass, one part only partly verified | Hex grep empty, `__nook` absent from `dist`, presets equal `CAMERA`, `pick(project('Mug'))` returns `Mug`, `?panel=0` hides Leva. "Ready within 5 s" could not be measured: the browser pane only renders while it is awake (measured 5.9 s and 18 s) |
| 1.2 Pipeline scripts | pass | Factory scene: contract check exits 1 with 27 errors, export exits 1 and writes nothing. Twin test fails when a parent in the `.py` is changed. `gen:model` verified on a throwaway GLB |
| 1.3 Scripted blockout | pass | Contract check 0 errors; GLB 49.7 KB, 724 triangles, 13 materials; `gen:model` twice gives no diff; fresh rebuild passes; GLB colours equal `PALETTE` (13 of 13). `review/phase-1/blockout-*.png` |
| 1.4 Scene | pass | Hero bounding box inside 1280x720, `Orbit_Target` at 640,360; limits hit exactly; `enablePan` false (synthetic right-drag only); runtime colours equal `PALETTE`; 14 draw calls. `review/phase-1/scene-*.jpg` |
| 1.5 Steam on the model | pass | Steam base equals marker world position; kettle uDensity 1.106 and uHeight 0.345 vs tea 0.79 and 0.23; `uPointerBlend` about 1 with the pointer over the steam and about 0 after leave (synthetic events); 16 draw calls, 3798 triangles. `review/phase-1/steam-*.jpg` |

Budgets (section 5): GLB 49.7 KB of 3 MB, 724 triangles of 30k target, 13 of 14 materials, 16 draw calls of 40.

## 4. History

```
404343f Slice 1.5: steam on the model
8bdabce Slice 1.4: scene with model, lights and camera
7d02510 Slice 1.3: scripted blockout
b0fb326 Slice 1.2: Blender pipeline scripts
c9dfa76 Slice 1.1: look config and verification harness
```

Plus the review-fix commit. Any slice can be reverted alone (1.4 and 1.5 depend on 1.1 to 1.3).

## 5. Open issues

- **Not verified:** the pointer push was tested with synthetic pointer events, not a real mouse; the right-button pan test was synthetic; the screenshot-based checks ran in the browser pane, not on your hardware. Frame rate was not measured (slice 3.3).
- **Kettle steam** leaves the top of the hero frame, and the hero view has only 18 px of margin at the bottom. Both are taste calls for you and for slice 2.5.
- **Dev only:** after a hot reload that remounts the model, `PointerProbe` keeps stale marker references; reload the page. `src/index.css` repeats the background colour from `look.ts`.
- **`nook.blend`** is tracked uncompressed (about 850 KB), so each phase 2 save adds a copy to history.
- **Not checked by the contract check yet:** `Window_Sky` size and offset, and the positions of `Rays_*`, `Dust_*`, `Orbit_Target`.
- **Notification:** I could not confirm that a push notification reaches your phone (the test was suppressed while the app was active).
- **Phase 3 hints** from the reviewer are in `STATUS.md` Notes.
- **Next:** with your OK, merge `phase/1-blockout` into `main`, then phase 2 (live Blender, you present). Reference images in `reference/` are still missing; please add 3 to 6 before phase 2.
