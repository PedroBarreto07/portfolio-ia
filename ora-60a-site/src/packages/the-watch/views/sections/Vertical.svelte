<script>
  import Section from '../../../../app/components/Section.svelte'
  import Reveal from '../../../../app/components/Reveal.svelte'
  import { dict } from '../../../../state/store.js'

  let { vh } = $props()
  const t = $derived($dict)
</script>

<Section id="vertical" {vh} cursor="hold" label="Case">
  <div class="block top">
    <Reveal as="span" class="eyebrow" html={t.vertical.index} at={[0.1, 0.62]} type="fade" />
    <Reveal as="h2" class="title display" html={t.vertical.caseTitle} at={[0.12, 0.62]} type="chars" stagger={0.02} />
    <Reveal as="p" class="body-s" html={t.vertical.caseText} at={[0.16, 0.62]} type="lines" />
  </div>
  <div class="block bottom">
    <Reveal as="h2" class="title display" html={t.vertical.dialTitle} at={[0.42, 0.96]} type="chars" stagger={0.02} />
    <Reveal as="p" class="body-s" html={t.vertical.dialText} at={[0.46, 0.96]} type="lines" />
  </div>
  <div class="rule" aria-hidden="true"></div>
</Section>

<style>
  .block {
    position: absolute;
    display: grid;
    gap: 16rem;
    max-width: 320rem;
  }
  .top {
    left: var(--gutter);
    top: 130rem;
  }
  .bottom {
    right: var(--gutter);
    bottom: 70rem;
    max-width: none;
    text-align: right;
    justify-items: end;
  }
  :global(#s-vertical .title) {
    font-size: 38rem;
    font-weight: 300;
    line-height: 0.95;
  }
  .rule {
    position: absolute;
    left: 50%;
    top: 12%;
    bottom: 12%;
    width: 1px;
    background: linear-gradient(180deg, #a1a1a100, #a1a1a14d 30%, #a1a1a14d 70%, #a1a1a100);
  }
  @media (max-width: 767px) {
    .top {
      top: 80rem;
      right: var(--gutter);
    }
    .bottom {
      bottom: 40rem;
      left: var(--gutter);
    }
    :global(#s-vertical .title) {
      font-size: 27rem;
    }
    .rule {
      display: none;
    }
  }
</style>
