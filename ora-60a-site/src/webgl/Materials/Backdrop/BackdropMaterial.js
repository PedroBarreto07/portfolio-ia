import { ShaderMaterial } from 'three'

/*
 * The "dial behind the dial": a thin-line circle split into sectors, a
 * gradient wedge trailing a black arc that sweeps like a hand. Drawn in
 * the scene (not CSS) so it sits *behind* the watch and writes alpha.
 */
export default class BackdropMaterial extends ShaderMaterial {
  constructor() {
    super({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uOpacity: { value: 1 },
        uRotation: { value: 0 },
        uHand: { value: 0 },
        uDark: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        uniform float uRotation;
        uniform float uHand;
        uniform float uDark;
        varying vec2 vUv;
        #define TAU 6.28318530718

        float line(float d, float w) {
          float f = fwidth(d);
          return 1.0 - smoothstep(w, w + f * 1.5, abs(d));
        }

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.x, p.y); // clockwise from 12 o'clock
          if (a < 0.0) a += TAU;

          float rings = line(r - 0.985, 0.0012) + line(r - 0.72, 0.001) * 0.7 + line(r - 0.42, 0.001) * 0.45;

          float sector = TAU / 12.0;
          float ar = mod(a - uRotation + sector * 0.5, sector) - sector * 0.5;
          float spokes = line(r * sin(ar), 0.0009) * step(0.42, r) * step(r, 0.985) * 0.6;

          float tick = TAU / 60.0;
          float at = mod(a - uRotation + tick * 0.5, tick) - tick * 0.5;
          float ticks = line(r * sin(at), 0.0007) * step(0.95, r) * step(r, 0.985) * 0.8;

          float behind = mod(uHand - a, TAU);
          float wedge = (1.0 - smoothstep(0.0, sector * 2.5, behind)) * step(0.42, r) * step(r, 0.985);
          wedge *= smoothstep(0.42, 0.985, r) * 0.9 + 0.1;

          float arc = (1.0 - smoothstep(0.0035, 0.0055, abs(r - 0.985))) * step(behind, 0.6);

          vec3 col = mix(vec3(0.06), vec3(0.6), uDark);
          float alpha = clamp(rings + spokes + ticks, 0.0, 1.0) * 0.55;
          alpha = max(alpha, wedge * 0.14);
          // the sweeping black arc
          col = mix(col, mix(vec3(0.0), vec3(1.0), uDark), arc);
          alpha = max(alpha, arc * 0.95);
          gl_FragColor = vec4(col, alpha * uOpacity);
        }`,
    })
  }
}
