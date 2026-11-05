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
export function applyLook(material: SteamMaterial, look: SteamLook): void {
  const u = material.uniforms
  const { shape } = look
  u.uColor.value.set(look.color)
  u.uDensity.value = look.density
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
