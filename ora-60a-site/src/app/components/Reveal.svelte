<script>
  import { getContext, onMount } from 'svelte'
  import gsap from 'gsap'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import SplitText from '../utils/SplitText.js'
  import { scramble } from '../utils/scramble.js'
  import bus, { EVENTS } from '../../state/bus.js'

  /*
   * Text that reveals itself while its section progress is inside `at`
   * ([from, to]); or on viewport enter when `at` is 'enter'.
   * type: 'chars' | 'words' | 'lines' | 'fade' | 'scramble'
   * Enter/leave direction follows the scroll direction.
   */
  let {
    html = '',
    as = 'div',
    class: cls = '',
    style = '',
    at = 'enter',
    type = 'chars',
    stagger = null,
    delay = 0,
    duration = null,
    gate = null,
    id = undefined,
  } = $props()

  const section = getContext('section')
  let el = $state()
  let split = null
  let visible = false
  let gateOpen = $state(true)
  let cancelScramble = null
  let lastP = 0
  let st = null

  const targets = () => {
    if (!split) return [el]
    if (type === 'chars') return split.chars
    if (type === 'words' || type === 'lines') return split.words
    return [el]
  }

  function build() {
    if (!el) return
    cancelScramble?.()
    gsap.killTweensOf(targets())
    el.innerHTML = html
    split = null
    if (type === 'chars' || type === 'words' || type === 'lines') {
      split = new SplitText(el, { lines: true, chars: type === 'chars' })
      gsap.set(targets(), { yPercent: 115 })
    } else {
      gsap.set(el, { autoAlpha: 0 })
    }
    if (visible) show(1, true)
  }

  function lineIndex(word) {
    return split?.lines ? split.lines.indexOf(word.closest('.st-line')) : 0
  }

  function show(dir = 1, instant = false) {
    if (!el) return
    const d = instant ? 0 : duration ?? (type === 'chars' ? 1.25 : 1.1)
    if (type === 'fade') {
      gsap.to(el, { autoAlpha: 1, duration: instant ? 0 : duration ?? 0.9, delay, ease: 'none' })
      return
    }
    if (type === 'scramble') {
      gsap.set(el, { autoAlpha: 1 })
      cancelScramble?.()
      const text = el.dataset.text || el.textContent
      el.dataset.text = text
      if (!instant) cancelScramble = scramble(el, text, { duration: duration ? duration * 1000 : 1100, delay: delay * 1000 })
      return
    }
    const t = targets()
    gsap.killTweensOf(t)
    gsap.fromTo(
      t,
      { yPercent: dir > 0 ? 115 : -115 },
      {
        yPercent: 0,
        duration: d,
        ease: 'brand.expoOut',
        delay: instant ? 0 : delay,
        stagger: type === 'chars' ? (stagger ?? 0.018) : (i, target) => lineIndex(target) * (stagger ?? 0.08) + i * 0.012,
      },
    )
  }

  function hide(dir = 1) {
    if (!el) return
    cancelScramble?.()
    if (type === 'fade' || type === 'scramble') {
      gsap.to(el, { autoAlpha: 0, duration: 0.45, ease: 'none' })
      return
    }
    const t = targets()
    gsap.killTweensOf(t)
    gsap.to(t, {
      yPercent: dir > 0 ? -115 : 115,
      duration: 0.65,
      ease: 'brand.expoIn',
      stagger: type === 'chars' ? 0.008 : 0.02,
    })
  }

  function setVisible(v, dir) {
    if (v === visible) return
    visible = v
    if (v) show(dir)
    else hide(dir)
  }

  function evaluate(p) {
    const dir = p >= lastP ? 1 : -1
    lastP = p
    if (!Array.isArray(at)) return
    const inside = gateOpen && p >= at[0] && p <= at[1]
    setVisible(inside, inside ? dir : p > at[1] ? 1 : -1)
  }

  onMount(() => {
    gateOpen = !gate
    build()
    const unsubs = []
    if (gate)
      unsubs.push(
        gate.subscribe((v) => {
          gateOpen = !!v
          if (Array.isArray(at)) evaluate(lastP)
          else if (v && st?.isActive) setVisible(true, 1)
        }),
      )
    if (Array.isArray(at) && section) {
      unsubs.push(section.progress.subscribe((p) => evaluate(p)))
    } else {
      st = ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        end: 'bottom 5%',
        onEnter: () => gateOpen && setVisible(true, 1),
        onEnterBack: () => gateOpen && setVisible(true, -1),
        onLeave: () => setVisible(false, 1),
        onLeaveBack: () => setVisible(false, -1),
      })
      unsubs.push(() => st.kill())
    }
    let rt = 0
    unsubs.push(
      bus.on(EVENTS.RESIZE, () => {
        clearTimeout(rt)
        rt = setTimeout(build, 200)
      }),
    )
    return () => unsubs.forEach((u) => u())
  })

  // locale switch → rebuild with the new text
  let mounted = false
  $effect(() => {
    html
    if (!mounted) {
      mounted = true
      return
    }
    if (el) {
      delete el.dataset.text
      build()
    }
  })
</script>

<svelte:element this={as} bind:this={el} class="reveal {cls}" {style} {id}></svelte:element>
