# Review: phase 4 (Extras: light)

> Branch `phase/4-light` (base `b8a1e92`, slice 4.0), written 2026-11-28. Slices 4.1 to 4.5 ran autonomously. A fresh-context reviewer who did not write the code checked the phase at `b3b2323`. Evidence images and logs are local in `review/phase-4/` (git-ignored, named below, not committed).

**Verdict: ready for your review, no blockers.** All slice criteria are met, some with caveats (section 3). The reviewer found one should-fix item and one unverified README claim; both are fixed in `d809bb3`. Nothing is merged into `main` and nothing is deployed. Phase 5 is not started.

## 1. Try this

Start the dev server on this branch:

```bash
npm run dev
```

Open `http://localhost:5173/tea-nook/` (add `?panel=0` to hide the dev panel).

1. Click the "Evening" switch (top right) several times, also in the middle of a transition. The blend should turn around smoothly. Watch the title: it is hard to read for a blink in the middle (D-152). Screenshots: `s4.2-walk-live-montage.jpg`, `s4.2-evening-hero.jpg`.
2. Orbit in both looks and watch the window rays and the dust. Morning rays are deliberately subtle. Screenshots: `s4.3-morning-azimuths.jpg`, `s4.3-evening-azimuths.jpg`, `s4.4-morning-hero.jpg`, `s4.4-evening-hero.jpg`.
3. In the evening, click through the teas (mug and bags). Judge whether the four bags and the glowing jars look right (open question 2).
4. Zoom all the way in at azimuth 0 and 40: the outer edges of the room leave the frame (open question 1). Screenshots: `s4.5-corners-morning.jpg`, `s4.5-corners-evening.jpg`.
5. Push the kettle steam with the pointer at azimuth 40: its thin outer edge can reach the lamp shade. Screenshot: `s4.5-lamp-push.jpg`.
6. Frame rate. Build and serve the production version:

```bash
npm run build
```

```bash
npm run preview
```

Open the printed `/tea-nook/` address in Chrome, paste this into the console, and note the result in both looks, without and with 4x CPU throttle. Compare with your phase 3 baseline (119.8 fps, worst frame 25.0 ms on the live site). The snippet you used then is not in the repo, so for a fair comparison run this one on the live site too.

```js
(() => { const d = []; const start = performance.now(); let last = start; const f = (t) => { d.push(t - last); last = t; if (t - start < 10000) requestAnimationFrame(f); else console.log((1000 * d.length / (t - start)).toFixed(1), 'fps, worst', Math.max(...d.slice(1)).toFixed(1), 'ms') }; requestAnimationFrame(f) })()
```

### Open questions for you

1. **Closest camera (D-170).** At distance 1.9 the wall trim leaves the frame by up to 46 px and the plinth corner by up to 106 px. No prop and no steam is cut. Keep your limits (recommended), or set the minimum to 2.4, which keeps the whole room visible but makes the closest view about a quarter smaller?
2. **Tea colour glow (D-154).** In the evening the tea bags shine slightly in their own colour so they stay distinguishable. The jars share the materials and glow too. SPEC section 6 does not list this. Keep it and add one line to SPEC (recommended), or replace it with more front light, which flattens the evening?
3. **Taste.** Anything to change: faint morning rays, the cabinet side face looking navy and the left wall maroon in the evening, the mug being the darkest evening prop, the tea steam being faint in front of the cream cups at the lowest camera angle, no lamp shadow (the wall above the shade is lit too)?
4. **`CLAUDE.md`.** May the new dev hooks be added to "Commands"? The wording is in `STATUS.md`, "Notes".

## 2. Decisions

Full text in `DECISIONS.md`. All are `open` until you have seen them (D-140 to D-146 you chose in slice 4.0).

### Foundation (other work builds on these)

| ID | Decision |
|---|---|
| D-140 | Phase cut: lamp, time of day, rays, dust, budgets. Rays follow the live sun; the page darkens in the evening |
| D-145 | One damped blend factor (0 morning, 1 evening) drives every time-of-day value |
| D-146 | Contract amendment: `Mat_Lamp` (19 of 20 materials), marker `Lamp_Light`, lamp merged into `Room` |
| D-150 | One driver, `TimeOfDay`, runs first in every frame; all consumers read `timeLive` |
| D-159 | Rays are 10 upright sheets across the lit window, one draw call, fading out at worktop, back wall or floor |
| D-160 | Room surface numbers live in `src/lib/roomSurfaces.ts`; a test fails if `04_room.py` differs |
| D-165 | Dust motion is a pure function of time in the vertex shader, with a TypeScript twin |

### Easy to change

