<script>
  import { getContext, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import gsap from 'gsap'
  import { dial, dict, finish, snapshots, strap } from '../../../../state/store.js'

  /*
   * Horizontal gallery scrubbed by the section progress. Each card shows a
   * live-rendered studio shot of the current finish (Snapshotter), with an
   * inner parallax + zoom, and cross-fades when the finish changes.
   */
  const section = getContext('section')
  const SHOTS = 5
  let track = $state()
  let cards = $state([])
  let inners = $state([])

  const key = $derived(`gallery:${$finish}-${$dial}-${$strap}`)
  const images = $derived($snapshots[key] || null)

  onMount(() => {
    const ease = gsap.parseEase('power1.inOut')
    const off = section.progress.subscribe((p) => {
      if (!track) return
      const vw = window.innerWidth
      const total = track.scrollWidth
      const start = vw * 0.62
      const end = -(total - vw * 0.94)
      const e = ease(Math.min(1, Math.max(0, (p - 0.04) / 0.92)))
      track.style.transform = `translate3d(${start + (end - start) * e}px, 0, 0)`
      cards.forEach((card, i) => {
        if (!card) return
        const r = card.getBoundingClientRect()
        const c = (r.left + r.width / 2) / vw - 0.5 // -0.5…0.5 across the screen
        const inner = inners[i]
        if (inner) inner.style.transform = `translate3d(${-c * 14}%, 0, 0) scale(${1.18 - Math.min(0.18, Math.abs(c) * 0.12 + 0.06)})`
      })
    })
    return off
  })
</script>

<div class="gallery" aria-label="Gallery">
  <div class="track" bind:this={track}>
    {#each Array(SHOTS) as _, i}
      <figure class="card card-{i}" bind:this={cards[i]}>
        <div class="mask">
          <div class="inner" bind:this={inners[i]}>
            {#if images?.[i]}
              {#key images[i]}
                <img src={images[i]} alt="ORA 60A — {$dict.colors[$finish]} ({i + 1}/{SHOTS})" transition:fade={{ duration: 700 }} />
              {/key}
            {:else}
              <div class="placeholder"><span class="label">{$dict.colorsSection.rendering}…</span></div>
            {/if}
          </div>
        </div>
        <figcaption class="label">{String(i + 1).padStart(2, '0')} — {$dict.colors[$finish]}</figcaption>
      </figure>
    {/each}
  </div>
</div>

<style>
  .gallery {
    position: absolute;
    left: 0;
    right: 0;
    top: 36%;
    bottom: 7%;
    display: flex;
    align-items: flex-end;
    pointer-events: none;
  }
  .track {
    display: flex;
    align-items: flex-end;
    gap: 2.4vw;
    will-change: transform;
  }
  .card {
    margin: 0;
    flex: none;
    width: 19vw;
    display: grid;
    gap: 12rem;
  }
  .card-1,
  .card-3 {
    width: 15vw;
    margin-bottom: 6vh;
  }
  .card-2 {
    width: 22vw;
  }
  .mask {
    position: relative;
    aspect-ratio: 4 / 5;
    overflow: hidden;
    border-radius: 3rem;
    background: #d6d6d6;
  }
  .inner {
    position: absolute;
    inset: 0;
    will-change: transform;
  }
  .inner img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .placeholder {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: linear-gradient(110deg, #d4d4d4 30%, #e6e6e6 50%, #d4d4d4 70%);
    background-size: 220% 100%;
    animation: shimmer 1.6s linear infinite;
  }
  @keyframes shimmer {
    to {
      background-position: -220% 0;
    }
  }
  @media (max-width: 767px) {
    .card,
    .card-1,
    .card-2,
    .card-3 {
      width: 58vw;
      margin: 0;
    }
  }
</style>
