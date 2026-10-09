import { Color, MeshPhysicalMaterial, ShaderChunk } from 'three'
import { AREA, GLSL_NOISE, inject, markAreas, replaceChunk } from '../../utils/ShaderChunks.js'

/*
 * "Sixty" PBR — our own physically based material.
 *
 * It keeps three's BRDF / IBL code (energy conserving, anisotropy, PMREM)
 * and layers the art-direction features on top through marked areas:
 *  - a second, *additive* environment map (jewellery sparkle) with its own
 *    rotation and intensity, sampled with roughness-driven LOD;
 *  - global darkness progress: the studio is "switched off", only the
 *    hottest softbox reflections survive (Mechanical Heart section);
 *  - invert progress, roughness-map intensity, ambient term;
 *  - noise dissolve with a hot rim (parts melting into particles);
 *  - a sapphire glass mode: fresnel alpha + premultiplied reflections.
 */

export const GlobalUniforms = {
  uTime: { value: 0 },
  uDarknessProgress: { value: 0 },
  uInvertProgress: { value: 0 },
}

const VERTEX_DECL = /* glsl */ `varying vec3 vSixtyPos;`
const VERTEX_CODE = /* glsl */ `vSixtyPos = transformed;`

const FRAGMENT_DECL = /* glsl */ `
varying vec3 vSixtyPos;
uniform float uTime;
uniform float uDarknessProgress;
uniform float uInvertProgress;
uniform float uRoughnessMapIntensity;
uniform float uDissolve;
uniform float uFade;
uniform vec3 uDissolveColor;
uniform vec3 uAmbient;
uniform float uAmbientIntensity;
#ifdef SIXTY_ADDITIVE
  uniform sampler2D uAdditiveEnvMap;
  uniform float uAdditiveEnvMapIntensity;
  uniform float uAdditiveEnvMapRotation;
#endif
${GLSL_NOISE}
vec3 sixtyRadiance(vec3 r) {
  // "lights off": keep only the brightest softboxes, crush the room
  float l = dot(r, vec3(0.2126, 0.7152, 0.0722));
  vec3 dark = r * smoothstep(0.35, 3.0, l) * 1.6 + r * 0.05;
  return mix(r, dark, uDarknessProgress);
}
`

const ROUGHNESS_CODE = /* glsl */ `
float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
  roughnessFactor *= mix( 1.0, texelRoughness.g, uRoughnessMapIntensity );
#endif
`

const OUTPUT_CODE = /* glsl */ `
#ifdef SIXTY_ADDITIVE
{
  vec3 sr = reflect( -geometryViewDir, normal );
  sr = inverseTransformDirection( sr, viewMatrix );
  float ca = cos( uAdditiveEnvMapRotation );
  float sa = sin( uAdditiveEnvMapRotation );
  sr.xz = mat2( ca, sa, -sa, ca ) * sr.xz;
  vec3 addEnv = textureLod( uAdditiveEnvMap, equirectUv( sr ), material.roughness * 7.0 ).rgb;
  float sf = 0.55 + 0.45 * pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 2.0 );
  outgoingLight += addEnv * material.specularColorBlended * uAdditiveEnvMapIntensity * sf * ( 1.0 - 0.4 * uDarknessProgress );
}
#endif

outgoingLight += uAmbient * uAmbientIntensity * diffuseColor.rgb * ( 1.0 - uDarknessProgress );

#ifdef SIXTY_GLASS
{
  float gf = pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), 4.0 );
  float ga = clamp( opacity * ( 0.3 + gf * 1.6 ), 0.0, 1.0 );
  outgoingLight = ( totalSpecular * ( 0.9 + gf ) + totalDiffuse * ga ) * uFade;
  diffuseColor.a = ga * uFade;
}
#else
  // smooth fade (case & bracelet leaving the movement): materials of the
  // case group are rendered as transparent with depthWrite, so at uFade = 1
  // they are pixel-identical to opaque ones
  diffuseColor.a *= uFade;
#endif

if ( uDissolve > 0.0 ) {
  float dn = sixtyNoise( vSixtyPos * 9.0 ) * 0.6 + sixtyNoise( vSixtyPos * 31.0 + 3.1 ) * 0.4;
  float th = uDissolve * 1.1 - 0.02;
  if ( dn < th ) discard;
  float rim = 1.0 - smoothstep( th, th + 0.025, dn );
  outgoingLight += uDissolveColor * rim * 1.3;
}

outgoingLight = mix( outgoingLight, vec3( 1.0 ) - min( outgoingLight, vec3( 1.0 ) ), uInvertProgress );
`

