<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import ColorPicker from '../../../../app/components/ColorPicker.svelte'
  import Gallery from '../components/Gallery.svelte'
  import ScrambleText from '../components/ScrambleText.svelte'
  import { dict, finish } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
</script>

<Section id="colors" {vh} cursor="swap" label={t.colorsSection.title}>
  <div class="head">
    <Reveal as="span" class="eyebrow" html={t.colorsSection.index} at={[0.02, 0.96]} type="fade" />
    <Reveal as="h2" class="title display" html={t.colorsSection.title} at={[0.03, 0.96]} type="chars" stagger={0.03} />
    <Reveal as="p" class="body-s" html={t.colorsSection.text} at={[0.05, 0.96]} type="lines" />
  </div>
  <Appear class="finish" at={[0.04, 0.96]} delay={0.2}>
    <ScrambleText class="fname display" text={t.colors[$finish]} />
    <ColorPicker size="l" />
  </Appear>
  <Gallery />
</Section>

<style>
  .head {
    position: absolute;
    left: var(--gutter);
    top: 110rem;
    display: grid;
    gap: 14rem;
    max-width: 330rem;
  }
  :global(#s-colors .title) {
    font-size: 52rem;
    font-weight: 300;
  }
  :global(#s-colors .finish) {
    position: absolute;
    right: var(--gutter);
    top: 110rem;
    display: grid;
    justify-items: end;
    gap: 18rem;
    text-align: right;
  }
  :global(#s-colors .fname) {
    font-size: 3.4vw;
    font-weight: 300;
  }
  @media (max-width: 767px) {
    .head {
      top: 76rem;
      right: var(--gutter);
    }
    :global(#s-colors .finish) {
      top: auto;
      bottom: 30rem;
      left: var(--gutter);
      justify-items: start;
      text-align: left;
    }
    :global(#s-colors .fname) {
      font-size: 8vw;
    }
  }
</style>
