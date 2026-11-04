# Decisions

Format and rules: `WORKFLOW.md` section 6. Impact `foundation` = other slices build on it (expensive to change). `easy-to-change` = a value or look that can be retuned in minutes. Status is `open` until Manuel has seen it at review, then `accepted` or `changed`.

| ID | Slice | Decision | Alternatives | Why | Impact | Status |
|---|---|---|---|---|---|---|
| D-001 | 0.2 | Steam uses a plain `ShaderMaterial` | `onBeforeCompile` on a standard material, drei `shaderMaterial` | Steam is unlit, transparent and needs full control of vertex displacement and alpha; `onBeforeCompile` stays reserved for lit surfaces | foundation | accepted |
| D-002 | 0.2 | Steam geometry is one camera-facing billboard around Y, 16 x 48 segments | open tube, crossed planes | The twist stays visible and it is one draw call; tube hides the twist, crossed planes get thin edge-on. Known limit: collapses when seen from straight above, so the polar minimum stays far from vertical | foundation | accepted |
| D-003 | 0.2 | Noise is a tileable Perlin `DataTexture` (128 x 128) generated at startup | procedural GLSL noise, shipped PNG | One texture fetch per fragment, no asset to load, CPU twin is unit-tested | foundation | accepted |
| D-004 | 0.2 | No `uSpeed` uniform; the CPU accumulates `uPhase += delta * speed` | `uTime * uSpeed` | Damping speed between teas never makes the pattern jump | foundation | accepted |
| D-005 | 0.2 | Pointer reaches the shader through `PointerProbe` (ray-plane on the canvas element, plain numbers in the Zustand store, read with `getState()` in `useFrame`) | invisible hit mesh, store subscription | Never blocks mesh pointer events (the mug click needs them), no re-render per mouse move | foundation | accepted |
| D-006 | 0.2 | `leva` 0.10.1 as dev-only tweak panel, lazy loaded under `import.meta.env.DEV` | hand-written panel | Approved by Manuel; verified absent from the production bundle | easy-to-change | accepted |
| D-007 | 0.2 | Steam defaults tuned by Manuel in the Leva panel on 2026-10-27 (`STEAM_LOOK_DEFAULTS`) | none | Taste decision made live | easy-to-change | accepted |
| D-008 | 0 | Work is organized in phases 0 to 5 (SPEC section 7); phase 2 (live Blender modeling) is collaborative, the rest autonomous | slice-by-slice approval; all phases autonomous | Modeling is taste-driven and needs the live session (`WORKFLOW.md` section 12); the rest can run unattended | foundation | open |
| D-009 | 1.4 (planned) | The app sets contract material colors from `PALETTE` in `src/config/look.ts` by material name after load | colors baked in the GLB only | Palette changes after review take minutes and need no Blender export. Material names stay the contract; only colors are overridden | foundation | open |
| D-010 | 1.3 (planned) | SPEC section 5 sizes and budgets are used unchanged as the working values | change sizes in slice 1.3 | A change would be a contract change and a stop; amendments are made in phase 2 with Manuel present | foundation | accepted |
| D-011 | 0 | Phase order: phase 1, then phase 2 (live Blender) in the same sitting as the review, then phase 3 unattended | phase 3 before phase 2 | Look-defining shapes come before interaction; Manuel is present at review anyway | easy-to-change | accepted |
| D-012 | 0 | Phase 1 starts right after a usage-window reset; extra usage stays off; pause and resume is accepted | enable extra usage | Pro plan, extra usage capped at about 20 EUR per month | easy-to-change | accepted |
