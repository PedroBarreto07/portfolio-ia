<script>
  import { onMount, setContext } from 'svelte'
  import { writable } from 'svelte/store'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import { activeSection } from '../../state/store.js'

  /*
   * A scroll "stage". Sticky sections pin their content for (height - 1vh)
   * and expose a 0 → 1 progress store to their children through context —
   * the very same progress the WebGL choreography uses (S(id, p)).
   */
  let { id, vh = null, sticky = true, cursor = 'hold', label = '', class: cls = '', children } = $props()

  const progress = writable(0)
  setContext('section', {
    get id() {
      return id
    },
    progress,
    get sticky() {
      return sticky
    },
  })
  let el

  onMount(() => {
    const st = ScrollTrigger.create({
      trigger: el,
      start: sticky ? 'top top' : 'top bottom',
      end: sticky ? 'bottom bottom' : 'bottom top',
      onUpdate: (self) => progress.set(self.progress),
      onToggle: (self) => {
        if (self.isActive) activeSection.set(id)
      },
    })
    progress.set(st.progress)
    return () => st.kill()
  })
</script>

<section
  bind:this={el}
  id={`s-${id}`}
  data-section={id}
  data-cursor={cursor}
  aria-label={label || id}
  class="section {cls}"
  class:is-sticky={sticky}
  style={vh ? `height: calc(var(--vh) * ${Math.round(vh * 100)})` : ''}
>
  {#if sticky}
    <div class="stage">{@render children?.()}</div>
  {:else}
    {@render children?.()}
  {/if}
</section>

<style>
  .section {
    position: relative;
  }
  .stage {
    position: sticky;
    top: 0;
    height: calc(var(--vh) * 100);
    overflow: hidden;
  }
</style>
