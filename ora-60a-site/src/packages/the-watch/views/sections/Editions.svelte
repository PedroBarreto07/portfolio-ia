<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import Appear from '../../../../app/components/Appear.svelte'
  import { dict } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
</script>

<Section id="editions" {vh} cursor="scroll" label={t.images.classic}>
  <div class="grid">
    {#each t.images.rows as row, i}
      <div class="row row-{i}">
        <Appear class="rule" at={[0.04 + i * 0.04, 0.96]} y={0} duration={1.4} />
        <Reveal as="span" class="r display" html={row} at={[0.08 + i * 0.05, 0.96]} type="chars" stagger={0.014} />
        {#if i === 0}
          <Reveal as="span" class="tag label" html={t.images.classic} at={[0.14, 0.96]} type="scramble" />
        {/if}
        {#if i === 2}
          <Reveal as="span" class="tag label" html={t.images.sport} at={[0.22, 0.96]} type="scramble" />
        {/if}
      </div>
    {/each}
  </div>
  <div class="foot">
    <Reveal as="span" class="eyebrow" html={t.images.index} at={[0.2, 0.96]} type="fade" />
    <Reveal as="span" class="eyebrow" html={t.images.caption} at={[0.22, 0.96]} type="fade" />
  </div>
</Section>

<style>
  .grid {
    position: absolute;
    inset: 110rem var(--gutter) 90rem;
    display: grid;
    grid-template-rows: repeat(4, 1fr);
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  :global(#s-editions .rule) {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--line-fade);
  }
  :global(#s-editions .r) {
    font-size: 6.6vw;
    font-weight: 300;
    line-height: 0.9;
  }
  .row-1,
  .row-3 {
    justify-content: flex-end;
  }
  .row-2 {
    padding-left: 18vw;
  }
  :global(#s-editions .tag) {
    align-self: flex-end;
    margin-bottom: 12rem;
  }
  .foot {
    position: absolute;
    left: var(--gutter);
    right: var(--gutter);
    bottom: 40rem;
    display: flex;
    justify-content: space-between;
  }
  @media (max-width: 767px) {
    :global(#s-editions .r) {
      font-size: 10vw;
    }
    .row {
      flex-wrap: wrap;
    }
    .row-2 {
      padding-left: 0;
    }
  }
</style>
