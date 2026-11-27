import {
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  MathUtils,
  Vector3,
  type IUniform,
} from 'three'
import { TEA_SELECT } from '../config/look.ts'
import { generatePerlinTexture } from '../lib/perlin.ts'
import { steamFragmentShader, steamVertexShader } from '../shaders/steam.ts'
import type { SteamLook, SteamNoise } from './steamDefaults.ts'

const NOISE_SIZE = 128

export interface SteamUniforms {
  [name: string]: IUniform
  uTime: IUniform<number>
  /** Rise phase: seconds scaled by the steam speed, accumulated on the CPU so speed changes never jump the pattern. */
  uPhase: IUniform<number>
  uColor: IUniform<Color>
  uDensity: IUniform<number>
  /** Time-of-day multipliers on colour and opacity (white and 1 = unchanged), see `applySteamTint`. */
  uTint: IUniform<Color>
  uTintOpacity: IUniform<number>
  uHeight: IUniform<number>
  uNoise: IUniform<DataTexture>
  uNoiseScale: IUniform<Vector2>
  uCut: IUniform<Vector2>
  uTwistMax: IUniform<number>
  uTwistPower: IUniform<number>
  uFadeIn: IUniform<number>
  uFadeOut: IUniform<number>
  uWind: IUniform<number>
  /** Width multiplier at the opening and the power of the curve towards the top (see `steamWidth`). */
  uWidthBase: IUniform<number>
  uWidthPower: IUniform<number>
  uFacing: IUniform<number>
  /** World position of the pointer on the steam plane. */
  uPointer: IUniform<Vector3>
  uPointerRadius: IUniform<number>
  uPointerStrength: IUniform<number>
  uPointerPower: IUniform<number>
  uPointerAnchor: IUniform<number>
  /** 0 when the pointer is away, 1 when it pushes; damped on the CPU. */
  uPointerBlend: IUniform<number>
}

export type SteamMaterial = ShaderMaterial & { uniforms: SteamUniforms }

/** Tileable two-channel Perlin texture (R: twist, G: alpha mask). The caller disposes it. */
export function createNoiseTexture(noise: SteamNoise): DataTexture {
  const texture = new DataTexture(
    generatePerlinTexture({ size: NOISE_SIZE, ...noise }),
    NOISE_SIZE,
    NOISE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  )
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.generateMipmaps = false
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  return texture
}

/**
 * Steam is unlit and see-through, so: transparent, no depth write (it must not hide what is
 * behind it or itself), normal alpha blending (additive would blow out on the cream background),
 * DoubleSide (the twist can turn the plane's back toward the camera).
 * The uniform objects live on `userData.uniforms` and are only mutated, never replaced.
 */
export function createSteamMaterial(noise: DataTexture): SteamMaterial {
  const uniforms: SteamUniforms = {
    uTime: { value: 0 },
    uPhase: { value: 0 },
    uColor: { value: new Color() },
    uDensity: { value: 1 },
    uTint: { value: new Color(1, 1, 1) },
    uTintOpacity: { value: 1 },
    uHeight: { value: 0.25 },
    uNoise: { value: noise },
    uNoiseScale: { value: new Vector2(1, 0.8) },
    uCut: { value: new Vector2(0.4, 0.75) },
    uTwistMax: { value: 0 },
    uTwistPower: { value: 1 },
    uFadeIn: { value: 0.15 },
    uFadeOut: { value: 0.55 },
    uWind: { value: 0 },
    uWidthBase: { value: 1 },
    uWidthPower: { value: 1 },
    uFacing: { value: 0 },
    uPointer: { value: new Vector3() },
    uPointerRadius: { value: 0.07 },
    uPointerStrength: { value: 0 },
    uPointerPower: { value: 1 },
    uPointerAnchor: { value: 0.4 },
    uPointerBlend: { value: 0 },
  }
  const material = new ShaderMaterial({
    uniforms,
    vertexShader: steamVertexShader,
    fragmentShader: steamFragmentShader,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  })
  material.userData.uniforms = uniforms
  return material as SteamMaterial
}