| ID | Decision |
|---|---|
| D-141 to D-144 | Your values: evening sun -75 / 22, plum page, lamp position, one lamp light without shadow |
| D-147 to D-149 | Lamp shade is a slightly domed bell; straight iron arm; screen clearance to the steam checked by script (pointer push not included) |
| D-151 | Sun shadow refitted only while the sun moves |
| D-152 | Page colours mixed in CSS; text switches on a steeper curve and is below 4.5 : 1 for about 0.17 s |
| D-153 | Evening light and colour values, tuned against the render |
| D-154 | Tea colour glow in the evening (open question 2) |
| D-155, D-156 | Steam tint as two extra uniforms; "Evening" switch top right |
| D-157 | The code says `altitude` for the sun's elevation so that `grep -r leva dist` stays empty |
| D-158 | Fixed an older dev panel fault: live tea edits now show at once |
| D-161, D-162 | Lit window opening without the sill; ray strength 0.40 / 0.38 |
| D-163 | Rays drawn before steam and window glass, so the steam stays readable |
| D-164 | Props do not cut the rays (visible mostly in the evening) |
| D-166 to D-168 | 260 motes, size and drift values, soft beam weight, additive points |
| D-169 to D-172 | Material count in the dev readout, the "nothing clipped" reading, measuring method, no look changes in 4.5 |
| D-173 | Review fixes: colour fallback for old browsers, no pinch claim in the README |

The Blender note for the lamp ("what I did and why") is in `STATUS.md`, "Notes".

## 3. Acceptance

Base checks were re-run by the coordinator after every slice: typecheck, lint, tests (99 at the end) and build pass; `grep -r "__nook" dist` and, from 4.2 on, `grep -r leva dist` print nothing. After the review fixes they pass again. The contract check passes (7362 triangles, 0 errors).

### 4.1 Pendant lamp model: pass

| Criterion | Result | Evidence |
|---|---|---|
| Base checks, console, dist grep | pass | `s4.1-evidence.txt` |
| Contract check with `Mat_Lamp` and `Lamp_Light`, twin test, one `Room` mesh | pass | `s4.1-evidence.txt` |
| Shade and holder within 5 mm, marker within 1 mm | pass (worst 4 mm at the arm tip, marker 0 mm) | `s4.1-evidence.txt` |
| Steam clearance 15 mm; shade covers no steam column on screen | pass (142.4 mm; smallest screen gap 5.1 px, 1.1 px with wind drift) | `s4.1-evidence.txt` |
| Byte-identical AO bake and generated model | pass | `s4.1-evidence.txt` |
| Budgets reported | pass (19 materials, 42 draw calls, GLB 405368 bytes) | `s4.1-evidence.txt` |
| Previews and screenshots | pass | `s4.1-preview-iso.png`, `s4.1-preview-front.png`, `s4.1-preview-side.png`, `s4.1-preview-top.png`, `s4.1-hero.jpg`, `s4.1-front.jpg` |

### 4.2 Time of day: pass with caveats

| Criterion | Result | Evidence |
|---|---|---|
| Base checks, console, dist grep | pass | `s4.2-evidence.txt` |
| Unit tests for the blend and the evening sun | pass | `s4.2-evidence.txt` |
| Real click and keyboard, `aria-pressed` | pass | `s4.2-evidence.txt` |
| Converges within 2 s, no step above 25 % | pass at 60 fps (largest 19.5 %); at 30 fps the text step is about 28 % | `s4.2-walk.txt` |
| Values differ between presets, program count unchanged | pass | `s4.2-measure.txt` |
| Shadow not clipped through the transition, static mode updates | pass | `s4.2-walk-live-montage.jpg`, `s4.2-walk-static-montage.jpg` |
| Tea bags differ by 30, contrast 4.5 : 1 in both presets | pass with caveat: median colours pass (smallest distance 33 evening, 30 morning); a single centre sample on partly hidden bags at azimuth 40 gives 21 evening, 20 morning. Needed the tea colour glow (D-154). Contrast dips only during the switch | `s4.2-bags.txt`, `s4.2-measure.txt` |
| No allocations or `setState` in `useFrame` | pass | `s4.2-evidence.txt`, confirmed by the reviewer |
| Screenshots; morning unchanged apart from the lamp | pass (0.013 % of pixels differ, from an old rounding of the sun angle) | `s4.2-morning-montage.jpg`, `s4.2-evening-hero.jpg`, `s4.2-evening-front.jpg`, `s4.2-evening-az40.jpg` |

### 4.3 Window light rays: pass

| Criterion | Result | Evidence |
|---|---|---|
| Base checks, console, dist grep | pass | `s4.3-evidence.txt` |
| Unit tests for ray direction and ray end | pass | `s4.3-evidence.txt` |
| Rays follow the sun; ends lie on the sun patch | pass (0 to 10 mm; 16 mm at the morning sill edge). In the evening the back wall patch is mostly shaded by shelf and cups, so it gives no usable edge numbers (D-164) | `s4.3-transition.jpg`, `s4.3-patch-montage.jpg` |
| Additive, no depth write, no raycast, one draw call, stable uniforms | pass | `s4.3-evidence.txt` |
| No hard plane edges at azimuth 0, 25, 40 | pass | `s4.3-morning-azimuths.jpg`, `s4.3-evening-azimuths.jpg` |
| Steam readable, mug and bag clicks work | pass (steam contrast 89 to 99 % of the value without rays) | `s4.3-steam-pairs.jpg` |
| Draw calls under 50 | pass (43) | `s4.3-evidence.txt` |