export class SixtyMaterial extends MeshPhysicalMaterial {
  constructor({
    additiveEnvMap = null,
    additiveEnvMapIntensity = 0,
    additiveEnvMapRotation = 0,
    roughnessMapIntensity = 1,
    ambient = '#ffffff',
    ambientIntensity = 0,
    glass = false,
    chunks = {},
    dissolveColor = '#ffffff',
    ...params
  } = {}) {
    super(params)
    this.isSixtyMaterial = true
    this.chunks = chunks
    this.sixty = {
      uAdditiveEnvMap: { value: additiveEnvMap },
      uAdditiveEnvMapIntensity: { value: additiveEnvMapIntensity },
      uAdditiveEnvMapRotation: { value: additiveEnvMapRotation },
      uRoughnessMapIntensity: { value: roughnessMapIntensity },
      uAmbient: { value: new Color(ambient) },
      uAmbientIntensity: { value: ambientIntensity },
      uDissolve: { value: 0 },
      uFade: { value: 1 },
      uDissolveColor: { value: new Color(dissolveColor) },
      ...GlobalUniforms,
    }
    this.defines = { ...this.defines, SIXTY: '' }
    if (additiveEnvMap) this.defines.SIXTY_ADDITIVE = ''
    if (glass) {
      this.defines.SIXTY_GLASS = ''
      this.transparent = true
      this.premultipliedAlpha = true
      this.depthWrite = false
    }
  }

  // Convenience accessors used by GSAP tweens / config / debug GUI
  get additiveEnvMapIntensity() { return this.sixty.uAdditiveEnvMapIntensity.value }
  set additiveEnvMapIntensity(v) { this.sixty.uAdditiveEnvMapIntensity.value = v }
  get additiveEnvMapRotation() { return this.sixty.uAdditiveEnvMapRotation.value }
  set additiveEnvMapRotation(v) { this.sixty.uAdditiveEnvMapRotation.value = v }
  get roughnessMapIntensity() { return this.sixty.uRoughnessMapIntensity.value }
  set roughnessMapIntensity(v) { this.sixty.uRoughnessMapIntensity.value = v }
  get ambientIntensity() { return this.sixty.uAmbientIntensity.value }
  set ambientIntensity(v) { this.sixty.uAmbientIntensity.value = v }
  get fade() { return this.sixty.uFade.value }
  set fade(v) { this.sixty.uFade.value = v }
  get dissolve() { return this.sixty.uDissolve.value }
  set dissolve(v) { this.sixty.uDissolve.value = v }

  /** Proper clone(): keeps the Sixty uniforms (own copies), defines and chunks. */
  copy(source) {
    super.copy(source)
    if (!source.isSixtyMaterial) return this
    this.chunks = { ...source.chunks }
    this.defines = { ...source.defines }
    for (const [k, u] of Object.entries(source.sixty)) {
      if (GlobalUniforms[k]) continue
      const v = u.value
      this.sixty[k] = { value: v && v.isColor ? v.clone() : v }
    }
    this.userData = { ...source.userData }
    return this
  }

  onBeforeCompile(shader) {
    Object.assign(shader.uniforms, this.sixty)
    markAreas(shader)
    inject(shader, AREA.VERTEX_UNIFORMS, VERTEX_DECL)
    inject(shader, AREA.VERTEX, VERTEX_CODE)
    inject(shader, AREA.UNIFORMS, FRAGMENT_DECL)
    if (this.chunks.uniforms) inject(shader, AREA.UNIFORMS, this.chunks.uniforms)
    if (this.chunks.diffuse) inject(shader, AREA.DIFFUSE, this.chunks.diffuse)
    inject(shader, AREA.OUTPUT, OUTPUT_CODE)
    if (this.chunks.output) inject(shader, AREA.OUTPUT, this.chunks.output)
    replaceChunk(shader, 'fragment', '#include <roughnessmap_fragment>', ROUGHNESS_CODE)
    replaceChunk(shader, 'fragment', '#include <lights_fragment_maps>', (LIGHTS_MAPS ||= patchLightsMaps()))
    replaceChunk(
      shader,
      'fragment',
      '#include <premultiplied_alpha_fragment>',
      '#ifndef SIXTY_GLASS\n#include <premultiplied_alpha_fragment>\n#endif',
    )
  }

  customProgramCacheKey() {
    return `sixty|${this.chunks.uniforms || ''}|${this.chunks.diffuse || ''}|${this.chunks.output || ''}`
  }
}

let LIGHTS_MAPS = null
function patchLightsMaps() {
  return ShaderChunk.lights_fragment_maps
    .replace('radiance += iblRadiance;', 'radiance += sixtyRadiance( iblRadiance );')
    .replace(
      'iblIrradiance += getIBLIrradiance( geometryNormal );',
      'iblIrradiance += getIBLIrradiance( geometryNormal ) * ( 1.0 - 0.7 * uDarknessProgress );',
    )
}
