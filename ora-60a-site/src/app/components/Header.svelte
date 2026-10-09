<script>
  import { onMount } from 'svelte'
  import { ScrollTrigger } from 'gsap/ScrollTrigger'
  import project from '../../packages/the-watch/index.js'
  import { dict, engine, locale, loaded, sound } from '../../state/store.js'

  let progress = $state(0)

  async function switchLang() {
    const next = $locale === 'en' ? 'pt' : 'en'
    const { lang, dict: d } = await project.loadLocale(next)
    dict.set(d)
    locale.set(lang)
    document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en-GB'
    document.title = d.meta.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', d.meta.description)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }

  function goTo(id) {
    const el = document.getElementById(`s-${id}`)
    if (el) engine.lenis.scrollTo(el, { duration: 3 })
  }

  onMount(() => {
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (s) => (progress = s.progress),
    })
    return () => st.kill()
  })
</script>

<header class="header" class:is-loaded={$loaded}>
  <button class="brand" onclick={() => engine.lenis.scrollTo(0, { duration: 4 })} aria-label="ORA 60A — top">
    <span class="logo">ORA</span><span class="model">60A</span>
  </button>
  <nav class="nav" aria-label="Primary">
    <button onclick={() => goTo('disassembly')}>{$dict.header.discover}</button>
    <button onclick={() => goTo('parts')}>{$dict.header.configure}</button>
  </nav>
  <div class="tools">
    <button class="sound" class:on={$sound} onclick={() => sound.set(!$sound)} aria-pressed={$sound}>
      <span class="bars" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span>{$dict.header.sound} {$sound ? $dict.header.on : $dict.header.off}</span>
    </button>
    <button class="lang" onclick={switchLang} aria-label={$dict.header.switchLangLabel}>{$dict.header.switchLang}</button>
  </div>
  <div class="progress" style="transform: scaleX({progress})"></div>
</header>

<style>
  .header {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 20;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 22rem var(--gutter);
    color: var(--ink);
    opacity: 0;
    transform: translateY(-10rem);
    transition:
      opacity 1s linear 0.6s,
      transform 1.4s var(--ease-expo) 0.6s,
      color 0.5s linear;
  }
  .header.is-loaded {
    opacity: 1;
    transform: none;
  }
  .brand {
    justify-self: start;
    display: flex;
    align-items: baseline;
    gap: 8rem;
  }
  .logo {
    font-family: var(--font-display);
    font-size: 17rem;
    letter-spacing: 0.06em;
  }
  .model {
    font-size: 10rem;
    letter-spacing: 0.16em;
    color: var(--ink-2);
  }
  .nav {
    display: flex;
    gap: 36rem;
  }
  .nav button,
  .tools button {
    font-size: 10rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    position: relative;
  }
  .nav button::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -4rem;
    height: 1px;
    background: currentColor;
    transform: scaleX(0);
    transform-origin: right;
    transition: transform 0.6s var(--ease-expo);
  }
  .nav button:hover::after {
    transform: scaleX(1);
    transform-origin: left;
  }
  .tools {
    justify-self: end;
    display: flex;
    gap: 28rem;
    align-items: center;
  }
  .sound {
    display: flex;
    align-items: center;
    gap: 10rem;
  }
  .bars {
    display: flex;
    gap: 2rem;
    align-items: flex-end;
    height: 10rem;
  }
  .bars i {
    width: 1.5px;
    height: 3rem;
    background: currentColor;
    transition: height 0.3s;
  }
  .sound.on .bars i {
    animation: eq 0.9s ease-in-out infinite alternate;
  }
  .sound.on .bars i:nth-child(2) {
    animation-delay: -0.3s;
  }
  .sound.on .bars i:nth-child(3) {
    animation-delay: -0.6s;
  }
  .sound.on .bars i:nth-child(4) {
    animation-delay: -0.15s;
  }
  @keyframes eq {
    from {
      height: 2rem;
    }
    to {
      height: 10rem;
    }
  }
  .lang {
    width: 34rem;
    height: 34rem;
    border-radius: 50%;
    border: 1px solid var(--line);
  }
  .progress {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 1px;
    background: var(--ink);
    opacity: 0.25;
    transform-origin: left;
  }
  @media (max-width: 767px) {
    .nav {
      display: none;
    }
    .header {
      grid-template-columns: 1fr 1fr;
      padding: 16rem var(--gutter);
    }
    .sound span:last-child {
      display: none;
    }
  }
</style>
