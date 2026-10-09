<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import ColorPicker from '../../../../app/components/ColorPicker.svelte'
  import ScrambleText from '../components/ScrambleText.svelte'
  import { dict, finish, loaded } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
</script>

<Section id="hero" {vh} cursor="hold" label={t.meta.title}>
  <h1 class="sr-only">{t.meta.title}</h1>

  <Reveal as="div" class="giant left display" html={t.hero.left} at={[-1, 0.7]} gate={loaded} type="chars" stagger={0.07} duration={1.6} delay={0.2} />
  <Reveal as="div" class="giant right display" html={t.hero.right} at={[-1, 0.7]} gate={loaded} type="chars" stagger={0.07} duration={1.6} delay={0.35} />

  <Reveal as="p" class="tagline eyebrow" html={t.hero.eyebrow} at={[-1, 0.55]} gate={loaded} type="lines" delay={0.9} />

  <Appear class="info" at={[-1, 0.62]} gate={loaded} delay={1.1}>
    <dl>
      <div>
        <dt class="label">{t.colorLabel}</dt>
        <dd class="value"><ScrambleText text={t.colors[$finish]} /></dd>
      </div>
      <div>
        <dt class="label">{t.modelLabel}</dt>
        <dd class="value">{t.modelValue}</dd>
      </div>
    </dl>
    <ColorPicker />
  </Appear>

  <Appear class="scroll" at={[-1, 0.3]} gate={loaded} delay={1.3}>
    <span class="label">{t.hero.scroll}</span>
    <span class="scroll-line"><i></i></span>
  </Appear>
</Section>

<style>
  :global(.giant) {
    position: absolute;
    top: 50%;
    margin-top: -0.43em;
    font-size: 12.2vw;
    font-weight: 300;
    white-space: nowrap;
    color: var(--ink);
  }
  :global(.giant.left) {
    left: -3vw;
  }
  :global(.giant.right) {
    right: -3.4vw;
  }
  :global(#s-hero .tagline) {
    position: absolute;
    top: calc(50% + 6.2vw);
    left: var(--gutter);
    line-height: 1.7;
  }
  :global(#s-hero .info) {
    position: absolute;
    left: var(--gutter);
    bottom: 40rem;
    display: grid;
    gap: 22rem;
  }
  :global(#s-hero dl) {
    display: flex;
    gap: 46rem;
    margin: 0;
  }
  :global(#s-hero dd) {
    margin: 4rem 0 0;
  }
  :global(#s-hero .scroll) {
    position: absolute;
    right: var(--gutter);
    bottom: 40rem;
    display: flex;
    align-items: center;
    gap: 14rem;
  }
  .scroll-line {
    position: relative;
    width: 60rem;
    height: 1px;
    background: var(--line);
    overflow: hidden;
  }
  .scroll-line i {
    position: absolute;
    inset: 0;
    background: var(--ink);
    animation: line 2.4s cubic-bezier(0.7, 0, 0.3, 1) infinite;
  }
  @keyframes line {
    0% {
      transform: translateX(-100%);
    }
    60%,
    100% {
      transform: translateX(100%);
    }
  }
  @media (max-width: 767px) {
    :global(.giant) {
      font-size: 27vw;
    }
    :global(.giant.left) {
      top: 15%;
      left: -2vw;
    }
    :global(.giant.right) {
      top: auto;
      bottom: 13%;
      right: -2vw;
    }
    :global(#s-hero .tagline) {
      display: none;
    }
    :global(#s-hero .info) {
      bottom: 28rem;
      gap: 14rem;
    }
    :global(#s-hero .scroll) {
      display: none;
    }
  }
</style>
