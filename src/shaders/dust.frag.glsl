// A soft round speck of light in the sun colour (additive blending): full in the middle, nothing at the rim of the point.

uniform vec3 uColor;
uniform float uCore; // share of the radius that is fully bright

varying float vAlpha;

void main() {
  float radius = length(gl_PointCoord - 0.5) * 2.0;
  float alpha = vAlpha * (1.0 - smoothstep(uCore, 1.0, radius));
  if (alpha <= 0.0) discard;
  gl_FragColor = vec4(uColor, alpha);
  #include <colorspace_fragment>
}
