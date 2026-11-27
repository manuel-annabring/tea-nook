import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector2, Vector3, type IUniform } from 'three'
import { DUST, RAYS } from '../config/look.ts'
import { apertureInto, beamDirectionInto, beamVisibility, createBeamWindow, type BeamWindow } from '../lib/beam.ts'
import { createDustMotes, type DustBox } from '../lib/dust.ts'
import { WINDOW_FRAME } from '../lib/roomSurfaces.ts'
import type { TimeValues } from '../lib/timeOfDay.ts'
import { dustFragmentShader, dustVertexShader } from '../shaders/dust.ts'
import { createSurfaceUniforms, type SurfaceUniforms } from './raysMaterial.ts'

export interface DustUniforms extends SurfaceUniforms {
  [name: string]: IUniform
  uTime: IUniform<number>
  uBoxMin: IUniform<Vector3>
  uBoxSize: IUniform<Vector3>
  uWobble: IUniform<number>
  uBoxFade: IUniform<number>
  uDirection: IUniform<Vector3>
  uWindowX: IUniform<number>
  uCentre: IUniform<Vector2>
  uHalf: IUniform<Vector2>
  uBeam: IUniform<number>
  uSoftness: IUniform<number>
  uFadeIn: IUniform<number>
  uReach: IUniform<Vector2>
  uEndFade: IUniform<number>
  uEdgeMargin: IUniform<number>
  /** Live brightness of a mote in the beam (time-of-day value). */
  uStrength: IUniform<number>
  uOutside: IUniform<number>
  uSize: IUniform<number>
  uMinPixels: IUniform<number>
  uViewportHeight: IUniform<number>
  uColor: IUniform<Color>
  uCore: IUniform<number>
}

export type DustMaterial = ShaderMaterial & { uniforms: DustUniforms }

/** One point per mote; `position` holds the start position as shares of the box (the vertex shader places the mote). */
export function createDustGeometry(): BufferGeometry {
  const motes = createDustMotes(DUST)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(motes.base, 3))
  geometry.setAttribute('aVelocity', new BufferAttribute(motes.velocity, 3))
  geometry.setAttribute('aWobble', new BufferAttribute(motes.wobble, 4))
  geometry.setAttribute('aLook', new BufferAttribute(motes.look, 2))
  return geometry
}

/**
 * Motes are specks of light, so: additive blending (their order does not matter), no depth write (they never hide
 * anything), depth test on (walls and props in front hide them), no tone mapping, like the rays. The uniform objects
 * live on `userData.uniforms` and are only mutated, never replaced.
 */
export function createDustMaterial(): DustMaterial {
  const uniforms: DustUniforms = {
    uTime: { value: 0 },
    uBoxMin: { value: new Vector3() },
    uBoxSize: { value: new Vector3(1, 1, 1) },
    uWobble: { value: DUST.wobble },
    uBoxFade: { value: DUST.boxFade },
    uDirection: { value: new Vector3(1, -1, 0).normalize() },
    uWindowX: { value: 0 },
    uCentre: { value: new Vector2() },
    uHalf: { value: new Vector2() },
    uBeam: { value: 0 },
    uSoftness: { value: DUST.beamSoftness },
    uFadeIn: { value: RAYS.fadeIn },
    uReach: { value: new Vector2(RAYS.reachStart, RAYS.reachEnd) },
    uEndFade: { value: RAYS.endFade },
    uEdgeMargin: { value: RAYS.edgeMargin },
    uStrength: { value: 0 },
    uOutside: { value: DUST.outside },
    uSize: { value: DUST.size },
    uMinPixels: { value: DUST.minPixels },
    uViewportHeight: { value: 1 },
    uColor: { value: new Color() },
    uCore: { value: DUST.core },
    ...createSurfaceUniforms(),
  }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: dustVertexShader,
    fragmentShader: dustFragmentShader,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }) as DustMaterial
  material.userData.uniforms = uniforms
  return material
}

/** Objects reused every frame, so the per-frame update allocates nothing. */
export interface DustState {
  aperture: BeamWindow
  buffer: Vector2
}

export function createDustState(): DustState {
  return { aperture: createBeamWindow(), buffer: new Vector2() }
}

/**
 * Per-frame update: the box, the drawing buffer height (`state.buffer`, filled by the caller), the sun beam from the
 * live time of day (same direction and lit opening as the rays), colour, brightness and time.
 */
export function tickDust(material: DustMaterial, state: DustState, box: DustBox, window: BeamWindow, values: TimeValues, delta: number): void {
  const u = material.uniforms
  u.uBoxMin.value.copy(box.min)
  u.uBoxSize.value.copy(box.size)
  u.uViewportHeight.value = state.buffer.y
  const direction = beamDirectionInto(u.uDirection.value, values.sunPosition)
  const lit = apertureInto(state.aperture, window, direction, WINDOW_FRAME)
  u.uWindowX.value = lit.x
  u.uCentre.value.set(lit.y, lit.z)
  u.uHalf.value.set(lit.halfHeight, lit.halfWidth)
  u.uBeam.value = beamVisibility(direction, RAYS.visibleFrom[0], RAYS.visibleFrom[1])
  u.uColor.value.copy(values.sunColor)
  u.uStrength.value = values.dustStrength
  u.uTime.value += delta
}
