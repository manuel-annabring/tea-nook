import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, Raycaster, Vector2, Vector3, type Camera, type Object3D, type Scene, type WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CAMERA, type CameraPresetName } from '../config/look.ts'

interface NookHooks {
  getCamera: () => { position: [number, number, number]; target: [number, number, number]; fov: number }
  project: (objectName: string) => { x: number; y: number } | null
  pick: (x: number, y: number) => string | null
  stats: () => { drawCalls: number; triangles: number }
  worldPosition: (objectName: string) => { x: number; y: number; z: number } | null
}

declare global {
  interface Window {
    __nook?: NookHooks
  }
}

interface Rig {
  scene: Scene
  camera: Camera
  gl: WebGLRenderer
  controls: OrbitControls | null
}

// Scratch objects for the hooks (they run on demand from the console, not per frame).
const box = new Box3()
const vec = new Vector3()
const ndc = new Vector2()
const raycaster = new Raycaster()

function isPreset(name: string | null): name is CameraPresetName {
  return name !== null && name in CAMERA.presets
}

function applyPreset(rig: Rig, name: CameraPresetName) {
  const pose = CAMERA.presets[name]
  rig.camera.position.fromArray(pose.position)
  if (rig.controls) {
    rig.controls.target.fromArray(pose.target)
    rig.controls.update()
  } else {
    rig.camera.lookAt(pose.target[0], pose.target[1], pose.target[2])
  }
}

function createHooks(rigRef: { current: Rig }): NookHooks {
  const find = (name: string) => rigRef.current.scene.getObjectByName(name)
  const center = (obj: Object3D, out: Vector3) => box.setFromObject(obj).getCenter(out)
  return {
    getCamera() {
      const { camera, controls } = rigRef.current
      const target = controls ? controls.target : vec.set(0, 0, 0)
      const fov = 'fov' in camera && typeof camera.fov === 'number' ? camera.fov : 0
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
        fov,
      }
    },
    project(name) {
      const obj = find(name)
      if (!obj) return null
      const { camera, gl } = rigRef.current
      const rect = gl.domElement.getBoundingClientRect()
      center(obj, vec).project(camera)
      return { x: Math.round(((vec.x + 1) / 2) * rect.width + rect.left), y: Math.round(((1 - vec.y) / 2) * rect.height + rect.top) }
    },
    pick(x, y) {
      const { camera, gl, scene } = rigRef.current
      const rect = gl.domElement.getBoundingClientRect()
      ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      // Transparent meshes (steam) are skipped: their vertices are displaced in the shader, so CPU raycasts on them are wrong.
      const hits = raycaster.intersectObjects(scene.children, true)
      for (const hit of hits) {
        const material = (hit.object as { material?: { transparent?: boolean } }).material
        if (material?.transparent) continue
        let node: Object3D | null = hit.object
        while (node && node.name === '') node = node.parent
        return node ? node.name : null
      }
      return null
    },
    stats() {
      const { render } = rigRef.current.gl.info
      return { drawCalls: render.calls, triangles: render.triangles }
    },
    worldPosition(name) {
      const obj = find(name)
      if (!obj) return null
      obj.getWorldPosition(vec)
      return { x: vec.x, y: vec.y, z: vec.z }
    },
  }
}

/**
 * Dev-only verification hooks (loaded lazily under import.meta.env.DEV, absent from production):
 * `?cam=<preset>`, `window.__nook`, and `data-nook-ready` on the document element.
 */
export default function DevHooks() {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as OrbitControls | null
  const rigRef = useRef<Rig>({ scene, camera, gl, controls })
  const presetDone = useRef(false)
  const frames = useRef(0)

  useEffect(() => {
    rigRef.current = { scene, camera, gl, controls }
  }, [scene, camera, gl, controls])

  useEffect(() => {
    window.__nook = createHooks(rigRef)
    delete document.documentElement.dataset.nookReady
    return () => {
      delete window.__nook
      delete document.documentElement.dataset.nookReady
      delete document.documentElement.dataset.nookReadyMs
    }
  }, [])

  useFrame(() => {
    const rig = rigRef.current
    if (!presetDone.current && rig.controls) {
      const name = new URLSearchParams(window.location.search).get('cam')
      if (isPreset(name)) applyPreset(rig, name)
      presetDone.current = true
    }
    // Ready = camera preset applied, mug and steam mounted, and one full frame rendered since.
    const mounted = presetDone.current && rig.scene.getObjectByName('Mug') && rig.scene.getObjectByName('Steam')
    if (mounted) frames.current += 1
    if (frames.current === 2) {
      document.documentElement.dataset.nookReady = 'true'
      // Milliseconds since navigation start, for checking the "ready within 5 s" criterion.
      document.documentElement.dataset.nookReadyMs = String(Math.round(performance.now()))
    }
  })

  return null
}