/** Copies a look into the existing uniform objects (mutate, never replace). */
export function applyLook(material: SteamMaterial, look: SteamLook, withAppearance = true): void {
  const u = material.uniforms
  const { shape } = look
  // Colour and density are skipped for the tea steam: `dampAppearance` owns them (they follow the selected tea).
  if (withAppearance) {
    u.uColor.value.set(look.color)
    u.uDensity.value = look.density
  }
  u.uHeight.value = look.height
  u.uNoiseScale.value.set(look.noiseScaleX, look.noiseScaleY)
  u.uCut.value.set(look.cutLow, look.cutHigh)
  u.uWind.value = look.wind
  u.uWidthBase.value = look.widthBase
  u.uWidthPower.value = look.widthPower
  u.uFacing.value = look.facing
  u.uTwistMax.value = shape.twistMax
  u.uTwistPower.value = shape.twistPower
  u.uFadeIn.value = shape.fadeIn
  u.uFadeOut.value = shape.fadeOut
  u.uPointerRadius.value = shape.pointerRadius
  u.uPointerStrength.value = shape.pointerStrength
  u.uPointerPower.value = shape.pointerPower
  u.uPointerAnchor.value = shape.pointerAnchor
}

/**
 * Copies the time-of-day tint into the existing uniform objects (per frame). It is a separate factor, so the colour and
 * density the tea selection damps (`dampAppearance`) stay as they are.
 */
export function applySteamTint(material: SteamMaterial, tint: Color, opacity: number): void {
  material.uniforms.uTint.value.copy(tint)
  material.uniforms.uTintOpacity.value = opacity
}

const POINTER_DAMPING = 8
const BLEND_DAMPING = 5

export interface PointerTarget {
  x: number
  y: number
  z: number
  active: boolean
}

/** Per-frame update: advances time and rise phase, damps the pointer uniforms toward the target. */
export function tickSteam(material: SteamMaterial, delta: number, speed: number, pointer: PointerTarget): void {
  const u = material.uniforms
  u.uTime.value += delta
  u.uPhase.value += delta * speed
  const p = u.uPointer.value
  p.x = MathUtils.damp(p.x, pointer.x, POINTER_DAMPING, delta)
  p.y = MathUtils.damp(p.y, pointer.y, POINTER_DAMPING, delta)
  p.z = MathUtils.damp(p.z, pointer.z, POINTER_DAMPING, delta)
  u.uPointerBlend.value = MathUtils.damp(u.uPointerBlend.value, pointer.active ? 1 : 0, BLEND_DAMPING, delta)
}

/** What the tea steam is heading for (color is stored in the working colour space, like the uniform). */
export interface AppearanceTarget {
  color: Color
  density: number
  speed: number
}

/** Damped state that is not a uniform: the rise speed. `ready` is false until the first call snaps to the target. */
export interface AppearanceState {
  speed: number
  ready: boolean
}

/**
 * Damps the steam colour, density and speed toward the target (first call snaps, so the scene starts on the selected
 * tea). Mutates the existing uniform objects. Channels are damped separately, so each moves monotonically.
 */
export function dampAppearance(material: SteamMaterial, state: AppearanceState, target: AppearanceTarget, delta: number): void {
  const u = material.uniforms
  if (!state.ready) {
    u.uColor.value.copy(target.color)
    u.uDensity.value = target.density
    state.speed = target.speed
    state.ready = true
    return
  }
  const dt = Math.min(delta, TEA_SELECT.maxDelta)
  const k = TEA_SELECT.teaDamping
  const c = u.uColor.value
  c.r = MathUtils.damp(c.r, target.color.r, k, dt)
  c.g = MathUtils.damp(c.g, target.color.g, k, dt)
  c.b = MathUtils.damp(c.b, target.color.b, k, dt)
  u.uDensity.value = MathUtils.damp(u.uDensity.value, target.density, k, dt)
  state.speed = MathUtils.damp(state.speed, target.speed, k, dt)
}
