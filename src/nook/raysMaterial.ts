import { AdditiveBlending, Color, DoubleSide, ShaderMaterial, Vector2, Vector3, Vector4, type DataTexture, type IUniform } from 'three'
import { RAYS } from '../config/look.ts'
import { apertureInto, beamDirectionInto, beamVisibility, createBeamWindow, type BeamWindow } from '../lib/beam.ts'
import { ROOM_SURFACES, WINDOW_FRAME } from '../lib/roomSurfaces.ts'
import type { TimeValues } from '../lib/timeOfDay.ts'
import { raysFragmentShader, raysVertexShader } from '../shaders/rays.ts'

/** The surfaces a sun ray can end on, as uniforms (rays and dust). */
export interface SurfaceUniforms {
  uWorktopY: IUniform<number>
  uWorktopRect: IUniform<Vector4>
  uWallZ: IUniform<number>
  uWallRect: IUniform<Vector4>
  uFloorY: IUniform<number>
  uFloorRect: IUniform<Vector4>
}

export function createSurfaceUniforms(): SurfaceUniforms {
  const { worktop, backWall, floor } = ROOM_SURFACES
  return {
    uWorktopY: { value: worktop.y },
    uWorktopRect: { value: new Vector4(worktop.xMin, worktop.xMax, worktop.zMin, worktop.zMax) },
    uWallZ: { value: backWall.z },
    uWallRect: { value: new Vector4(backWall.xMin, backWall.xMax, backWall.yMin, backWall.yMax) },
    uFloorY: { value: floor.y },
    uFloorRect: { value: new Vector4(floor.xMin, floor.xMax, floor.zMin, floor.zMax) },
  }
}

export interface RaysUniforms extends SurfaceUniforms {
  [name: string]: IUniform
  uTime: IUniform<number>
  uColor: IUniform<Color>
  /** Live ray strength: the time-of-day value times the beam visibility. */
  uStrength: IUniform<number>
  /** Unit direction of the sunlight. */
  uDirection: IUniform<Vector3>
  uWindowX: IUniform<number>
  uCentre: IUniform<Vector2>
  uHalf: IUniform<Vector2>
  uReach: IUniform<Vector2>
  uCrossSoftness: IUniform<number>
  uFadeIn: IUniform<number>
  uEndFade: IUniform<number>
  uEdgeMargin: IUniform<number>
  uMullion: IUniform<Vector3>
  uNoise: IUniform<DataTexture>
  uNoiseScale: IUniform<Vector3>
  uDrift: IUniform<number>
  uCut: IUniform<Vector2>
  uBase: IUniform<number>
}

export type RaysMaterial = ShaderMaterial & { uniforms: RaysUniforms }

/** The shape values of `RAYS` that are uniforms (the dev panel changes them live). */
export interface RaysShape {
  crossSoftness: number
  fadeIn: number
  endFade: number
  edgeMargin: number
  reachStart: number
  reachEnd: number
  noiseAcross: number
  noiseSide: number
  noiseAlong: number
  drift: number
  cutLow: number
  cutHigh: number
  base: number
  mullionDim: number
  mullionSoftness: number
}

/** Copies shape values into the existing uniform objects (mutate, never replace). */
export function applyRaysShape(material: RaysMaterial, shape: Partial<RaysShape>): void {
  const u = material.uniforms
  u.uCrossSoftness.value = shape.crossSoftness ?? u.uCrossSoftness.value
  u.uFadeIn.value = shape.fadeIn ?? u.uFadeIn.value
  u.uEndFade.value = shape.endFade ?? u.uEndFade.value
  u.uEdgeMargin.value = shape.edgeMargin ?? u.uEdgeMargin.value
  u.uReach.value.set(shape.reachStart ?? u.uReach.value.x, shape.reachEnd ?? u.uReach.value.y)
  u.uNoiseScale.value.set(shape.noiseAcross ?? u.uNoiseScale.value.x, shape.noiseSide ?? u.uNoiseScale.value.y, shape.noiseAlong ?? u.uNoiseScale.value.z)
  u.uDrift.value = shape.drift ?? u.uDrift.value
  u.uCut.value.set(shape.cutLow ?? u.uCut.value.x, shape.cutHigh ?? u.uCut.value.y)
  u.uBase.value = shape.base ?? u.uBase.value
  u.uMullion.value.set(WINDOW_FRAME.mullionWidth / 2, shape.mullionSoftness ?? u.uMullion.value.y, shape.mullionDim ?? u.uMullion.value.z)
}

/**
 * The rays are light added on top of the room, so: additive blending (order between the sheets does not matter), no
 * depth write (they never hide anything), depth test on (walls and props in front hide them). DoubleSide in a single
 * pass: a sheet may be seen from either side, and `forceSinglePass` stops three from drawing a transparent two-sided
 * material twice, which only matters for order-dependent blending. No tone mapping: it is a thin layer over an already
 * mapped picture. The uniform objects live on `userData.uniforms` and are only mutated, never replaced.
 */
export function createRaysMaterial(noise: DataTexture): RaysMaterial {
  const uniforms: RaysUniforms = {
    uTime: { value: 0 },
    uColor: { value: new Color() },
    uStrength: { value: 0 },
    uDirection: { value: new Vector3(1, -1, 0).normalize() },
    uWindowX: { value: 0 },
    uCentre: { value: new Vector2() },
    uHalf: { value: new Vector2() },
    uReach: { value: new Vector2() },
    uCrossSoftness: { value: 0 },
    uFadeIn: { value: 0 },
    uEndFade: { value: 0 },
    uEdgeMargin: { value: 0 },
    uMullion: { value: new Vector3() },
    uNoise: { value: noise },
    uNoiseScale: { value: new Vector3() },
    uDrift: { value: 0 },
    uCut: { value: new Vector2() },
    uBase: { value: 0 },
    ...createSurfaceUniforms(),
  }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: raysVertexShader,
    fragmentShader: raysFragmentShader,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    forceSinglePass: true,
    toneMapped: false,
  }) as RaysMaterial
  material.userData.uniforms = uniforms
  applyRaysShape(material, RAYS)
  return material
}

/** Objects reused every frame, so the per-frame update allocates nothing. */
export interface RaysState {
  aperture: BeamWindow
}

export function createRaysState(): RaysState {
  return { aperture: createBeamWindow() }
}

/**
 * Per-frame update from the live time of day: sun direction (from the live sun position to the world origin), the part
 * of the window that direction lights, ray colour (the sun's) and strength, and time.
 */
export function tickRays(material: RaysMaterial, state: RaysState, window: BeamWindow, values: TimeValues, delta: number): void {
  const u = material.uniforms
  const direction = beamDirectionInto(u.uDirection.value, values.sunPosition)
  const lit = apertureInto(state.aperture, window, direction, WINDOW_FRAME)
  u.uWindowX.value = lit.x
  u.uCentre.value.set(lit.y, lit.z)
  u.uHalf.value.set(lit.halfHeight, lit.halfWidth)
  u.uColor.value.copy(values.sunColor)
  u.uStrength.value = values.rayStrength * beamVisibility(direction, RAYS.visibleFrom[0], RAYS.visibleFrom[1])
  u.uTime.value += delta
}
