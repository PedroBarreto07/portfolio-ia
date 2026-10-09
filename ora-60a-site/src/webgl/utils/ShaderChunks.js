/*
 * Tiny chunk-injection system on top of three's PBR shader.
 *
 * Three's physical shader is used as the BRDF backbone; we mark "areas"
 * in it (SIXTY_*_AREA) and materials inject their own GLSL there:
 *
 *   /// #replace #define SIXTY_UNIFORMS_AREA   → declarations
 *   /// #replace #define SIXTY_DIFFUSE_AREA    → albedo tweaks (after color_fragment)
 *   /// #replace #define SIXTY_OUTPUT_AREA     → final colour/alpha (before opaque_fragment)
 *   /// #replace #define SIXTY_VERTEX_AREA     → vertex varyings
 */

export const AREA = {
  VERTEX_UNIFORMS: '/// #replace #define SIXTY_VERTEX_UNIFORMS_AREA',
  VERTEX: '/// #replace #define SIXTY_VERTEX_AREA',
  UNIFORMS: '/// #replace #define SIXTY_UNIFORMS_AREA',
  DIFFUSE: '/// #replace #define SIXTY_DIFFUSE_AREA',
  OUTPUT: '/// #replace #define SIXTY_OUTPUT_AREA',
}

/** Marks the areas in a freshly cloned three shader. */
export function markAreas(shader) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${AREA.VERTEX_UNIFORMS}`)
    .replace('#include <project_vertex>', `#include <project_vertex>\n${AREA.VERTEX}`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${AREA.UNIFORMS}`)
    .replace('#include <color_fragment>', `#include <color_fragment>\n${AREA.DIFFUSE}`)
    .replace('#include <opaque_fragment>', `${AREA.OUTPUT}\n#include <opaque_fragment>`)
  return shader
}

/** Injects code into a marked area (areas can receive several chunks). */
export function inject(shader, area, code) {
  const key = area === AREA.VERTEX || area === AREA.VERTEX_UNIFORMS ? 'vertexShader' : 'fragmentShader'
  shader[key] = shader[key].replace(area, `${code}\n${area}`)
  return shader
}

export function replaceChunk(shader, stage, search, replacement) {
  const key = stage === 'vertex' ? 'vertexShader' : 'fragmentShader'
  if (!shader[key].includes(search)) console.warn('[ShaderChunks] anchor not found:', search)
  shader[key] = shader[key].replace(search, replacement)
  return shader
}

/** Shared GLSL utilities. */
export const GLSL_NOISE = /* glsl */ `
float sixtyHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float sixtyNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sixtyHash(i + vec3(0,0,0)), sixtyHash(i + vec3(1,0,0)), f.x),
                 mix(sixtyHash(i + vec3(0,1,0)), sixtyHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(sixtyHash(i + vec3(0,0,1)), sixtyHash(i + vec3(1,0,1)), f.x),
                 mix(sixtyHash(i + vec3(0,1,1)), sixtyHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
`
