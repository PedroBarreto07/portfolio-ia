<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import { dial, dict, engine } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
  // text sits on the dial: pick ink from the dial lacquer
  const lightDial = $derived(engine.config.dials[$dial].id === 'ivory')
</script>

<Section id="curves" {vh} cursor="hold" label={t.curves.pre}>
  <Appear class="crosshair" at={[0.34, 0.62]} y={0} duration={1.6}>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" y1="0" x2="100" y2="100" />
      <line x1="100" y1="0" x2="0" y2="100" />
      <line x1="50" y1="0" x2="50" y2="100" class="v" />
      <line x1="0" y1="50" x2="100" y2="50" class="h" />
    </svg>
    <span class="plus" aria-hidden="true"></span>
  </Appear>

  <div class="center" class:on-dark={!lightDial}>
    <Reveal as="span" class="eyebrow" html={t.curves.index} at={[0.36, 0.6]} type="scramble" />
    <Reveal as="h2" class="title display" html={t.curves.title} at={[0.37, 0.6]} type="chars" stagger={0.022} />
    <Reveal as="p" class="body-s" html={t.curves.text} at={[0.39, 0.6]} type="lines" />
  </div>

  <Appear as="ol" class="specs" at={[0.66, 0.97]} y={16}>
    {#each t.watchRight.items as item, i}
      <li>
        <Reveal as="span" class="eyebrow" html={`${t.watchRight.index.split(' ')[0]}.${i + 1}`} at={[0.7 + i * 0.03, 0.96]} type="fade" />
        <Reveal as="h3" class="stitle display" html={item.title} at={[0.68 + i * 0.03, 0.96]} type="chars" stagger={0.015} />
        <Reveal as="p" class="body-s" html={item.text} at={[0.7 + i * 0.03, 0.96]} type="lines" />
      </li>
    {/each}
  </Appear>
</Section>

<style>
  :global(#s-curves .crosshair) {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  :global(#s-curves .crosshair svg) {
    width: 100%;
    height: 100%;
  }
  :global(#s-curves .crosshair line) {
    stroke: rgba(255, 255, 255, 0.28);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .plus {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 22rem;
    height: 22rem;
    translate: -50% -50%;
  }
  .plus::before,
  .plus::after {
    content: '';
    position: absolute;
    background: #fff;
  }
  .plus::before {
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
  }
  .plus::after {
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
  }
  .center {
    position: absolute;
    left: 50%;
    bottom: 13%;
    translate: -50% 0;
    display: grid;
    justify-items: center;
    gap: 14rem;
    text-align: center;
    width: min(620rem, 90vw);
  }
  .center.on-dark {
    --ink: #fff;
    --ink-2: rgba(255, 255, 255, 0.72);
    color: #fff;
    text-shadow: 0 1px 18px rgba(0, 0, 0, 0.25);
  }
  :global(#s-curves .title) {
    font-size: 4.6vw;
    font-weight: 300;
    line-height: 0.92;
  }
  :global(#s-curves .center .body-s) {
    max-width: 380rem;
  }
  :global(#s-curves .specs) {
    position: absolute;
    left: var(--gutter);
    top: 50%;
    translate: 0 -50%;
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 26rem;
    width: 290rem;
    padding: 26rem;
    background: rgba(255, 255, 255, 0.5);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 4rem;
  }
  :global(#s-curves .specs li) {
    display: grid;
    gap: 8rem;
  }
  :global(#s-curves .specs li + li) {
    padding-top: 22rem;
    border-top: 1px solid var(--line);
  }
  :global(#s-curves .stitle) {
    font-size: 20rem;
    font-weight: 300;
  }
  @media (max-width: 767px) {
    :global(#s-curves .title) {
      font-size: 11vw;
    }
    :global(#s-curves .specs) {
      top: auto;
      bottom: 30rem;
      translate: 0 0;
      right: var(--gutter);
      width: auto;
      gap: 12rem;
      padding: 18rem;
    }
    :global(#s-curves .specs .body-s) {
      display: none;
    }
    :global(#s-curves .specs li + li) {
      padding-top: 12rem;
    }
  }
</style>
