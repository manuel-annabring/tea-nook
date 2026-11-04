import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Box3, DirectionalLight, HemisphereLight, MathUtils, Raycaster, Spherical, Vector2, Vector3, type Camera, type Material, type Object3D, type Scene, type ShaderMaterial, type WebGLRenderer } from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CAMERA, type CameraPresetName } from '../config/look.ts'
import type { SteamUniforms } from '../nook/steamMaterial.ts'
import { getRoomAoIntensity, setRoomAoIntensity } from '../nook/roomAo.ts'
import { frameCamera } from '../scene/framing.ts'

interface NookHooks {
  /** Azimuth and polar angle in degrees, distance in meters, all relative to the controls target. */
  getCamera: () => {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
    azimuth: number
    polar: number
    distance: number
  }
  getControls: () => { enablePan: boolean; enableDamping: boolean } | null
  /** sRGB hex (no #) of every named material with a colour, by material name. */
  materialColors: () => Record<string, string>
  /** Material opacity and transparent flag by name (to check Mat_Glass keeps its alpha). */
  materialAlpha: (name: string) => { opacity: number; transparent: boolean } | null
  project: (objectName: string) => { x: number; y: number } | null
  /** Screen pixels of the 8 corners of the bounding box of everything under a node (for example `Room`). */
  projectCorners: (objectName: string) => { x: number; y: number }[] | null
  /** Renders one frame and returns it as a JPEG data URL (the canvas buffer is not preserved between frames). */
  snapshot: () => string
  pick: (x: number, y: number) => string | null
  stats: () => { drawCalls: number; triangles: number }
  /** Live values of the sun and the hemisphere fill in the scene (to compare with `LIGHT_PRESETS.morning`). */
  lights: () => {
    sun: { color: string; intensity: number; position: [number, number, number]; castShadow: boolean; mapSize: number } | null
    fill: { skyColor: string; groundColor: string; intensity: number } | null
    toneMapping: number
    shadowMapEnabled: boolean
  }
  /**
   * Runs `controls.update()` `frames` times at once, so damped orbit input (drags, wheel) settles without waiting for
   * real frames (the built-in browser pane only runs requestAnimationFrame at 1 Hz while hidden).
   */
  settle: (frames?: number) => void
  /**
   * Renders back to back for `ms` milliseconds (blocks the page), reading one pixel after each render so the GPU has
   * finished. Returns the average time per frame. rAF deltas are capped at the display rate, this is not.
   */
  benchmark: (ms: number) => { frames: number; avgMs: number; drawCalls: number; triangles: number }
  worldPosition: (objectName: string) => { x: number; y: number; z: number } | null
  /** Screen pixels of a world point (for example a point inside a steam column). */
  projectPoint: (x: number, y: number, z: number) => { x: number; y: number }
  /** Sets the `Room` AO strength (`aoMapIntensity`, 0 = off, 1 = as baked) for the AO on and off screenshots. */
  setAOIntensity: (intensity: number) => void
  /** Current `Room` AO strength, or null when the room has no standard materials. */
  getAOIntensity: () => number | null
  /** Current values of a steam's uniforms (the meshes are named `SteamMesh_tea` and `SteamMesh_kettle`). */
  uniforms: (slot: 'tea' | 'kettle') => SteamUniformValues | null
}

