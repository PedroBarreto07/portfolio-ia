<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import { dict } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
</script>

<Section id="profile" {vh} cursor="hold" label="Profile">
  <div class="slim">
    <Reveal as="span" class="eyebrow" html={t.profile.index} at={[0.14, 0.5]} type="scramble" />
    <Reveal as="h2" class="title display" html={t.profile.title} at={[0.15, 0.5]} type="chars" stagger={0.022} />
    <Reveal as="p" class="body-s" html={t.profile.text} at={[0.18, 0.5]} type="lines" />
  </div>
  <div class="figure" aria-label="{t.profile.figure} {t.profile.unit}">
    <Reveal as="span" class="fig display" html={t.profile.figure} at={[0.17, 0.5]} type="chars" stagger={0.06} duration={1.5} />
    <Reveal as="span" class="unit display" html={t.profile.unit} at={[0.2, 0.5]} type="chars" />
  </div>

  <div class="bracelet">
    <Reveal as="span" class="eyebrow" html={t.bracelet.index} at={[0.62, 0.97]} type="scramble" />
    <Reveal as="h2" class="title display" html={t.bracelet.title} at={[0.63, 0.97]} type="chars" stagger={0.022} />
    <Reveal as="p" class="body-s" html={t.bracelet.text} at={[0.66, 0.97]} type="lines" />
  </div>
</Section>

<style>
  .slim {
    position: absolute;
    left: var(--gutter);
    bottom: 50rem;
    display: grid;
    gap: 14rem;
  }
  :global(#s-profile .title) {
    font-size: 52rem;
    font-weight: 300;
    line-height: 0.92;
  }
  .figure {
    position: absolute;
    right: var(--gutter);
    bottom: 50rem;
    display: flex;
    align-items: baseline;
    gap: 1vw;
  }
  :global(#s-profile .fig) {
    font-size: 15vw;
    font-weight: 300;
    line-height: 0.8;
    letter-spacing: -0.04em;
  }
  :global(#s-profile .unit) {
    font-size: 3vw;
    font-weight: 300;
    color: var(--ink-2);
  }
  .bracelet {
    position: absolute;
    left: var(--gutter);
    top: 120rem;
    display: grid;
    gap: 14rem;
  }
  @media (max-width: 767px) {
    .figure {
      bottom: 40rem;
    }
    .slim {
      bottom: auto;
      top: 80rem;
    }
    :global(#s-profile .fig) {
      font-size: 26vw;
    }
    :global(#s-profile .title) {
      font-size: 36rem;
    }
    .bracelet {
      top: 80rem;
    }
  }
</style>
