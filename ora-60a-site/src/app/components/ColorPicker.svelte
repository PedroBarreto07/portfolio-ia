<script>
  import { dict, engine, finish } from '../../state/store.js'

  let { size = 'm', label = true } = $props()
  const finishes = engine.config.finishes
</script>

<div class="picker size-{size}" role="radiogroup" aria-label={$dict.colorLabel} data-interactive>
  {#each finishes as f, i}
    <button
      class="swatch"
      class:active={$finish === i}
      style="--c: {f.swatch}"
      role="radio"
      aria-checked={$finish === i}
      aria-label={$dict.colors[i]}
      title={$dict.colors[i]}
      data-cursor-text={$dict.cursor.swap}
      onclick={() => finish.set(i)}
    >
      <span></span>
    </button>
  {/each}
  {#if label}
    <span class="count">{String($finish + 1).padStart(2, '0')} / {String(finishes.length).padStart(2, '0')}</span>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    align-items: center;
    gap: 10rem;
  }
  .swatch {
    position: relative;
    width: 22rem;
    height: 22rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    border: 1px solid transparent;
    transition: border-color 0.5s linear;
  }
  .swatch span {
    width: 12rem;
    height: 12rem;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #fff8, transparent 55%), var(--c);
    box-shadow: inset 0 0 0 1px #0002;
    transition: transform 0.6s var(--ease-expo);
  }
  .swatch:hover span {
    transform: scale(1.18);
  }
  .swatch.active {
    border-color: var(--ink);
  }
  .size-l .swatch {
    width: 30rem;
    height: 30rem;
  }
  .size-l .swatch span {
    width: 16rem;
    height: 16rem;
  }
  .count {
    margin-left: 8rem;
    font-size: 10rem;
    letter-spacing: 0.14em;
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }
  @media (max-width: 767px) {
    .swatch {
      width: 30rem;
      height: 30rem;
    }
    .swatch span {
      width: 16rem;
      height: 16rem;
    }
  }
</style>
