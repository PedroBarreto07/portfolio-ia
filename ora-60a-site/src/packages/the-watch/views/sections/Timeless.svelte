<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import { dict } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
  const indent = [0, 5, 1.5, 9, 3]
</script>

<Section id="timeless" {vh} cursor="hold" label="Timeless">
  <div class="columns">
    <Reveal as="span" class="eyebrow index" html={t.timeless.index} at={[0.04, 0.9]} type="fade" />
    {#each t.timeless.columns as col, i}
      <div class="col">
        <Reveal as="h3" class="value" html={col.title} at={[0.06 + i * 0.05, 0.9]} type="chars" stagger={0.012} />
        <Reveal as="p" class="body-s" html={col.text} at={[0.08 + i * 0.05, 0.9]} type="lines" />
      </div>
    {/each}
  </div>

  <div class="words" aria-label={t.timeless.words.join(' ')}>
    {#each t.timeless.words as w, i}
      <Reveal as="div" class="word display" style="margin-left: {indent[i]}vw" html={w} at={[0.14 + i * 0.07, 0.94]} type="chars" stagger={0.03} />
    {/each}
  </div>
</Section>

<style>
  .columns {
    position: absolute;
    left: var(--gutter);
    top: 130rem;
    display: grid;
    gap: 34rem;
    width: 250rem;
  }
  .col {
    display: grid;
    gap: 10rem;
  }
  .words {
    position: absolute;
    left: var(--gutter);
    bottom: 56rem;
    max-width: 46vw;
    display: grid;
    gap: 0.6vw;
  }
  :global(#s-timeless .word) {
    font-size: 3.7vw;
    font-weight: 300;
    line-height: 0.92;
  }
  @media (max-width: 767px) {
    .columns {
      display: none;
      top: 84rem;
      width: auto;
      right: var(--gutter);
      grid-template-columns: 1fr 1fr;
      gap: 16rem;
    }
    :global(#s-timeless .index) {
      grid-column: 1 / -1;
    }
    .words {
      bottom: 30rem;
    }
    :global(#s-timeless .word) {
      font-size: 8.4vw;
    }
  }
</style>
