<script>
  import { onMount } from 'svelte'
  import { scramble } from '../../../../app/utils/scramble.js'

  /** Text that scrambles into its new value every time it changes. */
  let { text = '', duration = 700, as = 'span', class: cls = '' } = $props()
  let el = $state()
  let mounted = false
  let cancel = null

  onMount(() => {
    el.textContent = text
    mounted = true
    return () => cancel?.()
  })

  $effect(() => {
    const value = text
    if (!mounted || !el) return
    cancel?.()
    cancel = scramble(el, value, { duration })
  })
</script>

<svelte:element this={as} bind:this={el} class={cls} aria-live="polite"></svelte:element>
