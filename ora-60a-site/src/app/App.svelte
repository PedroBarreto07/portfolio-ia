<script>
  import Header from './components/Header.svelte'
  import Cursor from './components/Cursor.svelte'
  import TheWatch from '../packages/the-watch/views/TheWatch.svelte'
  import { dict } from '../state/store.js'
</script>

{#if $dict}
  <a class="skip sr-only" href="#s-parts">Skip to configurator</a>
  <Header />
  <main id="main">
    <TheWatch />
  </main>
  <Cursor />
{/if}
