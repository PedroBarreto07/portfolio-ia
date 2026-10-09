<script>
  import { SECTIONS } from '../choreography.js'
  import Hero from './sections/Hero.svelte'
  import Timeless from './sections/Timeless.svelte'
  import Vertical from './sections/Vertical.svelte'
  import Disassembly from './sections/Disassembly.svelte'
  import Mechanism from './sections/Mechanism.svelte'
  import Curves from './sections/Curves.svelte'
  import Profile from './sections/Profile.svelte'
  import Editions from './sections/Editions.svelte'
  import Colors from './sections/Colors.svelte'
  import Parts from './sections/Parts.svelte'
  import Outro from './sections/Outro.svelte'

  const vh = Object.fromEntries(SECTIONS.map((s) => [s.id, s.vh]))
</script>

<div id="the-watch">
  <Hero vh={vh.hero} />
  <Timeless vh={vh.timeless} />
  <Vertical vh={vh.vertical} />
  <Disassembly vh={vh.disassembly} />
  <Mechanism vh={vh.mechanism} />
  <Curves vh={vh.curves} />
  <Profile vh={vh.profile} />
  <Editions vh={vh.editions} />
  <Colors vh={vh.colors} />
  <Parts />
  <Outro vh={vh.outro} />
</div>

<style>
  #the-watch {
    position: relative;
  }
</style>
