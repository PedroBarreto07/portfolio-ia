<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import { dict } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
  const offsets = [0, 14, 4, 22]
</script>

<Section id="mechanism" {vh} cursor="hold" label={t.mechanism.title.join(' ')} class="is-night">
  <h2 class="heart display" aria-label={t.mechanism.title.join(' ')}>
    <Reveal as="span" class="w1" html={t.mechanism.title[0]} at={[0.05, 0.36]} type="chars" stagger={0.03} />
    <Reveal as="span" class="w2" html={t.mechanism.title[1]} at={[0.07, 0.36]} type="chars" stagger={0.03} />
  </h2>
  <div class="intro">
    <Reveal as="span" class="eyebrow" html={t.mechanism.index} at={[0.1, 0.36]} type="fade" />
    <Reveal as="p" class="body-s" html={t.mechanism.intro} at={[0.12, 0.36]} type="lines" />
  </div>

  <h3 class="lines display" aria-label={t.movement.lines.join(' ')}>
    {#each t.movement.lines as line, i}
      <Reveal as="span" class="mline" style="margin-left: {offsets[i]}vw" html={line} at={[0.5 + i * 0.03, 0.76]} type="chars" stagger={0.02} />
    {/each}
  </h3>

  <div class="numeral" aria-label="{t.movement.numeral}{t.movement.unit} {t.movement.caption}">
    <Reveal as="span" class="n display" html={t.movement.numeral} at={[0.8, 0.995]} type="chars" stagger={0.08} duration={1.6} />
    <Reveal as="span" class="u display" html={t.movement.unit} at={[0.82, 0.995]} type="chars" />
    <Reveal as="span" class="cap eyebrow" html={t.movement.caption} at={[0.84, 0.995]} type="lines" />
  </div>
  <Appear as="dl" class="specs" at={[0.82, 0.995]} delay={0.2}>
    {#each t.movement.specs as s}
      <div class="spec">
        <dt class="label">{s.k}</dt>
        <dd class="value">{s.v}</dd>
      </div>
    {/each}
  </Appear>
</Section>

<style>
  .heart {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    translate: 0 -50%;
    display: grid;
    justify-items: center;
    font-size: 8.4vw;
    font-weight: 300;
    line-height: 0.9;
    text-align: center;
    pointer-events: none;
  }
  :global(#s-mechanism .w1) {
    color: #fff;
  }
  :global(#s-mechanism .w2) {
    color: #6f6f6f;
  }
  .intro {
    position: absolute;
    left: var(--gutter);
    bottom: 50rem;
    display: grid;
    gap: 12rem;
    color: #fff;
  }
  :global(#s-mechanism .body-s) {
    color: #9a9a9a;
  }
  .lines {
    position: absolute;
    left: var(--gutter);
    top: 50%;
    translate: 0 -50%;
    display: grid;
    gap: 0.4vw;
    font-size: 5vw;
    font-weight: 300;
    line-height: 0.95;
    color: #fff;
  }
  :global(#s-mechanism .mline:nth-child(even)) {
    color: #6f6f6f;
  }
  .numeral {
    position: absolute;
    right: var(--gutter);
    top: 50%;
    translate: 0 -55%;
    display: grid;
    grid-template-columns: auto auto;
    align-items: end;
    color: #fff;
  }
  :global(#s-mechanism .n) {
    font-size: 24.3vw;
    font-weight: 300;
    line-height: 0.78;
    letter-spacing: -0.05em;
  }
  :global(#s-mechanism .u) {
    font-size: 4vw;
    font-weight: 300;
    margin-left: 1vw;
    color: #6f6f6f;
  }
  :global(#s-mechanism .cap) {
    grid-column: 1 / -1;
    justify-self: end;
    margin-top: 18rem;
    color: #9a9a9a;
  }
  :global(#s-mechanism .specs) {
    position: absolute;
    left: var(--gutter);
    bottom: 50rem;
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 18rem 46rem;
    margin: 0;
  }
  :global(#s-mechanism .spec dd) {
    margin: 4rem 0 0;
    color: #fff;
  }
  @media (max-width: 767px) {
    .heart {
      font-size: 15vw;
    }
    .lines {
      font-size: 10vw;
      top: 30%;
    }
    .numeral {
      top: auto;
      bottom: 190rem;
      translate: 0 0;
    }
    :global(#s-mechanism .n) {
      font-size: 40vw;
    }
  }
</style>
