// GLSL twins of the falloff curves and the soft ray end in src/lib/beam.ts. Change both together.

float crossProfile(float v, float softness) {
  return smoothstep(0.0, softness, v) * smoothstep(0.0, softness, 1.0 - v);
}

float mullionFade(float offset, float halfWidth, float softness, float dim) {
  return 1.0 - dim * (1.0 - smoothstep(halfWidth, halfWidth + softness, abs(offset)));
}

float lengthFade(float t, float fadeIn, float reachStart, float reachEnd) {
  return smoothstep(0.0, fadeIn, t) * (1.0 - smoothstep(reachStart, reachEnd, t));
}

float softInside(float value, float lo, float hi, float margin) {
  return smoothstep(lo - margin, lo, value) * (1.0 - smoothstep(hi, hi + margin, value));
}

float surfaceFade(float t, float hit, float inside, float fadeOut) {
  if (!(hit > 0.0)) return 1.0;
  return 1.0 - inside * (1.0 - smoothstep(0.0, fadeOut, hit - t));
}

// Level surface at height y; rect = (xMin, xMax, zMin, zMax).
float horizontalFade(vec3 o, vec3 d, float t, float y, vec4 rect, float fadeOut, float margin) {
  if (d.y == 0.0) return 1.0;
  float hit = (y - o.y) / d.y;
  vec3 p = o + d * hit;
  float inside = softInside(p.x, rect.x, rect.y, margin) * softInside(p.z, rect.z, rect.w, margin);
  return surfaceFade(t, hit, inside, fadeOut);
}

// Upright wall at depth z; rect = (xMin, xMax, yMin, yMax).
float wallFade(vec3 o, vec3 d, float t, float z, vec4 rect, float fadeOut, float margin) {
  if (d.z == 0.0) return 1.0;
  float hit = (z - o.z) / d.z;
  vec3 p = o + d * hit;
  float inside = softInside(p.x, rect.x, rect.y, margin) * softInside(p.y, rect.z, rect.w, margin);
  return surfaceFade(t, hit, inside, fadeOut);
}
