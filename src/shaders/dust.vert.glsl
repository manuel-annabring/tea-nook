// Dust motes: one point per mote. Position, box fade and beam weight are the GLSL twins of `dustPositionInto`, `boxFade`
// and `dustBeamWeight` in src/lib/dust.ts (change both together); the falloff curves come from rays.common.glsl.
// position: start position of the mote as shares of the box (0..1).

uniform float uTime;
uniform vec3 uBoxMin;
uniform vec3 uBoxSize;
uniform float uWobble;
uniform float uBoxFade;

uniform vec3 uDirection;
uniform float uWindowX;
uniform vec2 uCentre; // y, z of the window centre
uniform vec2 uHalf; // half height and half width of the lit opening
uniform float uBeam; // beam visibility for the sun direction
uniform float uSoftness;
uniform float uFadeIn;
uniform vec2 uReach;
uniform float uEndFade;
uniform float uEdgeMargin;
uniform float uWorktopY;
uniform vec4 uWorktopRect;
uniform float uWallZ;
uniform vec4 uWallRect;
uniform float uFloorY;
uniform vec4 uFloorRect;

uniform float uStrength;
uniform float uOutside; // brightness outside the beam, as a share of the brightness inside
uniform float uSize; // mean diameter, meters
uniform float uMinPixels;
uniform float uViewportHeight; // drawing buffer height, device pixels

attribute vec3 aVelocity;
attribute vec4 aWobble; // phase per axis, rate
attribute vec2 aLook; // size factor, brightness

varying float vAlpha;

float beamWeight(vec3 p) {
  if (!(uDirection.x > 0.0)) return 0.0;
  float t = (p.x - uWindowX) / uDirection.x;
  if (t < 0.0) return 0.0;
  vec3 o = vec3(uWindowX, p.y - uDirection.y * t, p.z - uDirection.z * t);
  float halfSoft = uSoftness * 0.5;
  float across = softInside(o.y, uCentre.x - uHalf.x + halfSoft, uCentre.x + uHalf.x - halfSoft, uSoftness) *
    softInside(o.z, uCentre.y - uHalf.y + halfSoft, uCentre.y + uHalf.y - halfSoft, uSoftness);
  return across * lengthFade(t, uFadeIn, uReach.x, uReach.y) *
    horizontalFade(o, uDirection, t, uWorktopY, uWorktopRect, uEndFade, uEdgeMargin) *
    wallFade(o, uDirection, t, uWallZ, uWallRect, uEndFade, uEdgeMargin) *
    horizontalFade(o, uDirection, t, uFloorY, uFloorRect, uEndFade, uEdgeMargin);
}

void main() {
  vec3 wobble = uWobble * sin(6.28318530718 * (aWobble.xyz + aWobble.w * uTime));
  vec3 share = fract(position + (aVelocity * uTime + wobble) / uBoxSize);
  vec3 p = uBoxMin + share * uBoxSize;
  vec3 edge = smoothstep(0.0, uBoxFade, share) * smoothstep(0.0, uBoxFade, 1.0 - share);

  vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * viewPosition;

  // A diameter in meters, as device pixels: the same size on every screen and pixel ratio, smaller further away.
  float pixels = uSize * aLook.x * projectionMatrix[1][1] * 0.5 * uViewportHeight / -viewPosition.z;
  gl_PointSize = max(pixels, uMinPixels);
  // A mote too small to draw keeps its size and gets fainter instead (no flicker between pixels).
  float coverage = min(1.0, pixels * pixels / (uMinPixels * uMinPixels));

  float light = mix(uOutside, 1.0, beamWeight(p) * uBeam);
  vAlpha = uStrength * light * aLook.y * edge.x * edge.y * edge.z * coverage;
}
