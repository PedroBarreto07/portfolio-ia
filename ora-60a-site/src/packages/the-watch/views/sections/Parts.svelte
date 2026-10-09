<script>
  import { onMount } from 'svelte'
  import gsap from 'gsap'
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import ScrambleText from '../components/ScrambleText.svelte'
  import { dial, dict, engine, finish, snapshots, strap } from '../../../../state/store.js'

  const t = $derived($dict)
  const config = engine.config
  let hover = $state(null)
  let copied = $state(false)
  let preview = $state()
  let touch = $state(false)

  const key = $derived(`parts:${$finish}-${$dial}-${$strap}`)
  const images = $derived($snapshots[key] || {})
  const total = $derived(t.parts.reduce((a, p) => a + p.weight, 0))

  function nextFinish() {
    finish.set(($finish + 1) % config.finishes.length)
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(location.href)
    } catch (e) {
      const ta = document.createElement('textarea')
      ta.value = location.href
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    copied = true
    setTimeout(() => (copied = false), 1800)
  }

  onMount(() => {
    touch = matchMedia('(pointer: coarse)').matches
    const xTo = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' })
    const yTo = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' })
    const move = (e) => {
      xTo(e.clientX + 30)
      yTo(e.clientY - 120)
    }
    window.addEventListener('pointermove', move, { passive: true })
    // clicking the 3D watch in this section swaps the finish
    engine.onCanvasClick = (section) => {
      if (section === 'parts' || section === 'colors') nextFinish()
    }
    return () => window.removeEventListener('pointermove', move)
  })
</script>

