// Light rays: upright sheets from the lit part of the window along the sun direction. All positions are computed here
// from uniforms (the geometry never changes), so the rays follow the sun without touching a buffer.
// position: x = along the beam (0 at the glass, 1 at the reach), y = across its height (0..1), z = across its width (-1..1).

uniform vec3 uDirection;
uniform float uWindowX;
uniform vec2 uCentre; // y, z of the window centre
uniform vec2 uHalf; // half height and half width of the lit opening
uniform vec2 uReach; // distance where the long rays start to dissolve, and where they are gone

attribute float aWeight;

varying vec3 vOrigin; // the point of the window this part of the sheet comes from
varying float vT; // distance from that point along the beam, meters
varying vec2 vCross; // across the height (0..1) and the width (-1..1)
varying float vWeight;

void main() {
  vec3 origin = vec3(uWindowX, uCentre.x + (position.y * 2.0 - 1.0) * uHalf.x, uCentre.y + position.z * uHalf.y);
  float t = position.x * uReach.y;
  vOrigin = origin;
  vT = t;
  vCross = position.yz;
  vWeight = aWeight;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(origin + uDirection * t, 1.0);
}
