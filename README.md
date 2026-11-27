# Tea Nook

A cozy, stylized low-poly 3D diorama of a kitchen tea nook for the web. The star is the custom-shader steam rising from the tea mug and the kettle. Built as a portfolio piece for 3D web work.

Live: https://manuel-annabring.github.io/tea-nook/

Every push to `main` runs the `deploy.yml` workflow (typecheck, lint, test, build) and publishes the result to GitHub Pages. A fork needs Pages enabled first (Settings > Pages > Source: GitHub Actions).

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

- Drag to orbit, scroll or pinch to zoom.
- Click the mug to change tea.
- Move the pointer over the scene and the steam leans away from it.

## Known console noise

The browser console shows `THREE.Clock: This module has been deprecated`. It comes from @react-three/fiber 9.8.2 itself and goes away with a later r3f update. The build also warns that the main chunk is over 500 kB (three and drei).
