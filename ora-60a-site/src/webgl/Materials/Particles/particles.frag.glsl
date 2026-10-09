uniform float uDark;

varying float vAlpha;
varying float vShade;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float soft = 1.0 - smoothstep(0.0, 0.5, d);
  soft *= soft;
  // light studio: graphite smoke — night: white dust
  vec3 light = vec3(mix(0.05, 0.16, vShade));
  vec3 night = vec3(mix(1.0, 3.2, vShade));
  vec3 col = mix(light, night, uDark);
  float a = clamp(soft * vAlpha * mix(0.5, 1.4, uDark), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}
