<script>
  import { getContext, onMount } from 'svelte'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'

  /*
   * Generic wrapper: fades/slides its children in while the section
   * progress is inside `at` (or on viewport enter when at = 'enter').
   */
  let { at = 'enter', gate = null, delay = 0, y = 24, duration = 1, class: cls = '', style = '', as = 'div', children, ...rest } = $props()

  const section = getContext('section')
  let el = $state()
  let visible = false
  let gateOpen = true
  let lastP = 0

  function set(v, dir = 1) {
    if (v === visible || !el) return
    visible = v
    gsap.killTweensOf(el)
    if (v) gsap.fromTo(el, { autoAlpha: 0, y: dir * y }, { autoAlpha: 1, y: 0, duration, delay, ease: 'brand.expoOut' })
    else gsap.to(el, { autoAlpha: 0, y: -dir * y * 0.5, duration: 0.5, ease: 'power2.in' })
  }

  function evaluate(p) {
    const dir = p >= lastP ? 1 : -1
    lastP = p
    if (!Array.isArray(at)) return
    const inside = gateOpen && p >= at[0] && p <= at[1]
    set(inside, inside ? dir : p > at[1] ? 1 : -1)
  }

  onMount(() => {
    gateOpen = !gate
    gsap.set(el, { autoAlpha: 0 })
    const unsubs = []
    let st = null
    if (gate)
      unsubs.push(
        gate.subscribe((v) => {
          gateOpen = !!v
          if (Array.isArray(at)) evaluate(lastP)
          else if (v && st?.isActive) set(true)
        }),
      )
    if (Array.isArray(at) && section) unsubs.push(section.progress.subscribe(evaluate))
    else {
      st = ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        end: 'bottom 5%',
        onEnter: () => gateOpen && set(true, 1),
        onEnterBack: () => gateOpen && set(true, -1),
        onLeave: () => set(false, 1),
        onLeaveBack: () => set(false, -1),
      })
      unsubs.push(() => st.kill())
    }
    return () => unsubs.forEach((u) => u())
  })
</script>

<svelte:element this={as} bind:this={el} class={cls} {style} {...rest}>
  {@render children?.()}
</svelte:element>
