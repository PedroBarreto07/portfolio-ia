<script>
  import { onMount } from 'svelte'
  import gsap from 'gsap'
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import bus, { EVENTS } from '../../../../state/bus.js'
  import { dict, engine, selectedPart } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
  const IDS = ['dial', 'tourbillon', 'mainplate', 'barrel', 'backplate', 'weight']
  let layer = $state()
  let panel = $state()
  const labelEls = $state({})
  const lineEls = $state({})
  let portrait = $state(false)
  const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

  function select(id) {
    engine.scene?.select(id === $selectedPart ? null : id)
  }

  onMount(() => {
    const offScreen = bus.on(EVENTS.PARTS_SCREEN, (data, opacity) => {
      if (!layer) return
      layer.style.opacity = opacity
      layer.style.visibility = opacity > 0.02 ? 'visible' : 'hidden'
      const w = window.innerWidth
      const h = window.innerHeight
      portrait = w / h < 0.8
      const axis = Math.max(h * 0.25, 190)
      data.forEach((d) => {
        const el = labelEls[d.id]
        const line = lineEls[d.id]
        if (!el) return
        if (portrait) {
          // vertical stack: labels on the left, guides run horizontally
          const x0 = 16
          el.style.transform = `translate3d(${x0}px, ${d.y}px, 0) translate(0, -50%)`
          const lx = x0 + el.offsetWidth + 6
          const lx1 = Math.max(lx + 8, d.x - w * 0.16)
          line.style.transform = `translate3d(${lx}px, ${d.y}px, 0) scaleX(${(lx1 - lx) / 100})`
          return
        }
        el.style.transform = `translate3d(${d.x}px, ${axis}px, 0) translate(-50%, -100%)`
        const y0 = axis + 8
        const y1 = Math.max(y0 + 10, d.top - 10)
        line.style.transform = `translate3d(${d.x}px, ${y0}px, 0) scaleY(${(y1 - y0) / 100})`
      })
    })
    const offSel = bus.on(EVENTS.PART_SELECT, (id) => selectedPart.set(id))
    return () => {
      offScreen()
      offSel()
    }
  })

  $effect(() => {
    const id = $selectedPart
    if (!panel) return
    gsap.killTweensOf(panel)
    if (id) gsap.fromTo(panel, { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 1, ease: 'brand.expoOut' })
    else gsap.to(panel, { autoAlpha: 0, x: 20, duration: 0.4, ease: 'power2.in' })
  })
</script>

<Section id="disassembly" {vh} cursor="drag" label={t.disassembly.title}>
  <div class="head" class:dim={!!$selectedPart}>
    <Reveal as="span" class="eyebrow" html={t.disassembly.index} at={[0.44, 0.97]} type="fade" />
    <Reveal as="h2" class="title display" html={t.disassembly.title} at={[0.45, 0.97]} type="chars" stagger={0.025} />
    <Reveal as="span" class="label" html="06 {t.disassembly.count}" at={[0.48, 0.97]} type="scramble" />
  </div>

  <div class="labels" class:portrait bind:this={layer} aria-label={t.disassembly.title}>
    {#each IDS as id, i}
      <span class="guide" bind:this={lineEls[id]}></span>
      <button
        class="part-label"
        class:active={$selectedPart === id}
        bind:this={labelEls[id]}
        onclick={() => select(id)}
        data-cursor-text={t.cursor.select}
      >
        <span class="inner">
          <span class="idx">{String(i + 1).padStart(2, '0')}</span>
          <span class="name">{t.disassembly.parts[id].name}</span>
        </span>
      </button>
    {/each}
  </div>

  <Appear class="hint" at={[0.55, 0.9]}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5a5.5 5.5 0 0 1-5.5 5.5h-1A5.5 5.5 0 0 1 6 15.5V13a1.5 1.5 0 0 1 3 0" /></svg>
    <span class="label">{touch ? t.disassembly.hintTouch : t.disassembly.hint}</span>
  </Appear>

  <aside class="panel" bind:this={panel} aria-live="polite" data-interactive>
    {#if $selectedPart}
      <div class="row">
        <span class="label">{t.disassembly.name}</span>
        <h3 class="display pname">{t.disassembly.parts[$selectedPart].name}</h3>
      </div>
      <div class="row">
        <span class="label">{t.disassembly.function}</span>
        <p class="pfn">{t.disassembly.parts[$selectedPart].function}</p>
      </div>
      <button class="close" onclick={() => engine.scene?.select(null)}>
        <span>{t.disassembly.close}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" /></svg>
      </button>
    {/if}
  </aside>
</Section>

<style>
  .head {
    position: absolute;
    right: var(--gutter);
    bottom: 40rem;
    justify-items: end;
    text-align: right;
    display: grid;
    gap: 10rem;
  }
  .head {
    transition: opacity 0.5s linear;
  }
  .head.dim {
    opacity: 0;
  }
  :global(#s-disassembly .title) {
    font-size: 52rem;
    font-weight: 300;
  }
  .labels {
    position: absolute;
    inset: 0;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .part-label {
    position: absolute;
    left: 0;
    top: 0;
    padding: 6rem;
    font-size: 10rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--ink);
    pointer-events: auto;
    transition: color 0.4s linear;
  }
  .inner {
    display: flex;
    align-items: center;
    gap: 10rem;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    white-space: nowrap;
  }
  .part-label .idx {
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  .part-label.active .name,
  .part-label:hover .name {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  .portrait .inner {
    writing-mode: horizontal-tb;
    transform: none;
  }
  .portrait .guide {
    width: 100px;
    height: 1px;
    background: linear-gradient(90deg, #66666680, #66666610);
  }
  .guide {
    position: absolute;
    left: 0;
    top: 0;
    width: 1px;
    height: 100px;
    transform-origin: 0 0;
    background: linear-gradient(180deg, #66666680, #66666610);
  }
  :global(#s-disassembly .hint) {
    position: absolute;
    left: 50%;
    bottom: 40rem;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 10rem;
  }
  :global(#s-disassembly .hint svg) {
    width: 18rem;
    height: 18rem;
    fill: none;
    stroke: var(--ink);
    stroke-width: 1.1;
    stroke-linecap: round;
  }
  .panel {
    position: absolute;
    right: var(--gutter);
    top: 50%;
    translate: 0 -40%;
    width: 300rem;
    padding: 26rem;
    display: grid;
    gap: 20rem;
    background: rgba(255, 255, 255, 0.55);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 4rem;
    opacity: 0;
    visibility: hidden;
    pointer-events: auto;
  }
  .row {
    display: grid;
    gap: 6rem;
  }
  .pname {
    font-size: 30rem;
    font-weight: 300;
  }
  .pfn {
    font-size: 12rem;
    line-height: 1.6;
    color: #444;
  }
  .close {
    justify-self: start;
    display: flex;
    align-items: center;
    gap: 10rem;
    font-size: 10rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 9rem 14rem;
    border: 1px solid var(--line);
    border-radius: 40rem;
  }
  .close svg {
    width: 9rem;
    height: 9rem;
    stroke: currentColor;
    stroke-width: 1.4;
  }
  @media (max-width: 767px) {
    .head {
      bottom: auto;
      top: 76rem;
      left: var(--gutter);
      right: auto;
      justify-items: start;
      text-align: left;
    }
    :global(#s-disassembly .title) {
      font-size: 26rem;
    }
    .panel {
      left: var(--gutter);
      right: var(--gutter);
      width: auto;
      top: auto;
      translate: 0 0;
      bottom: 80rem;
    }
  }
</style>
