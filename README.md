# Tea Nook

A cozy, stylized low-poly 3D diorama of a kitchen tea nook for the web. The star is the custom-shader steam rising from the tea mug and the kettle. Built as a portfolio piece for 3D web work.

Live: https://manuel-annabring.github.io/tea-nook/

Every push to `main` runs the `deploy.yml` workflow (typecheck, lint, test, build) and publishes the result to GitHub Pages. A fork needs Pages enabled first (Settings > Pages > Source: GitHub Actions).

## What is in the scene

- Steam from the mug and the kettle, made with a custom shader. The mug steam and the tea in the mug change colour with the selected tea.
- Morning and evening. The sun, the fill lights, the sky in the window, the steam tint and the page colours blend smoothly from one look to the other. The page starts in the morning and does not remember the choice.
- A pendant lamp over the worktop. It is off in the morning; in the evening the shade glows and a warm point light (without shadows) comes on.
- Light rays from the window that follow the direction of the sun, also during the change.
- Dust motes drifting in the room, brighter inside the window beam. The objects in the room do not shade the rays or the dust.

## Run

```
npm install
npm run dev        # dev server
npm run build      # type-check and production build
npm run preview    # serve the build at /tea-nook/
npm run typecheck && npm run lint && npm test
```

Node 22 or newer (Vite 8 needs 20.19+ or 22.12+).

## Stack

three, @react-three/fiber, @react-three/drei, React 19, TypeScript (strict), Vite, Zustand. The model is a GLB from Blender, turned into a component with gltfjsx. Exact versions are pinned in `package.json`.

## Model pipeline

1. `tools/blender/nook.blend` is the source of truth; parts are built by headless scripts in `tools/blender/steps/` (`Blender -b`).
2. `contract_check.py` verifies names, transforms, origins, markers, materials and budgets against the model contract (SPEC.md section 5).
3. `export_glb.py` runs the check, then writes `public/models/nook.glb`.
4. `npm run gen:model` regenerates `src/nook/NookModel.generated.tsx` (never edit by hand).
5. `render_preview.py` writes Workbench previews for review.

## Controls

- Drag to orbit, scroll to zoom. Orbit and zoom are limited, and there is no panning.
- Click the mug to change to the next tea, or click a tea bag in the box to pick that tea.
- Use the "Evening" switch at the top right to change between morning and evening (mouse or keyboard).
- Move the pointer over the scene and the steam leans away from it.

Touch devices have not been tested yet.

## Known console noise

The browser console shows `THREE.Clock: This module has been deprecated`. It comes from @react-three/fiber 9.8.2 itself and goes away with a later r3f update. The build also warns that the main chunk is over 500 kB (three and drei).
