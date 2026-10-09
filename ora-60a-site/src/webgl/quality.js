/** Device tiers: texture sizes, particle count, MSAA, pixel ratio. */
export function detectQuality() {
  const params = new URLSearchParams(location.search)
  const coarse = matchMedia('(pointer: coarse)').matches
  const small = matchMedia('(max-width: 767px)').matches
  const mobile = small || (coarse && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent))
  // The OS-level preference only softens the scroll (Windows turns it on
  // when "animation effects" are off, often unintentionally). The full
  // reduced mode (no particles, instant intro) is opt-in with ?reduced.
  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const reduced = params.has('reduced')
  const cores = navigator.hardwareConcurrency || 4
  const memory = navigator.deviceMemory || 8
  const low = mobile || cores <= 4 || memory <= 4 || params.has('low')
  return {
    mobile,
    reduced,
    prefersReduced,
    low,
    textureSize: low ? 512 : 1024,
    printSize: low ? 1024 : 2048,
    geometry: low ? 'low' : 'high',
    particles: reduced ? 64 : mobile ? 14000 : low ? 24000 : 42000,
    noParticles: reduced,
    msaa: mobile ? 2 : 4,
    maxDpr: mobile ? 1.5 : 2,
    adaptive: !params.has('shots'),
  }
}