### 4.4 Dust motes: pass

| Criterion | Result | Evidence |
|---|---|---|
| Base checks, console, dist grep | pass | `s4.4-evidence.txt` |
| Motes stay in the box over 60 s | pass (holds by construction, the position wraps) | `s4.4-evidence.txt` |
| Unit test of the beam function | pass | `s4.4-evidence.txt` |
| One constant for the count, one draw call, no depth write, no raycast | pass | `s4.4-evidence.txt` |
| Brighter in the beam, draw calls under 50 | pass (added brightness in / outside the beam: morning 75 / 16, evening 67 / 11; 44 draw calls). Motion was judged from stills only | `s4.4-morning-hero.jpg`, `s4.4-evening-hero.jpg`, `s4.4-evening-onoff-diff.jpg` |

### 4.5 Budgets, performance, polish and review: pass with caveats

| Criterion | Result | Evidence |
|---|---|---|
| Base checks, console, dist greps, contract check | pass (only the known `THREE.Clock` warning) | `s4.5-evidence.txt` |
| Budget table for both presets | pass (table below, full version in `STATUS.md`) | `s4.5-evidence.txt` |
| Orbit corners: nothing clipped, steams readable | pass with the reading in D-170 (open question 1) | `s4.5-corners-morning.jpg`, `s4.5-corners-evening.jpg`, `s4.5-corners-steam-crops.jpg` |
| README without unverified claims | pass after `d809bb3` | `README.md` |
| Fresh-context review, this file, notification, phase 5 not started | done | this file |

| Budget | Phase 4 (morning / evening) | Slice 3.3 | Limit |
|---|---|---|---|
| Triangles in the app | 17654 | 16698 | 100k |
| GLB | 405368 bytes | 383184 bytes | 3 MB |
| Materials | 19 (23 with the 4 shader materials, not counted) | 18 | 20 |
| Draw calls | 44 | 40 | under 50 |
| `benchmark`, two runs | 2.03, 2.02 / 2.11, 2.07 ms (`2000`) | 1.78, 2.17 ms (`10000`) | none |
| Production frame, average | 4.06, 3.87 / 3.87, 3.92 ms | 3.98 ms | 16.7 ms |
| Production frame, 95th percentile | about 8 ms | 6.4 ms | none |

The frame times come from the throttled browser pane and do not show a real frame rate. The higher 95th percentile was not analysed.

## 4. History

One commit per slice, plus two from the review. Later slices build on earlier ones, so reverting an early one alone will conflict.

| Commit | Content |
|---|---|
| `b8a1e92` | 4.0: phase 4 spec, evening look and lamp amendment |
| `a06f2f7` | 4.1: pendant lamp model |
| `bd34073` | 4.2: time of day |
| `e1ce4ca` | 4.3: window light rays |
| `8567cbb` | 4.4: dust motes |
| `b3b2323` | 4.5: budgets, performance and polish |
| `d809bb3` | 4.5: review fixes |
| (next) | 4.5: phase 4 review (this file) |

No slice was sent back.

## 5. Open issues

### From the reviewer

| Finding | Severity | State |
|---|---|---|
| No fallback without `color-mix` (Chrome below 111, Safari below 16.2): dark title and clear pills in the evening | should-fix | fixed (D-173). The fallback rules were applied by hand in a current browser; no old browser was tested |
| D-154 glow is outside SPEC section 6 | minor | open question 2 |
| README claimed pinch zoom | minor | fixed (D-173) |
| A hot reload of `lightRig.ts` or `TimeOfDay.tsx` may stop the shadow refit or snap the blend | minor, dev only, suspected | not fixed |
| Text colour step about 28 % per frame at 30 fps | taste | not fixed |
| The transition ignores `prefers-reduced-motion` | taste | not fixed |
| D-157 renames a property only to satisfy the literal grep; a word-boundary grep in SPEC would be cleaner | taste | your call |
| The window glass slightly dims the rays near the window (D-163) | taste | not fixed |
| `CLAUDE.md` Commands lacks the new dev hooks | open item | open question 4 |

### Not verified

- Real frame rate, 4x CPU throttle and a weaker GPU (rays and dust add overdraw).
- The production build looked at in a browser: it was served and timed in 4.5, but its look was not reviewed. Safari, Firefox, touch devices, slow 3G.
- The reviewer did not re-run `04_room.py`, the AO bake or `gen:model` (they write tracked files); it compared checksums instead.
- Dust motion was judged from stills.

### Process notes

- Slice 4.4 was started at 73 % of the 5-hour usage window (limit 80 %) and ended at 80 %; the run paused until the reset.
- The local `main` is one docs commit (`4dbc359`) ahead of `origin/main`. That commit is part of this branch's history. Nothing was pushed to `main`.
