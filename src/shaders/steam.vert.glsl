uniform float uTime;
uniform float uPhase;
uniform float uHeight;
uniform float uTwistMax;
uniform float uTwistPower;
uniform float uWind;
uniform float uWidthBase;
uniform float uWidthPower;
uniform vec3 uPointer;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uPointerPower;
uniform float uPointerAnchor;
uniform float uPointerBlend;
uniform sampler2D uNoise;

varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vViewDir;

void main() {
  vUv = uv;
  float h = uv.y;

  // Geometry is 1 unit tall (y from 0 to 1); scale it to the steam height in meters.
  vec3 p = position;
  p.y *= uHeight;
  // Width profile: narrow at the opening, full width at the top. Scaling local x leaves the plane normal unchanged.
  p.x *= steamWidth(h, uWidthBase, uWidthPower);

  // Cylindrical billboard: turn the plane's local x/z axes to face the camera around Y.
  vec3 origin = modelMatrix[3].xyz;
  vec2 toCam = normalize(cameraPosition.xz - origin.xz + vec2(1e-5));
  vec2 right = vec2(toCam.y, -toCam.x);
  vec2 pxz = right * p.x + toCam * p.z;
  vec2 nxz = right * normal.x + toCam * normal.z;

  // Twist: rotate each height slice around the Y axis by a noise-driven angle.
  float twistNoise = texture2D(uNoise, vec2(0.5, h * 0.2 - uPhase * 0.05)).r * 2.0 - 1.0;
  float angle = twistAngle(h, uTwistMax, uTwistPower) * twistNoise;
  pxz = rotate2D(pxz, angle);
  nxz = rotate2D(nxz, angle);

  // Slow lateral drift (room air), growing with height.
  vec2 wind = vec2(
    texture2D(uNoise, vec2(0.25, uTime * 0.01)).r,
    texture2D(uNoise, vec2(0.75, uTime * 0.01)).r
  ) - 0.5;
  pxz += wind * 2.0 * h * h * uWind;

  vec4 world = modelMatrix * vec4(pxz.x, p.y, pxz.y, 1.0);

  // Pointer: push vertices away from the pointer on the horizontal plane.
  vec2 away = world.xz - uPointer.xz;
  float dist = max(length(away), 1e-4);
  float push = pointerPush(dist, h, uPointerRadius, uPointerStrength, uPointerPower, uPointerAnchor);
  world.xz += away / dist * push * uPointerBlend;

  vNormalW = normalize(mat3(modelMatrix) * vec3(nxz.x, normal.y, nxz.y));
  vViewDir = cameraPosition - world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
