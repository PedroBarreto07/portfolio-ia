<script>
  import { onMount } from 'svelte'
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import bus from '../../../../state/bus.js'
  import { dict, engine, finish } from '../../../../state/store.js'

  /*
   * Finale: the WebGL lineup (4 finishes following the cursor, the model
   * name huge behind them) + DOM captions projected under each watch.
   */
  let { vh } = $props()
  const t = $derived($dict)
  let layer = $state()
  const labelEls = $state([])

  onMount(() =>
    bus.on('LINEUP_SCREEN', (screen, amount) => {
      if (!layer) return
      layer.style.opacity = Math.min(1, Math.max(0, (amount - 0.7) / 0.3))
      screen.forEach((sc, i) => {
        const el = labelEls[i]
        if (!el) return
        el.style.transform = `translate3d(${sc.x}px, ${sc.y}px, 0) translate(-50%, 0)`
        el.classList.toggle('on', sc.hovered)
      })
    }),
  )

  function pick(i) {
    finish.set(i)
    engine.scene?.lineup?.select(i)
  }
</script>

<Section id="outro" {vh} cursor="hold" label="ORA 60A">
  <h2 class="sr-only">ORA 60A</h2>
  <div class="top">
    <Reveal as="span" class="eyebrow" html={t.outro.pick} at={[0.3, 1.5]} type="scramble" />
    <Reveal as="span" class="label hint hide-mobile" html={t.outro.hint} at={[0.34, 1.5]} type="fade" />
  </div>

  <div class="captions" bind:this={layer}>
    {#each engine.config.finishes as f, i}
      <button
        class="caption"
        class:current={$finish === i}
        bind:this={labelEls[i]}
        onclick={() => pick(i)}
        data-cursor-text={t.colors[i]}
      >
        <span class="idx">{String(i + 1).padStart(2, '0')}</span>
        <span class="name">{t.colors[i]}</span>
      </button>
    {/each}
  </div>

  <Appear class="foot" at={[0.3, 1.5]}>
    <span class="label">{t.outro.credits}</span>
    <button class="top-btn" onclick={() => engine.lenis.scrollTo(0, { duration: 6 })}>
      <span>{t.outro.top}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4.5 6.5 8 3l3.5 3.5" /></svg>
    </button>
    <span class="label">{t.outro.legal}</span>
  </Appear>
</Section>

<style>
  .top {
    position: absolute;
    left: var(--gutter);
    top: 110rem;
    display: grid;
    gap: 8rem;
  }
  .captions {
    position: absolute;
    inset: 0;
    opacity: 0;
    pointer-events: none;
  }
  .caption {
    position: absolute;
    left: 0;
    top: 0;
    display: flex;
    align-items: baseline;
    gap: 8rem;
    padding: 6rem 10rem;
    font-size: 10rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink-2);
    white-space: nowrap;
    pointer-events: auto;
    transition: color 0.4s linear;
  }
  .caption .name {
    position: relative;
  }
  .caption .name::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -4rem;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.6s var(--ease-expo);
  }
  :global(#s-outro .caption.on),
  :global(#s-outro .caption.current) {
    color: var(--ink);
  }
  :global(#s-outro .caption.on) .name::after,
  :global(#s-outro .caption.current) .name::after {
    transform: scaleX(1);
  }
  :global(#s-outro .foot) {
    position: absolute;
    left: var(--gutter);
    right: var(--gutter);
    bottom: 34rem;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 20rem;
  }
  :global(#s-outro .foot .label:last-child) {
    justify-self: end;
    text-align: right;
  }
  .top-btn {
    display: flex;
    align-items: center;
    gap: 10rem;
    padding: 12rem 18rem;
    border: 1px solid var(--line);
    border-radius: 40rem;
    font-size: 10rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .top-btn svg {
    width: 12rem;
    height: 12rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
  }
  @media (max-width: 767px) {
    .top {
      top: 76rem;
    }
    :global(#s-outro .foot) {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
      bottom: 20rem;
    }
    :global(#s-outro .foot .label) {
      display: none;
    }
  }
</style>
