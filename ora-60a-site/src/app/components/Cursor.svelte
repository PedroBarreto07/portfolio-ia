<script>
  import { onMount, tick } from 'svelte'
  import gsap from 'gsap'
  import { activeSection, cursor, dict, longpress, loaded } from '../../state/store.js'

  /*
   * Custom cursor (desktop, fine pointer only).
   *  - a crisp dot glued to the pointer (no lag: you never lose your cursor)
   *  - a white disc + context label that follows with a soft delay:
   *    "Hold to explore" (progress ring while held), drag/select in the
   *    disassembly, swap in the colour sections.
   * The native cursor is only hidden once the custom one has really moved.
   */
  const MODE = {
    hero: 'hold',
    timeless: 'hold',
    vertical: 'hold',
    disassembly: 'drag',
    mechanism: 'hold',
    curves: 'hold',
    profile: 'hold',
    editions: 'scroll',
    colors: 'swap',
    parts: 'swap',
    outro: 'hold',
  }

  let enabled = $state(false)
  let dot = $state()
  let follower = $state()
  let ui = $state(false)
  let uiText = $state('')
  let hidden = $state(true)

  const mode = $derived($cursor.pick !== null && $cursor.pick !== undefined ? 'pick' : $cursor.hover ? 'select' : MODE[$activeSection] || 'hold')
  const text = $derived.by(() => {
    if (ui) return uiText
    if (mode === 'pick') return $dict.colors[$cursor.pick] || ''
    const c = $dict.cursor
    return { hold: c.hold, drag: c.drag, select: c.select, swap: c.swap, scroll: c.scroll, none: '' }[mode] ?? ''
  })

  onMount(() => {
    const params = new URLSearchParams(location.search)
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
    if ((!fine || params.has('shots') || params.has('nocursor')) && !params.has('cursor')) return
    let cleanup = () => {}
    enabled = true
    tick().then(() => {
      const dx = gsap.quickTo(dot, 'x', { duration: 0.06, ease: 'none' })
      const dy = gsap.quickTo(dot, 'y', { duration: 0.06, ease: 'none' })
      const fx = gsap.quickTo(follower, 'x', { duration: 0.45, ease: 'power3' })
      const fy = gsap.quickTo(follower, 'y', { duration: 0.45, ease: 'power3' })
      let first = true
      const move = (e) => {
        if (e.pointerType && e.pointerType !== 'mouse') return
        if (first) {
          // jump there without easing, then hide the native cursor
          gsap.set([dot, follower], { x: e.clientX, y: e.clientY })
          document.documentElement.classList.add('has-cursor')
          first = false
        }
        hidden = false
        dx(e.clientX)
        dy(e.clientY)
        fx(e.clientX)
        fy(e.clientY)
        const target = e.target.closest?.('a, button, [data-interactive], input, select, label')
        ui = !!target
        uiText = target?.dataset?.cursorText || ''
      }
      const leave = () => (hidden = true)
      const enter = () => (hidden = false)
      window.addEventListener('pointermove', move, { passive: true })
      document.documentElement.addEventListener('mouseleave', leave)
      document.documentElement.addEventListener('mouseenter', enter)
      cleanup = () => {
        window.removeEventListener('pointermove', move)
        document.documentElement.removeEventListener('mouseleave', leave)
        document.documentElement.removeEventListener('mouseenter', enter)
        document.documentElement.classList.remove('has-cursor')
      }
    })
    return () => cleanup()
  })
</script>

<div
  class="cursor mode-{mode}"
  class:off={!enabled}
  class:ui
  class:hidden={hidden || !$loaded}
  class:holding={$longpress > 0}
  class:has-text={!!text}
  data-cursor
  aria-hidden="true"
>
  <div class="follower" bind:this={follower}>
    <div class="disc">
      <svg class="ring" viewBox="0 0 44 44"><circle cx="22" cy="22" r="20.5" /></svg>
      <span class="icon">
        {#if mode === 'drag'}
          <svg viewBox="0 0 16 16"><path d="M4 8h8M4 8l2.5-2.5M4 8l2.5 2.5M12 8l-2.5-2.5M12 8l-2.5 2.5" /></svg>
        {:else if mode === 'pick'}
          <svg viewBox="0 0 16 16"><path d="M5 11 11 5M6.5 5H11v4.5" /></svg>
        {:else if mode === 'select'}
          <svg viewBox="0 0 16 16"><path d="M8 3.5v9M3.5 8h9" /></svg>
        {:else if mode === 'swap'}
          <svg viewBox="0 0 16 16"><path d="M4 6.5h8.5L10 4M12 9.5H3.5L6 12" /></svg>
        {:else if mode === 'scroll'}
          <svg viewBox="0 0 16 16"><path d="M8 3.5v9M5 9.5l3 3 3-3" /></svg>
        {/if}
      </span>
    </div>
    <span class="label">{@html text}</span>
  </div>
  <div class="dot" bind:this={dot}></div>
</div>

<style>
  .cursor {
    position: fixed;
    inset: 0;
    z-index: 50;
    pointer-events: none;
    transition: opacity 0.3s linear;
  }
  .cursor.off {
    display: none;
  }
  .cursor.hidden {
    opacity: 0;
  }
  .dot {
    position: absolute;
    left: 0;
    top: 0;
    width: 8px;
    height: 8px;
    margin: -4px 0 0 -4px;
    border-radius: 50%;
    background: #111;
    box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.85);
    transition: transform 0.35s var(--ease-expo);
  }
  .ui .dot {
    transform: scale(1.6);
  }
  .follower {
    position: absolute;
    left: 0;
    top: 0;
  }
  .disc {
    position: absolute;
    left: -22px;
    top: -22px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.55);
    border: 1px solid rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    transition:
      transform 0.6s var(--ease-expo),
      opacity 0.4s linear;
  }
  .ui .disc {
    transform: scale(0.4);
    opacity: 0;
  }
  .holding .disc {
    transform: scale(1.45);
  }
  .ring {
    position: absolute;
    inset: -3px;
    width: calc(100% + 6px);
    height: calc(100% + 6px);
    transform: rotate(-90deg);
  }
  .ring circle {
    fill: none;
    stroke: #2b2b2b;
    stroke-width: 1.5;
    stroke-dasharray: 128.8;
    stroke-dashoffset: 128.8;
    transition: stroke-dashoffset 0.4s linear;
  }
  .holding .ring circle {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 1.2s cubic-bezier(0.2, 0, 0.2, 1);
  }
  .icon {
    width: 14px;
    height: 14px;
    display: grid;
    place-items: center;
    color: #1a1a1a;
  }
  .icon svg {
    width: 100%;
    height: 100%;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .label {
    position: absolute;
    left: 32px;
    top: 0;
    transform: translateY(-50%);
    font-size: 9px;
    line-height: 1.35;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--ink);
    white-space: nowrap;
    transition: opacity 0.3s linear;
  }
  .cursor:not(.has-text) .label {
    opacity: 0;
  }
  :global(html.is-dark) .dot {
    background: #fff;
    box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.6);
  }
  :global(html.is-dark) .disc {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.35);
  }
  :global(html.is-dark) .icon {
    color: #fff;
  }
  :global(html.is-dark) .ring circle {
    stroke: #fff;
  }
</style>
