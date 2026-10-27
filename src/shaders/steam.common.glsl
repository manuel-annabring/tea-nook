// GLSL twins of src/lib/steamMath.ts. Keep the formulas identical.

float twistAngle(float h, float twistMax, float twistPower) {
  return twistMax * pow(clamp(h, 0.0, 1.0), twistPower);
}

float heightFade(float h, float fadeIn, float fadeOut) {
  return smoothstep(0.0, fadeIn, h) * (1.0 - smoothstep(fadeOut, 1.0, h));
}

float pointerPush(float dist, float h, float radius, float strength, float power, float anchor) {
  float falloff = pow(1.0 - smoothstep(0.0, radius, dist), power);
  return strength * falloff * smoothstep(0.0, anchor, h);
}

vec2 rotate2D(vec2 v, float a) {
  float s = sin(a);
  float c = cos(a);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}