<Section id="parts" sticky={false} cursor="swap" label={t.partsSection.model}>
  <div class="parts">
    <header class="head">
      <Reveal as="span" class="eyebrow" html={t.partsSection.index} type="fade" />
      <Reveal as="h2" class="model display" html={t.partsSection.model} type="scramble" duration={1.4} />
    </header>

    <div class="grid">
      <div class="left">
        <div class="pin">
          <Appear class="card" data-interactive>
            <div class="row">
              <span class="label">{t.partsSection.colorLabel}</span>
              <ScrambleText class="value" text={t.colors[$finish]} />
            </div>
            <button class="btn" onclick={nextFinish}>
              <span>{t.partsSection.change}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9.5 4.5 13 8l-3.5 3.5" /></svg>
            </button>
            <div class="row">
              <span class="label">{t.partsSection.dialLabel}</span>
              <div class="chips" role="radiogroup" aria-label={t.partsSection.dialLabel}>
                {#each config.dials as d, i}
                  <button class="chip" class:active={$dial === i} role="radio" aria-checked={$dial === i} onclick={() => dial.set(i)}>
                    <i style="--c: {d.swatch}"></i>{t.dials[i]}
                  </button>
                {/each}
              </div>
            </div>
            <div class="row">
              <span class="label">{t.partsSection.strapLabel}</span>
              <div class="chips" role="radiogroup" aria-label={t.partsSection.strapLabel}>
                {#each config.straps as s, i}
                  <button class="chip" class:active={$strap === i} role="radio" aria-checked={$strap === i} onclick={() => strap.set(i)}>{t.straps[i]}</button>
                {/each}
              </div>
            </div>
            <button class="share" onclick={share}>{copied ? t.partsSection.copied : t.partsSection.share}</button>
          </Appear>
          <div class="counter">
            <span class="cur">{String($finish + 1).padStart(2, '0')}</span>
            <span class="sep"></span>
            <span>{String(config.finishes.length).padStart(2, '0')}</span>
          </div>
        </div>
      </div>

      <div class="right">
        <Reveal as="h3" class="label list-title" html={t.partsSection.listTitle} type="fade" />
        <ol class="list" onpointerleave={() => (hover = null)}>
          {#each t.parts as p, i}
            <li>
              <button
                class="item"
                class:active={hover === p.id}
                onpointerenter={() => !touch && (hover = p.id)}
                onfocus={() => (hover = p.id)}
                onblur={() => (hover = null)}
                onclick={() => touch && (hover = hover === p.id ? null : p.id)}
                data-cursor-text={p.name}
              >
                <span class="thumb only-mobile">
                  {#if images[p.id]}<img src={images[p.id]} alt="" />{/if}
                </span>
                <Reveal as="span" class="name display" html={p.name} type="chars" stagger={0.012} />
                <span class="meta">
                  <span class="idx">{String(i + 1).padStart(2, '0')}</span>
                  <span class="group">{p.group}</span>
                  <span class="w">{p.weight} {t.partsSection.unit}</span>
                </span>
              </button>
            </li>
          {/each}
          <li class="total">
            <span class="label">{t.partsSection.total}</span>
            <span class="value">{total} {t.partsSection.unit}</span>
          </li>
        </ol>
      </div>
    </div>
  </div>

  <div class="preview" class:show={hover && images[hover] && !touch} bind:this={preview} aria-hidden="true">
    {#each t.parts as p}
      {#if images[p.id]}
        <img src={images[p.id]} alt="" class:on={hover === p.id} />
      {/if}
    {/each}
    <span class="label">{hover ? t.parts.find((p) => p.id === hover)?.name : ''}</span>
  </div>
</Section>

<style>
  .parts {
    position: relative;
    padding: 130rem var(--gutter) 160rem;
  }
  .head {
    display: grid;
    gap: 10rem;
    margin-bottom: 80rem;
  }
  :global(#s-parts .model) {
    font-size: 9.4vw;
    font-weight: 300;
    line-height: 0.85;
    white-space: nowrap;
  }
  .grid {
    display: grid;
    grid-template-columns: 44% 1fr;
    gap: 4vw;
  }
  .left {
    position: relative;
  }
  .pin {
    position: sticky;
    top: 0;
    height: calc(var(--vh) * 100);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding-bottom: 34rem;
    gap: 16rem;
  }
  :global(#s-parts .card) {
    display: grid;
    gap: 14rem;
    width: 340rem;
    padding: 20rem;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.75);
    border-radius: 4rem;
    pointer-events: auto;
  }
  .row {
    display: grid;
    gap: 8rem;
  }
  .btn,
  .share {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12rem;
    padding: 12rem 16rem;
    border-radius: 40rem;
    font-size: 10rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .btn {
    background: var(--first-color);
    color: #fff;
  }
  .btn svg {
    width: 14rem;
    height: 14rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    transition: transform 0.6s var(--ease-expo);
  }
  .btn:hover svg {
    transform: translateX(4rem);
  }
  .share {
    border: 1px solid var(--line);
    justify-content: center;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6rem;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 6rem;
    padding: 6rem 10rem;
    border: 1px solid #0000001f;
    border-radius: 30rem;
    font-size: 10rem;
    letter-spacing: 0.04em;
    transition:
      border-color 0.4s linear,
      background 0.4s linear;
  }
  .chip i {
    width: 9rem;
    height: 9rem;
    border-radius: 50%;
    background: var(--c);
    box-shadow: inset 0 0 0 1px #0002;
  }
  .chip.active {
    border-color: var(--ink);
    background: #ffffff8c;
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 12rem;
    font-size: 10rem;
    letter-spacing: 0.16em;
    color: var(--ink-2);
  }
  .counter .cur {
    color: var(--ink);
  }
  .counter .sep {
    width: 40rem;
    height: 1px;
    background: var(--line);
  }
  :global(#s-parts .list-title) {
    display: block;
    margin-bottom: 18rem;
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--line);
  }
  .item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20rem;
    padding: 22rem 0;
    border-bottom: 1px solid var(--line);
    text-align: left;
    transition: padding 0.6s var(--ease-expo);
  }
  .item:hover,
  .item.active {
    padding-left: 14rem;
  }
  :global(#s-parts .name) {
    font-size: 30rem;
    font-weight: 300;
  }
  .meta {
    display: grid;
    grid-template-columns: 30rem 90rem 60rem;
    gap: 14rem;
    font-size: 10rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--ink-2);
    text-align: right;
  }
  .meta .w {
    color: var(--ink);
  }
  .total {
    display: flex;
    justify-content: space-between;
    padding: 22rem 0;
  }
  .thumb {
    width: 54rem;
    height: 66rem;
    flex: none;
    border-radius: 3rem;
    overflow: hidden;
    background: #d6d6d6;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .preview {
    position: fixed;
    left: 0;
    top: 0;
    z-index: 15;
    width: 220rem;
    aspect-ratio: 4 / 5;
    border-radius: 4rem;
    overflow: hidden;
    pointer-events: none;
    opacity: 0;
    transform-origin: 0 0;
    scale: 0.9;
    transition:
      opacity 0.4s linear,
      scale 0.6s var(--ease-expo);
    background: #d6d6d6;
  }
  .preview.show {
    opacity: 1;
    scale: 1;
  }
  .preview img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.35s linear;
  }
  .preview img.on {
    opacity: 1;
  }
  .preview .label {
    position: absolute;
    left: 12rem;
    bottom: 10rem;
    color: #2b2b2b;
  }
  @media (max-width: 767px) {
    .parts {
      padding-top: 90rem;
    }
    .grid {
      grid-template-columns: 1fr;
    }
    .pin {
      position: relative;
      height: auto;
      padding: 52vh 0 30rem;
    }
    :global(#s-parts .card) {
      width: 100%;
    }
    :global(#s-parts .model) {
      font-size: 13vw;
    }
    :global(#s-parts .name) {
      font-size: 20rem;
    }
    .meta {
      grid-template-columns: 24rem 50rem;
    }
    .meta .group {
      display: none;
    }
  }
</style>
