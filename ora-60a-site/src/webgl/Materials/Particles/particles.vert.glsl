attribute vec4 aSeed;
attribute float aIndex;

uniform float uTime;
uniform float uProgress;
uniform float uSize;
uniform float uPixelRatio;
uniform float uViewportHeight;
uniform float uOpacity;
uniform float uCloud;
uniform sampler2D uNoise;
uniform mat4 uWatchMatrix;

varying float vAlpha;
varying float vShade;

// pseudo 3D noise from three slices of the tileable RGB fbm (noise-solid)
vec3 noise3(vec3 p) {
  vec3 a = texture2D(uNoise, p.xy).rgb;
  vec3 b = texture2D(uNoise, p.yz + 0.37).rgb;
  vec3 c = texture2D(uNoise, p.zx + 0.71).rgb;
  return (a + b + c) * (2.0 / 3.0) - 1.0;
}

// curl of the noise field → divergence-free, smoke-like flow
vec3 curl(vec3 p) {
  const float e = 0.03;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 px0 = noise3(p - dx);
  vec3 px1 = noise3(p + dx);
  vec3 py0 = noise3(p - dy);
  vec3 py1 = noise3(p + dy);
  vec3 pz0 = noise3(p - dz);
  vec3 pz1 = noise3(p + dz);
  float x = (py1.z - py0.z) - (pz1.y - pz0.y);
  float y = (pz1.x - pz0.x) - (px1.z - px0.z);
  float z = (px1.y - px0.y) - (py1.x - py0.x);
  return vec3(x, y, z) / (2.0 * e);
}

void main() {
  vec3 center = uWatchMatrix[3].xyz;
  vec3 start = (uWatchMatrix * vec4(position, 1.0)).xyz;

  // orbit: each particle travels its own ring around the movement
  float singleTime = uTime * 0.09 + aSeed.x * 6.2831853;
  float radius = (1.1 + 3.9 * pow(aSeed.y, 1.6)) * (0.65 + 0.35 * uProgress);
  vec3 orbit = vec3(
    sin(singleTime * 1.5 + aSeed.z * 6.2831853) * radius,
    sin(singleTime * 2.0 + aSeed.w * 6.2831853) * radius * 0.42,
    cos(singleTime * 1.5 + aSeed.z * 6.2831853) * radius
  );

  vec3 flow = curl(orbit * 0.035 + vec3(0.0, uTime * 0.006, 0.0));
  vec3 cloud = center + orbit + flow * 0.7 * uCloud + noise3(orbit * 0.05 + uTime * 0.01) * 2.2 * uCloud;

  float k = smoothstep(aSeed.w * 0.45, aSeed.w * 0.45 + 0.55, uProgress);
  vec3 jitter = noise3(position * 0.7 + uTime * 0.04) * 0.06 * (1.0 - k);
  vec3 pos = mix(start + jitter, cloud, k);

  vec4 mv = viewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;

  float grow = mix(1.0, 1.9, smoothstep(0.72, 1.0, uProgress));
  gl_PointSize = uSize * (0.35 + aSeed.y * 0.9) * grow * uPixelRatio * (uViewportHeight / 900.0) * (10.0 / max(0.5, -mv.z));

  vAlpha = uOpacity * smoothstep(0.0, 0.06, uProgress);
  vShade = 0.5 + 0.5 * sin(aIndex * 0.37 + uTime * 2.0);
}
