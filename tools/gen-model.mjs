// Regenerates src/nook/NookModel.generated.tsx from public/models/nook.glb.
//
//   npm run gen:model
//
// Runs gltfjsx (pinned, one-off via npx, not a dependency), then patches the few things
// its 6.5.3 output gets wrong for React 19 and strict TypeScript. Each patch must match,
// so a change in gltfjsx output fails loudly here instead of breaking typecheck later.
// Adapted from Typewriter's tools/gen-model.mjs.
//
// GEN_MODEL_ROOT (optional) points the script at another project root with the same layout
// (public/models/nook.glb in, src/nook/ out). Only for testing the script without a GLB in the repo.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = process.env.GEN_MODEL_ROOT
  ? resolve(process.env.GEN_MODEL_ROOT)
  : resolve(dirname(fileURLToPath(import.meta.url)), '..')
const input = 'public/models/nook.glb'
const out = 'src/nook/NookModel.generated.tsx'

if (!existsSync(resolve(root, input))) {
  console.error(`gen-model: ${input} not found. Export it first: see "Blender" in CLAUDE.md.`)
  process.exit(1)
}

const run = spawnSync(
  'npx',
  [
    '--yes',
    'gltfjsx@6.5.3',
    input,
    '--types',
    '--keepnames',
    '--keepgroups', // keep empty nodes such as the Steam_* and Rays_* markers
    '--root',
    'public', // GLB is served from /models/nook.glb
    '-o',
    out,
  ],
  { cwd: root, stdio: 'inherit' },
)
if (run.status !== 0) process.exit(run.status ?? 1)

const patches = [
  ["import React from 'react'\n", ''],
  [
    "import { GLTF } from 'three-stdlib'",
    "import type { ThreeElements } from '@react-three/fiber'\nimport type { GLTF } from 'three-stdlib'",
  ],
  ['GLTFAction[]', 'THREE.AnimationClip[]'],
  ["JSX.IntrinsicElements['group']", "ThreeElements['group']"],
  [') as GLTFResult', ') as unknown as GLTFResult'],
  // The site is served under a base path (vite.config.ts), so the model URL can't be absolute.
  ["useGLTF('/models/nook.glb')", 'useGLTF(MODEL_URL)'],
  ["useGLTF.preload('/models/nook.glb')", 'useGLTF.preload(MODEL_URL)'],
  [
    "import type { GLTF } from 'three-stdlib'\n",
    "import type { GLTF } from 'three-stdlib'\n\nconst MODEL_URL = `${import.meta.env.BASE_URL}models/nook.glb`\n",
  ],
]

let src = readFileSync(resolve(root, out), 'utf8')
for (const [from, to] of patches) {
  if (!src.includes(from)) throw new Error(`gen-model: expected to find ${JSON.stringify(from)} in gltfjsx output`)
  src = src.replace(from, to)
}
writeFileSync(resolve(root, out), src)
console.log(`gen-model: wrote ${out}`)
