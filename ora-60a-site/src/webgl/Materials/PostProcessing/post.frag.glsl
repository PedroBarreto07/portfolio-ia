precision highp float;

uniform sampler2D tScene;
uniform sampler2D tGrain;
uniform vec2 uResolution;
uniform float uTime;
uniform float uExposure;
uniform float uContrast;
uniform float uGamma;
uniform float uSaturation;
uniform float uBackgroundMultiplier;
uniform float uDarkness;
uniform vec2 uMouse;
uniform float uLongpress;
uniform float uNoise;
uniform float uFisheye;
uniform float uVignette;
// transitions
uniform float uOverlay;       // 0 → 1 covers (wave from bottom), 1 → 2 uncovers
uniform float uOverlayDark;   // overlay tint (0 = studio light, 1 = night)
uniform float uFocus;         // vertical highlight band
uniform float uScreenX;
uniform float uZoomProgress;
uniform float uLaser;
uniform float uLaserX;
uniform vec3 uLightA;
uniform vec3 uLightB;
uniform vec3 uDarkA;
uniform vec3 uDarkB;

varying vec2 vUv;

// Khronos PBR Neutral tone mapping — keeps product colours (gold!) honest
vec3 neutralTonemap(vec3 color) {
  const float startCompression = 0.8 - 0.04;
  const float desaturation = 0.15;
  float x = min(color.r, min(color.g, color.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  color -= offset;
  float peak = max(color.r, max(color.g, color.b));
  if (peak < startCompression) return color;
  const float d = 1.0 - startCompression;
  float newPeak = 1.0 - d * d / (peak + d - startCompression);
  color *= newPeak / peak;
  float g = 1.0 - 1.0 / (desaturation * (peak - newPeak) + 1.0);
  return mix(color, newPeak * vec3(1.0), g);
}

float pattern(vec2 p, float t) {
  float x = p.x;
  float y = p.y;
  return sin(x * 4.0 * sin(x * 4.0) + t + sin(y * 4.0 + t * 1.3)) - sin(y + t + sin(x * 3.0 + t) * 4.0);
}

// Procedural studio backdrop: nested sines, radial vignette, mouse drift
vec3 background(vec2 uv, float dark) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 q = p * 0.55 + uMouse * 0.035 * (1.0 + uLongpress);
  float t = uTime * 0.11;
  float v = pattern(q, t) * 0.25 + 0.5;
  float dist = length(p * vec2(0.75, 1.0));
  float vig = 1.0 - smoothstep(0.15, 0.95, dist);
  float k = mix(0.62, v, uBackgroundMultiplier);
  k = mix(k * 0.55, k, vig);
  k = clamp(k + (vig - 0.5) * 0.18 * uVignette, 0.0, 1.0);
  vec3 light = mix(uLightB, uLightA, k);
  vec3 night = mix(uDarkA, uDarkB, k * k * (0.35 + 0.65 * uBackgroundMultiplier));
  return mix(light, night, dark);
}

void main() {
  vec2 uv = vUv;

  if (uFisheye > 0.0) {
    vec2 c = uv - 0.5;
    float r2 = dot(c, c);
    uv = 0.5 + c * (1.0 - uFisheye * r2);
  }

  vec4 scene = texture2D(tScene, uv);
  float a = clamp(scene.a, 0.0, 1.0);
  vec3 col = scene.rgb / max(a, 0.0001);

  // display transform: exposure → neutral tonemap → gamma → contrast
  col = neutralTonemap(col * uExposure);
  col = pow(max(col, 0.0), vec3(1.0 / uGamma));
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;

  vec3 bg = background(uv, uDarkness);
  vec3 outc = mix(bg, col, a);

  // laser scan line, visible on geometry only
  if (uLaser > 0.0) {
    float d = abs(uv.x - uLaserX) * uResolution.x;
    float line = exp(-d * 0.9) + exp(-d * 0.06) * 0.18;
    float passed = 1.0 - smoothstep(uLaserX - 0.06, uLaserX + 0.002, uv.x);
    outc += vec3(1.0) * line * a * uLaser;
    outc = mix(outc, outc * 1.06 + 0.03, passed * a * uLaser * 0.5);
  }

  // vertical focus band around the selected part
  if (uFocus > 0.0) {
    float aspect = uResolution.x / uResolution.y;
    float w = mix(0.04, 0.14, uZoomProgress) * (1.0 / aspect) * 1.6;
    float d = abs(uv.x - uScreenX);
    float band = smoothstep(w, w + 0.08, d);
    vec3 veil = background(uv, uDarkness);
    outc = mix(outc, mix(outc, veil, 0.82), band * uFocus);
  }

  // wave overlay (DisassemblyOverlay): covers with a sine-edged curtain
  if (uOverlay > 0.0 && uOverlay < 2.0) {
    float y = uv.y + sin(uv.x * 8.0 + uTime * 2.0) * 0.035 + sin(uv.x * 3.0 - uTime) * 0.02;
    float top = uOverlay * 1.25 - 0.1;
    float bottom = (uOverlay - 1.0) * 1.25 - 0.1;
    float m = (1.0 - smoothstep(top - 0.02, top + 0.02, y)) * smoothstep(bottom - 0.02, bottom + 0.02, y);
    vec3 curtain = background(uv, uOverlayDark);
    outc = mix(outc, curtain, m);
  }

  // film grain
  vec2 guv = uv * uResolution / 256.0 + fract(vec2(uTime * 13.17, uTime * 7.31));
  float grain = texture2D(tGrain, guv).r - 0.5;
  outc += grain * uNoise * (1.0 + uLongpress * 0.5);

  gl_FragColor = vec4(clamp(outc, 0.0, 1.0), 1.0);
}
