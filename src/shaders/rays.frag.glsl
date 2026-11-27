// Added light: the colour is the sun colour, the alpha is how much of it this sheet adds (additive blending).
// Every edge of a sheet fades to nothing: top and bottom (crossProfile), the glass end (lengthFade) and the far end
// (endFade: worktop, back wall or floor; lengthFade: the reach).

uniform vec3 uColor;
uniform float uStrength;
uniform float uTime;
uniform vec3 uDirection;
uniform vec2 uHalf;
uniform vec2 uReach;
uniform float uCrossSoftness;
uniform float uFadeIn;
uniform float uEndFade;
uniform float uEdgeMargin;
uniform vec3 uMullion; // half width, softness, share of light removed
uniform sampler2D uNoise;
uniform vec3 uNoiseScale; // across the height, shift across the width, per meter along the beam
uniform float uDrift;
uniform vec2 uCut;
uniform float uBase;
uniform float uWorktopY;
uniform vec4 uWorktopRect;
uniform float uWallZ;
uniform vec4 uWallRect;
uniform float uFloorY;
uniform vec4 uFloorRect;

varying vec3 vOrigin;
varying float vT;
varying vec2 vCross;
varying float vWeight;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float alpha = uStrength * vWeight;
  alpha *= crossProfile(vCross.x, uCrossSoftness);
  alpha *= mullionFade((vCross.x * 2.0 - 1.0) * uHalf.x, uMullion.x, uMullion.y, uMullion.z);
  alpha *= lengthFade(vT, uFadeIn, uReach.x, uReach.y);
  alpha *= horizontalFade(vOrigin, uDirection, vT, uWorktopY, uWorktopRect, uEndFade, uEdgeMargin);
  alpha *= wallFade(vOrigin, uDirection, vT, uWallZ, uWallRect, uEndFade, uEdgeMargin);
  alpha *= horizontalFade(vOrigin, uDirection, vT, uFloorY, uFloorRect, uEndFade, uEdgeMargin);

  // Streaks: noise that changes quickly across the beam and slowly along it, two layers wandering against each other.
  vec2 uv = vec2(vCross.x * uNoiseScale.x + vCross.y * uNoiseScale.y, vT * uNoiseScale.z);
  float wander = uTime * uDrift;
  float coarse = texture2D(uNoise, uv + vec2(wander, -1.7 * wander)).r;
  float fine = texture2D(uNoise, uv * vec2(2.3, 1.4) + vec2(-1.3 * wander, -wander)).g;
  alpha *= mix(uBase, 1.0, smoothstep(uCut.x, uCut.y, mix(coarse, fine, 0.4)));

  // One colour step of noise, so the weak gradients do not band. Nothing is added where there is no light.
  alpha = max(0.0, alpha + (hash(gl_FragCoord.xy) - 0.5) / 255.0 * step(0.001, alpha));

  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
