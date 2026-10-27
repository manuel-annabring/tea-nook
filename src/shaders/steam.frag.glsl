uniform vec3 uColor;
uniform float uDensity;
uniform float uPhase;
uniform float uFadeIn;
uniform float uFadeOut;
uniform float uFacing;
uniform vec2 uNoiseScale;
uniform vec2 uCut;
uniform sampler2D uNoise;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  float h = vUv.y;

  // Noise scrolls downward in texture space, so the pattern rises along the steam.
  float n = texture2D(uNoise, vec2(vUv.x * uNoiseScale.x, h * uNoiseScale.y - uPhase * 0.12)).g;
  float alpha = smoothstep(uCut.x, uCut.y, n);

  alpha *= heightFade(h, uFadeIn, uFadeOut);

  // Soften surfaces that turn away from the camera (the twist can rotate the plane edge-on).
  float facing = abs(dot(normalize(vNormalW), normalize(vViewDir)));
  alpha *= mix(1.0, smoothstep(0.0, 0.7, facing), uFacing);

  // Soft left and right edges of the plane.
  alpha *= smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);

  gl_FragColor = vec4(uColor, alpha * uDensity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