interface SteamUniformValues {
  uDensity: number
  uHeight: number
  uPointerBlend: number
  uPointer: [number, number, number]
  uPhase: number
  uColor: string
  uWind: number
  /** True when the material is a `ShaderMaterial` created by `createSteamMaterial` (uniform objects on userData). */
  fromFactory: boolean
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
const spherical = new Spherical()

function isPreset(name: string | null): name is CameraPresetName {
  return name !== null && name in CAMERA.presets
}

function applyPreset(rig: Rig, name: CameraPresetName) {
  const pose = CAMERA.presets[name]
  const marker = rig.scene.getObjectByName('Orbit_Target')
  if (!marker) throw new Error('Orbit_Target is missing from the model')
  const { limits } = CAMERA
  // `side` and `top` are dev-only views outside the orbit limits: lift the limits for them so the controls do not clamp the pose.
  const outside =
    pose.azimuth < limits.azimuthMin || pose.azimuth > limits.azimuthMax ||
    pose.polar < limits.polarMin || pose.polar > limits.polarMax ||
    pose.distance < limits.distanceMin || pose.distance > limits.distanceMax
  if (rig.controls) {
    if (outside) {
      rig.controls.minAzimuthAngle = -Infinity
      rig.controls.maxAzimuthAngle = Infinity
      rig.controls.minPolarAngle = 0
      rig.controls.maxPolarAngle = Math.PI
      rig.controls.minDistance = 0
      rig.controls.maxDistance = Infinity
    }
    frameCamera(rig.camera, rig.controls, marker, pose)
  }
}

function createHooks(rigRef: { current: Rig }): NookHooks {
  const find = (name: string) => rigRef.current.scene.getObjectByName(name)
  // Marker Empties have no geometry (an empty box), so they use their world position instead.
  const center = (obj: Object3D, out: Vector3) =>
    box.setFromObject(obj).isEmpty() ? obj.getWorldPosition(out) : box.getCenter(out)
  return {
    getCamera() {
      const { camera, controls } = rigRef.current
      const target = controls ? controls.target : vec.set(0, 0, 0)
      const fov = 'fov' in camera && typeof camera.fov === 'number' ? camera.fov : 0
      spherical.setFromVector3(vec.copy(camera.position).sub(target))
      return {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [target.x, target.y, target.z],
        fov,
        azimuth: MathUtils.radToDeg(spherical.theta),
        polar: MathUtils.radToDeg(spherical.phi),
        distance: spherical.radius,
      }
    },
    getControls() {
      const { controls } = rigRef.current
      return controls ? { enablePan: controls.enablePan, enableDamping: controls.enableDamping } : null
    },
    materialColors() {
      const out: Record<string, string> = {}
      rigRef.current.scene.traverse((node) => {
        const material = (node as { material?: Material | Material[] }).material
        for (const m of Array.isArray(material) ? material : material ? [material] : []) {
          const color = (m as { color?: { getHexString: () => string } }).color
          if (m.name && color) out[m.name] = color.getHexString().toUpperCase()
        }
      })
      return out
    },
    materialAlpha(name) {
      let found: { opacity: number; transparent: boolean } | null = null
      rigRef.current.scene.traverse((node) => {
        const material = (node as { material?: Material | Material[] }).material
        for (const m of Array.isArray(material) ? material : material ? [material] : []) {
          if (m.name === name) found = { opacity: m.opacity, transparent: m.transparent }
        }
      })
      return found
    },
    project(name) {
      const obj = find(name)
      if (!obj) return null
      const { camera, gl } = rigRef.current
      const rect = gl.domElement.getBoundingClientRect()
      center(obj, vec).project(camera)
      return { x: Math.round(((vec.x + 1) / 2) * rect.width + rect.left), y: Math.round(((1 - vec.y) / 2) * rect.height + rect.top) }
    },
    projectCorners(name) {
      const obj = find(name)
      if (!obj) return null
      const { camera, gl } = rigRef.current
      const rect = gl.domElement.getBoundingClientRect()
      box.setFromObject(obj)
      const out: { x: number; y: number }[] = []
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            vec.set(x, y, z).project(camera)
            out.push({ x: Math.round(((vec.x + 1) / 2) * rect.width + rect.left), y: Math.round(((1 - vec.y) / 2) * rect.height + rect.top) })
          }
        }
      }
      return out
    },
    snapshot() {
      const { gl, scene, camera } = rigRef.current
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/jpeg', 0.85)
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
    lights() {
      const { scene, gl } = rigRef.current
      let sun: ReturnType<NookHooks['lights']>['sun'] = null
      let fill: ReturnType<NookHooks['lights']>['fill'] = null
      scene.traverse((node) => {
        if (node instanceof DirectionalLight) {
          sun = {
            color: `#${node.color.getHexString().toUpperCase()}`,
            intensity: node.intensity,
            position: [node.position.x, node.position.y, node.position.z],
            castShadow: node.castShadow,
            mapSize: node.shadow.mapSize.x,
          }
        } else if (node instanceof HemisphereLight) {
          fill = {
            skyColor: `#${node.color.getHexString().toUpperCase()}`,
            groundColor: `#${node.groundColor.getHexString().toUpperCase()}`,
            intensity: node.intensity,
          }
        }
      })
      return { sun, fill, toneMapping: gl.toneMapping, shadowMapEnabled: gl.shadowMap.enabled }
    },
    settle(frames = 200) {
      const { controls } = rigRef.current
      if (!controls) return
      for (let i = 0; i < frames; i += 1) controls.update()
    },
    benchmark(ms) {
      const { gl, scene, camera } = rigRef.current
      const ctx = gl.getContext()
      const pixel = new Uint8Array(4)
      let frames = 0
      const start = performance.now()
      let now = start
      while (now - start < ms) {
        gl.render(scene, camera)
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, pixel)
        frames += 1
        now = performance.now()
      }
      const { render } = gl.info
      return { frames, avgMs: (now - start) / frames, drawCalls: render.calls, triangles: render.triangles }
    },
    worldPosition(name) {
      const obj = find(name)
      if (!obj) return null
      obj.getWorldPosition(vec)
      return { x: vec.x, y: vec.y, z: vec.z }
    },
    projectPoint(x, y, z) {
      const { camera, gl } = rigRef.current
      const rect = gl.domElement.getBoundingClientRect()
      vec.set(x, y, z).project(camera)
      return { x: Math.round(((vec.x + 1) / 2) * rect.width + rect.left), y: Math.round(((1 - vec.y) / 2) * rect.height + rect.top) }
    },
    setAOIntensity(intensity) {
      const room = find('Room')
      if (room) setRoomAoIntensity(room, intensity)
    },
    getAOIntensity() {
      const room = find('Room')
      return room ? getRoomAoIntensity(room) : null
    },
    uniforms(slot) {
      const obj = find(`SteamMesh_${slot}`)
      const material = (obj as { material?: Material } | null | undefined)?.material
      if (!material) return null
      const u = (material.userData as { uniforms?: SteamUniforms }).uniforms
      if (!u) return null
      return {
        uDensity: u.uDensity.value,
        uHeight: u.uHeight.value,
        uPointerBlend: u.uPointerBlend.value,
        uPointer: [u.uPointer.value.x, u.uPointer.value.y, u.uPointer.value.z],
        uPhase: u.uPhase.value,
        uColor: u.uColor.value.getHexString(),
        uWind: u.uWind.value,
        fromFactory: u === (material as ShaderMaterial).uniforms,
      }
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
    // Wait for the model: the preset is relative to the Orbit_Target marker, and `Nook` frames the default pose on mount.
    if (!presetDone.current && rig.controls && rig.scene.getObjectByName('Orbit_Target')) {
      const name = new URLSearchParams(window.location.search).get('cam')
      if (isPreset(name)) applyPreset(rig, name)
      presetDone.current = true
    }
    // Ready = camera preset applied, the model mounted, and one full frame rendered since.
    const mounted = presetDone.current && rig.scene.getObjectByName('Mug')
    if (mounted) frames.current += 1
    if (frames.current === 2) {
      document.documentElement.dataset.nookReady = 'true'
      // Milliseconds since navigation start, for checking the "ready within 5 s" criterion.
      document.documentElement.dataset.nookReadyMs = String(Math.round(performance.now()))
    }
  })

  return null
}
