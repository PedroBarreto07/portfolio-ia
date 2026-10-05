/* =========================================================
   AURORA · main.js
   Bibliotecas (assets/vendor): GSAP 3 + ScrollTrigger, Lenis, Barba.js, particles.js

   Módulos (cada um recebe o objeto "page", que guarda tudo o que precisa
   ser desfeito quando a página muda — Barba — ou quando o idioma troca):
     initLenis · initPreloader · initHero · initAboutParallax · initReveals
     initHighlight · initParallax · initMagnetic · initHovers · initPopup
     initSuccess · initForms · initAccordion · initTheme · initClock
     initWorld (cidades + globo) · initParticles · initMenu · initBarba
     initCookies · I18N
   ========================================================= */

(() => {
  'use strict';

  // =========================================================
  // 0. CONFIGURAÇÃO — troque aqui os dados da sua marca
  // =========================================================
  const CONFIG = {
    // Endpoint do formulário (Formspree, Apps Script, API própria…).
    // Vazio = modo demonstração: simula o envio e mostra os dados no console.
    // Ex.: 'https://formspree.io/f/abcdwxyz'
    formEndpoint: '',
    whatsapp: '5511900000000',
    whatsappMsg: {
      pt: 'Olá! Vim pelo site da Aurora e quero conversar sobre um projeto.',
      en: "Hi! I found Aurora's website and I'd like to talk about a project.",
    },
    gaId: '',                          // ID do Google Analytics 4 (ex.: 'G-XXXXXXX'). Só carrega após aceite.
    hq: { pt: 'São Paulo', en: 'São Paulo', tz: 'America/Sao_Paulo', lat: -23.55, lon: -46.63 },
    logoOffset: { x: 0, y: 0 },        // ajuste fino do logo dentro da janela central (px)
    preloader: { first: 3, returning: 1 }, // duração em segundos
    cityInterval: 2800,
  };

  const CITIES = [
    { pt: 'Nova York', en: 'New York', tz: 'America/New_York', lat: 40.71, lon: -74.0 },
    { pt: 'Los Angeles', en: 'Los Angeles', tz: 'America/Los_Angeles', lat: 34.05, lon: -118.24 },
    { pt: 'Cidade do México', en: 'Mexico City', tz: 'America/Mexico_City', lat: 19.43, lon: -99.13 },
    { pt: 'Paris', en: 'Paris', tz: 'Europe/Paris', lat: 48.86, lon: 2.35 },
    { pt: 'Sydney', en: 'Sydney', tz: 'Australia/Sydney', lat: -33.87, lon: 151.21 },
    { pt: 'Singapura', en: 'Singapore', tz: 'Asia/Singapore', lat: 1.35, lon: 103.82 },
    { pt: 'Toronto', en: 'Toronto', tz: 'America/Toronto', lat: 43.65, lon: -79.38 },
    { pt: 'Rio de Janeiro', en: 'Rio de Janeiro', tz: 'America/Sao_Paulo', lat: -22.91, lon: -43.17 },
    { pt: 'Dubai', en: 'Dubai', tz: 'Asia/Dubai', lat: 25.2, lon: 55.27 },
    { pt: 'Miami', en: 'Miami', tz: 'America/New_York', lat: 25.76, lon: -80.19 },
  ];

  // Continentes do globo: grade 180x90 (2° por célula), 1 bit por célula, em base64.
  // Gerado por scripts/gerar-imagens.js a partir do Blue Marble da NASA.
  const LAND_MASK = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOA/gP8BAAAAAAAAAAAAAAAAAAAAAAD8/////wcAAABAAAADAAAAAAAAAAAAwP/x//8PAPAHAAAA4AAAAAAAAAAAwIDVh////wAABAAACADwAAAAAAAAAAD80T8A/v8PAAAAABwA/n8AOAAAAAAA+LfvD8D/fwAAAAAwIPz//wcDAACAAQD54/4H+P8HAAAMAAL//////x8AAf///3+e+YD/PwAA/B/g///////////4/////59/+B8AAOD/8///////////zP//////4QM/wAcA38///////////w/4/////xkc4AEAAHz+//////////9/gP////8HeAAcAADw5////////////ADgAf7/f4BvAAAAAH78////////H8QAAAiA//8/+AcAAIBB4/////////8ADwAAAPD//5//AQAAPBz/////////A3AAAAAA/v///T8AAGD3//////////8DAwAAAMD/////AwAA8P//////////PwAAAAAA8P///2EAAAD///////////8CAAAAAAD///s/BAAA4P//////////BwAAAAAA8P///gcAAAD+/+n7/////z8AAAAAAAD///8HAAAA/NgPPP//////IQAAAAAA8P//PwAAAOBH8v/3/////wcAAAAAAAD///8BAAAAPkD7f/7///8zEAAAAAAA4P//DwAAAMB5Iv/3////f4YBAAAAAAD+//8AAAAA+A8A//////8jDwAAAAAAgP//AwAAAOD/Mfj/////fwgAAAAAAADw/x8AAAAA/v////////8HAAAAAAAAAP4XAwAAAPD////7////fwAAAAAAAACgPyAAAACA//9/f/////8DAAAAAAAAAPQBAAAAAPz//+9v+P//PwAAAAAAAAAAHkAAAADA/////g////8AAAAAAAAAAOAjDAAAAP7//9//4D//AwAAAAAAAAAAPAMGAADA/////Qf84QcAAAAAAAAAAAA/AAAAAPz//78/wAf+QAAAAAAAAAAAAA8AAADg/////wA4gB8EAAAAAAAAAADAAAAAAP7///8BgAP4gQAAAAAAAAAAAAgOAADA////7wAwgAwIAAAAAAAAAAAA+w8AAPj///8PAANIAAEAAAAAAAAAAID/AQAA////fwBAAAEQAAAAAAAAAAAA+P8AAODj//8DAAA0GAAAAAAAAAAAAID/HwAAAPj/PwAAgMMBAAAAAAAAAAAA/P8DAACA//8AAAA4HgAAAAAAAAAAAMD/fwAAAPy/BwAAAOcFAQAAAAAAAAAA/P8/AACA/z8AAABgTvABAAAAAAAAAOD//w8AAPD/AwAAAAQAfAAAAAAAAAAA/P//AQAA/z8AAACAB4APAAAAAAAAAID//w8AAPD/AwAAAAAQsAAAAAAAAAAA+P//AAAA/j8AAAAAAAAAAAAAAAAAAAD//wcAAPD/QwAAAACAIwAAAAAAAAAA8P9/AAAA/z8GAAAAAD8GAAAAAAAAAAD8/wcAAPD/cwAAAAD4fwAAAAAAAAAAgP8/AAAA/w8HAAAAwP8HAAAAAAAAAAD4/wMAAOD/MAAAAAD//wEAAAAAAAAAgP8fAAAA/g8DAAAA+P8fAAAAAAAAAAD4PwAAAOB/MAAAAID//wMAAAAAAAAAwP8DAAAA/gMAAAAA+P9/AAAAAAAAAAD8HwAAAMA/AAAAAID//wcAAAAAAAAAwP8BAAAA+AEAAAAA8P8/AAAAAAAAAAD8DwAAAIAPAAAAAAAP/gMAAAAAAAAAwH8AAAAAAAAAAAAAEIAfAAAAAAAAAAD+AwAAAAAAAAAAAAAA8AEgAAAAAAAA4A8AAAAAAAAAAAAAAAAAAAYAAAAAAAA+AAAAAAAAAAAAAAAAgAAAAAAAAAAAwAMAAAAAAAAAAAAAAAAIgAEAAAAAAAAeAAAAAAAAAAAAAAAAAAAMAAAAAAAA4AEAAAAAAAAAAAAAAAAAAAAAAAAAAAAeAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAB4APj//v8DAAAAAAAAAAD0AAAAAACA/P/j/////w8AAAAAAAAA4A8AAOD/////////////PwAAAAAA+Mf/AADw//////////////8HAADw/////w8A4P//////////////DwAA/P//////BwD//////////////38A///////////5//////////////////////////////////////////////////////////+f/////////////////9/////////////////////////////7////////////////////////////////////////////////////////////';

  // =========================================================
  // 1. TEXTOS EM INGLÊS (o português fica no próprio HTML)
  // =========================================================
  const EN = {
    'meta.home.title': 'Aurora | Premium digital agency: websites, brands and experiences',
    'meta.home.desc': 'Aurora is a premium digital agency crafting world-class websites, brands and digital experiences. Look premium. Sell better.',
    'meta.legal.title': 'Aurora | Privacy Policy, Legal Notice and Terms',
    'meta.legal.desc': 'How Aurora collects, uses and protects your data, plus our legal notice and terms of use.',
    'meta.404.title': 'Aurora | Lost flight (404)',
    'meta.404.desc': 'This page drifted out of orbit.',

    'a11y.skip': 'Skip to content',
    'a11y.nav': 'Main navigation',
    'a11y.home': 'Aurora, back to top',
    'a11y.lang': 'Switch language to Portuguese',
    'a11y.menu': 'Open menu',
    'a11y.menuNav': 'Menu',
    'a11y.about': 'About Aurora',
    'a11y.legal': 'Legal links',

    'preloader.w2': 'Digital',
    'preloader.w3': 'Studio',

    'nav.manifesto': 'Manifesto',
    'nav.services': 'Services',
    'nav.world': 'World',
    'nav.contact': 'Contact',
    'nav.talk': "Let's talk",
    'nav.home': 'Home',

    'hero.left': 'Look<br>premium',
    'hero.right': 'Sell<br>better',
    'hero.sub': 'Not just beautiful — built to convert.',
    'hero.l1': 'Look premium.',
    'hero.l2': 'Attract more.',
    'hero.l3': 'Sell better.',
    'hero.scroll1': 'Scroll down',
    'hero.scroll2': 'To start the journey',

    'manifesto.label': 'Manifesto',
    'manifesto.text': 'Aurora is a premium digital agency crafting world-class websites, brands and digital experiences. We blend strategy, design and technology to turn ordinary brands into benchmarks — and visitors into customers.',
    'manifesto.p': 'Every project starts with a simple question: what would make someone choose you in three seconds? The answer becomes design, code and results.',
    'manifesto.btn': 'Explore our services',

    'services.label': 'Services',
    'services.title': 'From orbit to click.',
    'services.s1': 'Website design',
    'services.s1p': 'Custom websites, fast and built for conversion. From wireframe to code, every detail exists to sell.',
    'services.s1t': 'UX/UI · Development · CMS',
    'services.s2': 'Branding & identity',
    'services.s2p': 'Strategy, logo and a complete visual system so your brand looks as big as it really is.',
    'services.s2t': 'Naming · Logo · Brand guide',
    'services.s3': 'E-commerce',
    'services.s3p': 'Stores that load in under two seconds and turn window-shopping into checkout.',
    'services.s3t': 'Shopify · WooCommerce · CRO',
    'services.s4': 'Growth & SEO',
    'services.s4p': 'Organic traffic, data and continuous experiments to grow month after month, without relying only on ads.',
    'services.s4t': 'Technical SEO · Analytics · A/B tests',
    'services.s5': 'Digital experiences',
    'services.s5p': 'Motion, 3D and micro-interactions that make your brand remembered and shared.',
    'services.s5t': 'Motion · WebGL · Micro-interactions',
    'services.a1': 'Artemis I rocket launching at night',
    'services.a2': 'Cosmic Cliffs in the Carina Nebula, by the James Webb telescope',
    'services.a3': 'Astronaut on a spacewalk above Earth',
    'services.a4': 'Aurora borealis seen from the International Space Station',
    'services.a5': "Reflection on an astronaut's helmet during a spacewalk",
    'services.credit': 'Images: NASA',

    'world.title': 'Operating worldwide',
    'world.hq': 'São Paulo',
    'world.p': 'Based in São Paulo, with clients on four continents. We work in Portuguese, English and Spanish — in your time zone.',
    'world.hint': 'Drag the globe to spin it.',
    'world.globe': 'Spinning globe showing the cities where we work',

    'contact.label': 'Contact',
    'contact.title': "Let's make your brand unforgettable.",
    'contact.p': "Tell us where you want to go. Within 24 hours you'll get a free assessment and the next steps.",
    'contact.email': 'E-mail',
    'contact.office1': 'Office 1 · São Paulo',
    'contact.office2': 'Office 2 · Lisbon',
    'contact.badge': 'Connected',
    'contact.cardTitle': 'From Brand to Icon.',
    'contact.cardSub': 'We reply within 24h.',
    'contact.waTitle': 'Chat on WhatsApp',
    'contact.waSub': 'Fast replies during business hours',
    'contact.divider': 'or fill in the form',

    'form.name': 'Name',
    'form.namePh': 'Your full name',
    'form.email': 'E-mail',
    'form.emailPh': 'you@company.com',
    'form.country': 'Country',
    'form.countryPh': 'Select',
    'form.phone': 'Phone',
    'form.help': 'What do you need help with?',
    'form.consent': 'I agree to the use of my data solely to reply to this contact, as described in the',
    'form.policy': 'Privacy Policy',
    'form.send': 'Send',
    'form.company': 'Company',
    'form.whats': 'WhatsApp',
    'form.budget': 'Estimated budget',
    'form.message': 'About the project',
    'form.messagePh': 'Goal, timeline, references…',
    'form.sendMsg': 'Send message',

    'c.br': 'Brazil', 'c.us': 'United States', 'c.ca': 'Canada', 'c.mx': 'Mexico', 'c.co': 'Colombia',
    'c.es': 'Spain', 'c.fr': 'France', 'c.uk': 'United Kingdom', 'c.de': 'Germany',
    'c.ae': 'United Arab Emirates', 'c.au': 'Australia', 'c.sg': 'Singapore', 'c.other': 'Other',
    'chip.site': 'New website',
    'chip.other': 'Other',
    'budget.1': 'Up to R$15k',
    'budget.2': 'R$15–40k',
    'budget.3': 'R$40–80k',
    'budget.4': 'Over R$80k',

    'footer.claim': 'Ready for lift-off? The next unforgettable brand could be yours.',
    'footer.cta': 'Start a project',
    'footer.nav': 'Navigation',
    'footer.talk': 'Talk to us',
    'footer.time': 'Now in São Paulo',
    'footer.rights': 'All rights reserved.',
    'footer.nasa': 'Photos: NASA (public domain).',
    'legal.privacy': 'Privacy Policy',
    'legal.notice': 'Legal Notice',
    'legal.terms': 'Terms',
    'legal.cookies': 'Cookies',

    'cta.start': 'Get started',
    'cta.close': 'Close',
    'cta.open': 'Open contact form',

    'popup.label': 'New project',
    'popup.title': "Let's talk about your project.",
    'popup.p': "Tell us a bit about your brand. We'll reply within 24 business hours with ideas and a quote.",

    'success.title': 'Message sent!',
    'success.close': 'Back to the site',

    'landscape': 'Rotate your phone to portrait for the best experience.',

    'cookie.title': 'Cookies, only with your permission',
    'cookie.p': 'We use analytics cookies (Google Analytics) only if you accept. Learn more in our <a href="privacidade.html#cookies">Privacy Policy</a>.',
    'cookie.deny': 'Decline',
    'cookie.accept': 'Accept',

    // Página legal
    'legal.back': 'Back to home',
    'legal.label': 'Legal',
    'legal.title': 'Privacy, notice and terms.',
    'legal.updated': 'Last updated: September 30, 2026.',
    'legal.toc': 'On this page',
    'legal.p.h': 'Privacy Policy',
    'legal.p.1': 'Aurora ("we") respects your privacy and follows the Brazilian General Data Protection Law (LGPD, Law 13.709/2018). This policy explains which data we collect, why, and how you can exercise your rights.',
    'legal.p.2h': 'What we collect',
    'legal.p.2': 'Only what you type into our forms: name, e-mail, country, phone, company, estimated budget and the message about your project. We do not collect sensitive data.',
    'legal.p.3h': 'Purpose and legal basis',
    'legal.p.3': 'We use your data solely to reply to your contact and send a proposal (legal basis: consent and pre-contractual procedures, art. 7, I and V of the LGPD). We never sell or share your data for marketing.',
    'legal.p.4h': 'Retention and security',
    'legal.p.4': 'We keep your data for up to 24 months after the last contact, or until you ask us to delete it, using encrypted connections (HTTPS) and restricted access.',
    'legal.p.5h': 'Your rights',
    'legal.p.5': 'You may request access, correction, portability, anonymization or deletion of your data, and withdraw your consent at any time, by writing to contato@aurora.example. We reply within 15 days.',
    'legal.c.h': 'Cookies',
    'legal.c.1': 'The site works without cookies. Analytics cookies (Google Analytics 4, with anonymized IP) are loaded only after you click "Accept" on the banner. You can change your choice at any time with the button below.',
    'legal.c.btn': 'Change cookie preferences',
    'legal.n.h': 'Legal Notice',
    'legal.n.1': 'This website belongs to Aurora. Texts, brand and layout are protected by copyright. Space photos are from NASA, in the public domain, and are used for illustration only; NASA does not endorse Aurora or its services.',
    'legal.t.h': 'Terms of use',
    'legal.t.1': 'By using this website you agree to use it lawfully and not to try to interfere with its operation. The content is informational and may change without notice. Any disputes will be governed by Brazilian law, in the courts of São Paulo/SP.',

    // 404
    '404.label': 'Error 404 · lost flight',
    '404.title': 'This page drifted out of orbit.',
    '404.p': "The address may have changed, or the page never made it past the atmosphere. Let's get you back to the station.",
    '404.btn': 'Back to the station',
  };

  const MSG = {
    pt: {
      required: 'Este campo é obrigatório.',
      name: 'Digite seu nome (pelo menos 2 letras).',
      email: 'Digite um e-mail válido, como nome@empresa.com.',
      tel: 'Digite um telefone válido, com DDD.',
      select: 'Selecione uma opção.',
      group: 'Escolha pelo menos uma opção.',
      consent: 'É preciso concordar para enviarmos a resposta.',
      message: 'Conte um pouco mais (mínimo de 10 caracteres).',
      summary: (n) => (n === 1 ? 'Corrija o campo destacado.' : `Corrija os ${n} campos destacados.`),
      sending: 'Enviando…',
      error: 'Não foi possível enviar agora. Tente de novo em instantes ou fale com a gente pelo WhatsApp.',
      success: (nome) => `Obrigado${nome ? ', ' + nome : ''}! Recebemos sua mensagem e respondemos em até 24 horas.`,
      openMenu: 'Abrir menu',
      closeMenu: 'Fechar menu',
    },
    en: {
      required: 'This field is required.',
      name: 'Enter your name (at least 2 letters).',
      email: 'Enter a valid e-mail, like name@company.com.',
      tel: 'Enter a valid phone number.',
      select: 'Select an option.',
      group: 'Choose at least one option.',
      consent: 'You need to agree so we can reply.',
      message: 'Tell us a bit more (at least 10 characters).',
      summary: (n) => (n === 1 ? 'Please fix the highlighted field.' : `Please fix the ${n} highlighted fields.`),
      sending: 'Sending…',
      error: "We couldn't send it right now. Please try again in a moment or reach us on WhatsApp.",
      success: (nome) => `Thank you${nome ? ', ' + nome : ''}! We got your message and will reply within 24 hours.`,
      openMenu: 'Open menu',
      closeMenu: 'Close menu',
    },
  };

  // =========================================================
  // 2. UTILITÁRIOS E ESTADO
  // =========================================================
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const clamp = (min, max, v) => Math.min(max, Math.max(min, v));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const isDesktop = () => matchMedia('(min-width: 992px)').matches;
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado: tudo bem */ } },
  };

  // A classe já considera a escolha salva no site (aurora-motion) e, sem escolha, o sistema
  const reduce = root.classList.contains('reduce-motion');
  const sistemaPedeMenos = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const libsOk = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  const state = {
    lang: 'pt',
    lenis: null,
    page: null,
    firstLoad: true,
    popupOpen: false,
    aboutST: null,           // ScrollTrigger do parallax do about (usado nas âncoras)
    ptMeta: { title: document.title, desc: $('meta[name="description"]')?.content || '' },
    namespace: $('[data-barba="container"]')?.dataset.barbaNamespace || 'home',
  };

  // Idioma: ?lang=en na URL > preferência salva > português
  const urlLang = new URLSearchParams(location.search).get('lang');
  state.lang = urlLang === 'en' || urlLang === 'pt' ? urlLang : storage.get('aurora-lang') === 'en' ? 'en' : 'pt';

  const msg = () => MSG[state.lang];

  // Trava/destrava a rolagem (preloader, popup, menu)
  function lock(on) {
    document.body.classList.toggle('is-locked', on);
    root.classList.toggle('is-locked', on);
    if (on) {
      document.body.setAttribute('data-lenis-prevent', '');
      state.lenis?.stop();
    } else {
      document.body.removeAttribute('data-lenis-prevent');
      state.lenis?.start();
    }
  }

  // Objeto "page": tudo que for criado aqui é desfeito em destroyPage()
  function createPage(container) {
    const ac = new AbortController();
    return {
      container,
      signal: ac.signal,
      ac,
      ctx: libsOk ? gsap.context(() => {}, container) : null,
      mm: libsOk ? gsap.matchMedia() : null,
      cleanups: [],
      intro: null,
      on(el, type, fn, opts = {}) { if (el) el.addEventListener(type, fn, { ...opts, signal: ac.signal }); },
      add(fn) { this.cleanups.push(fn); },
      observe(el, fn, options) {
        const io = new IntersectionObserver(fn, options);
        io.observe(el);
        this.add(() => io.disconnect());
        return io;
      },
    };
  }

  function destroyPage(page) {
    if (!page) return;
    page.ac.abort();
    page.cleanups.splice(0).reverse().forEach((fn) => { try { fn(); } catch (e) { console.warn(e); } });
    page.mm?.revert();
    page.ctx?.revert();
    lock(false);
  }

  // Executa fn uma vez quando o elemento entra na tela (usa a posição VISUAL,
  // então funciona mesmo dentro de blocos que já estão em parallax)
  function onEnter(page, el, fn, rootMargin = '0px 0px -12% 0px') {
    const io = page.observe(el, ([e]) => {
      if (e.isIntersecting) { io.disconnect(); fn(); }
    }, { rootMargin });
  }

  // "Scrub" baseado na posição visual do elemento: roda a cada frame só enquanto ele está perto da tela
  function visualScrub(page, el, fn) {
    let ativo = false;
    const tick = () => fn(el.getBoundingClientRect());
    page.observe(el, ([e]) => {
      if (e.isIntersecting && !ativo) { ativo = true; gsap.ticker.add(tick); }
      else if (!e.isIntersecting && ativo) { ativo = false; gsap.ticker.remove(tick); tick(); }
    }, { rootMargin: '25% 0px 25% 0px' });
    tick();
    page.add(() => gsap.ticker.remove(tick));
  }

  // =========================================================
  // 3. SPLIT DE TEXTO (sem plugin pago)
  //    split(el, 'lines words chars') → { lines, words, chars }
  //    Preserva tags internas (<br>, <em>, <a>…) e deixa uma cópia
  //    do texto só para leitores de tela.
  // =========================================================
  function split(el, types = 'words') {
    if (el.__split) return el.__split;
    const withChars = types.includes('chars');
    const textoOriginal = el.textContent.replace(/\s+/g, ' ').trim();

    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    while (el.firstChild) visual.appendChild(el.firstChild);

    const words = [];
    const chars = [];
    const walk = (node) => {
      [...node.childNodes].forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((parte) => {
            if (!parte) return;
            if (/^\s+$/.test(parte)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'word';
            if (withChars) {
              [...parte].forEach((ch) => {
                const c = document.createElement('span');
                c.className = 'char';
                c.textContent = ch;
                w.appendChild(c);
                chars.push(c);
              });
            } else {
              w.textContent = parte;
            }
            frag.appendChild(w);
            words.push(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
          walk(child);
        }
      });
    };
    walk(visual);

    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = textoOriginal;
    el.append(sr, visual);

    // Linhas: agrupa palavras pela posição vertical (não cria wrappers, preserva as tags)
    const lines = [];
    if (types.includes('lines')) {
      let topo = null;
      words.forEach((w) => {
        const t = w.offsetTop;
        if (topo === null || Math.abs(t - topo) > 3) { lines.push([]); topo = t; }
        lines[lines.length - 1].push(w);
      });
    }
    el.__split = { lines, words, chars };
    return el.__split;
  }

  // =========================================================
  // 4. I18N (PT ↔ EN)
  // =========================================================
  const I18N = {
    capture(scope) {
      $$('[data-i18n]', scope).forEach((el) => {
        if (el.__pt === undefined) el.__pt = el.hasAttribute('data-i18n-html') ? el.innerHTML : el.textContent;
      });
      $$('[data-i18n-attr]', scope).forEach((el) => {
        if (el.__ptAttr) return;
        el.__ptAttr = {};
        el.dataset.i18nAttr.split(';').forEach((par) => {
          const [attr] = par.split(':');
          el.__ptAttr[attr.trim()] = el.getAttribute(attr.trim());
        });
      });
    },
    apply(scope, lang) {
      $$('[data-i18n]', scope).forEach((el) => {
        const key = el.dataset.i18n;
        const valor = lang === 'en' && EN[key] !== undefined ? EN[key] : el.__pt;
        if (valor === undefined) return;
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = valor;
        else el.textContent = valor;
        el.__split = null; // o texto mudou: precisa dividir de novo
      });
      $$('[data-i18n-attr]', scope).forEach((el) => {
        el.dataset.i18nAttr.split(';').forEach((par) => {
          const [attr, key] = par.split(':').map((s) => s.trim());
          const valor = lang === 'en' && EN[key] !== undefined ? EN[key] : el.__ptAttr?.[attr];
          if (valor != null) el.setAttribute(attr, valor);
        });
      });

      root.lang = lang === 'en' ? 'en' : 'pt-BR';
      const ns = state.namespace;
      document.title = lang === 'en' && EN[`meta.${ns}.title`] ? EN[`meta.${ns}.title`] : state.ptMeta.title;
      const desc = $('meta[name="description"]');
      if (desc) desc.content = lang === 'en' && EN[`meta.${ns}.desc`] ? EN[`meta.${ns}.desc`] : state.ptMeta.desc;

      $$('[data-lang-toggle] [data-lang]').forEach((s) => s.classList.toggle('is-active', s.dataset.lang === lang));
      $$('[data-lang-toggle]').forEach((b) => b.setAttribute('aria-label', lang === 'en' ? EN['a11y.lang'] : 'Mudar idioma para inglês'));

      // Links de WhatsApp com a mensagem no idioma certo
      const wa = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.whatsappMsg[lang])}`;
      $$('[data-whatsapp]').forEach((a) => (a.href = wa));
      $$('[data-year]').forEach((y) => (y.textContent = new Date().getFullYear()));
      $$('[data-motion-toggle]').forEach((b) => {
        b.textContent = reduce
          ? (lang === 'en' ? 'Turn on animations' : 'Ativar animações')
          : (lang === 'en' ? 'Reduce motion' : 'Reduzir movimento');
      });
    },
  };

  function setLang(lang) {
    if (lang === state.lang) return;
    state.lang = lang;
    storage.set('aurora-lang', lang);
    const page = state.page;
    const y = state.lenis ? state.lenis.scroll : window.scrollY;
    destroyPage(page);
    init(page.container);
    // Volta exatamente para onde estava
    requestAnimationFrame(() => {
      if (libsOk) ScrollTrigger.refresh();
      if (state.lenis) state.lenis.scrollTo(y, { immediate: true, force: true });
      else window.scrollTo(0, y);
    });
  }

  // =========================================================
  // 5. LENIS + SCROLLTRIGGER
  // =========================================================
  function initLenis(page) {
    if (reduce || typeof window.Lenis === 'undefined') return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,            // (antigo "smoothTouch": no toque, rolagem nativa)
      touchMultiplier: 2,
    });
    lenis.on('scroll', ScrollTrigger.update);
    const raf = (t) => lenis.raf(t * 1000);   // ticker do GSAP em segundos, Lenis em ms
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    state.lenis = lenis;

    // Áreas internas com rolagem própria (ex.: o popup) ganham um Lenis mais curto
    $$('[data-lenis-scroll]', page.container).forEach((el) => {
      const interno = new Lenis({ wrapper: el, content: el.firstElementChild, duration: 0.6, smoothWheel: true });
      const r = (t) => interno.raf(t * 1000);
      gsap.ticker.add(r);
      page.add(() => { gsap.ticker.remove(r); interno.destroy(); });
    });

    page.add(() => {
      gsap.ticker.remove(raf);
      lenis.destroy();
      state.lenis = null;
    });
  }

  // Rolagem até um elemento considerando o parallax do bloco "about"
  // (o conteúdo lá anda mais rápido que a rolagem, então rect.top não basta)
  function scrollTargetFor(el) {
    const atual = state.lenis ? state.lenis.scroll : window.scrollY;
    const header = $('[data-header]');
    const offset = el.id === 'inicio' ? 0 : (header ? header.offsetHeight : 0) + 12;
    const rect = el.getBoundingClientRect();
    const aboutS = el.closest('[data-about-s]');
    const st = state.aboutST;
    const max = ScrollTrigger.maxScroll(window);
    if (el.id === 'inicio') return 0;
    if (!aboutS || !st) return clamp(0, max, atual + rect.top - offset);

    const yAgora = gsap.getProperty(aboutS, 'y');
    const topoNatural = atual + rect.top - yAgora;           // posição sem o transform
    const V = window.innerHeight;
    const y0 = -0.5 * V, y1 = -2 * V, s0 = st.start, s1 = st.end;
    const k = (y1 - y0) / (s1 - s0);
    // topo(s) = topoNatural + y(s) - s  →  resolve topo(s) = offset
    let s = (offset - topoNatural - y0 + k * s0) / (k - 1);
    if (s < s0) s = topoNatural + y0 - offset;
    else if (s > s1) s = topoNatural + y1 - offset;
    return clamp(0, max, s);
  }

  function scrollToEl(el, immediate = false) {
    if (!el) return;
    const y = libsOk ? scrollTargetFor(el) : el.getBoundingClientRect().top + window.scrollY;
    if (state.lenis) state.lenis.scrollTo(y, { duration: 1.8, immediate, force: true });
    else window.scrollTo({ top: y, behavior: reduce || immediate ? 'auto' : 'smooth' });
    // acessibilidade: o foco acompanha a rolagem
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }

  // =========================================================
  // 6. PRELOADER: persiana de janela de avião
  // =========================================================
  function initPreloader(page, pronto) {
    const pre = $('[data-preloader]', page.container);
    if (!pre) return pronto();
    if (reduce || !state.firstLoad || !libsOk) { pre.remove(); return pronto(); }

    let voltou = false;
    try { voltou = !!sessionStorage.getItem('aurora-visited'); sessionStorage.setItem('aurora-visited', '1'); } catch (e) { /* ok */ }

    lock(true);
    const palavras = $$('[data-preloader-word]', pre);
    const shade = $('[data-preloader-shade]', pre);
    const handle = $('[data-preloader-handle]', pre);
    const front = $('[data-preloader-front]', pre);
    let chamou = false;
    const liberar = () => { if (!chamou) { chamou = true; pronto(); } };

    const tl = gsap.timeline({
      onComplete: () => { pre.remove(); lock(false); ScrollTrigger.refresh(); },
    });
    tl.fromTo(palavras, { filter: 'blur(36px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1, duration: 1, stagger: 0.08, ease: 'power2.out' })
      .to(palavras, { filter: 'blur(36px)', opacity: 0, duration: 0.5, stagger: 0.02, ease: 'power2.in' }, 1.1)
      .addLabel('abre', 1.4)
      .to(shade, { '--mask-y': '200%', duration: 1.2, ease: 'power2.out' }, 'abre')
      .to(shade, { yPercent: -92, scaleY: 0.5, duration: 1.2, ease: 'power2.inOut' }, 'abre')
      .fromTo(handle, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 'abre')
      .to(front, { opacity: 0, duration: 0.8, ease: 'power2.out' }, 'abre+=0.4')
      .add(liberar, 'abre+=0.5')
      .to(pre, { autoAlpha: 0, duration: 0.6 }, 'abre+=1.0');

    // 3s na primeira visita, 1s nas seguintes (sessionStorage)
    tl.timeScale(tl.duration() / (voltou ? CONFIG.preloader.returning : CONFIG.preloader.first));
    page.add(() => { tl.kill(); if (pre.isConnected) pre.remove(); });
  }

  // =========================================================
  // 7. HERO: atravessar a janela da estação
  // =========================================================
  function initHero(page) {
    const c = page.container;
    const area = $('[data-hero-area]', c);
    const header = $('[data-header]', c);
    const logo = $('[data-header-logo]', c);
    const cta = $('[data-cta]', c);

    // --- Intro (roda quando o preloader libera) ---
    page.intro = gsap.timeline({ paused: true });
    if (!reduce) {
      if (area) {
        const palavras = $$('[data-hero-words]', c).flatMap((el) => split(el, 'words').words);
        const sub = $('.hero_sub', c);
        page.intro
          .from(palavras, { rotateX: 90, opacity: 0, transformOrigin: 'center bottom', transformPerspective: 800, duration: 1.4, stagger: 0.075, ease: 'power4.out' }, 0.1)
          .from(sub ? split(sub, 'words').words : [], { filter: 'blur(12px)', opacity: 0, duration: 1, stagger: 0.03, ease: 'power2.out' }, 0.5)
          .from($$('.hero_list li, .hero_scroll-text p, .hero_mouse', c), { filter: 'blur(36px)', opacity: 0, duration: 1, stagger: 0.1, ease: 'power2.out' }, 0.6);
      }
      if (header) {
        if (isDesktop()) {
          page.intro.from($$('.header_nav, .header_logo, .header_right', header), { opacity: 0, filter: 'blur(36px)', duration: 1, stagger: 0.1, ease: 'power2.out', clearProps: 'filter' }, 0.2);
        } else {
          // Mobile: header aparece com opacity + blur após 600ms
          page.intro.from(header, { opacity: 0, filter: 'blur(36px)', duration: 1, ease: 'power2.out', clearProps: 'filter' }, 0.6);
        }
      }
      if (cta) page.intro.from(cta, { yPercent: 150, opacity: 0, duration: 1.2, ease: 'power4.out' }, 0.7);
    }

    if (!area || reduce) return;
    const bg = $('[data-hero-bg]', c);
    const s = $('[data-hero-s]', c);
    const left = $('[data-hero-left]', c);
    const right = $('[data-hero-right]', c);
    const sky = $('[data-sky-hero]', c);
    const fades = $$('[data-hero-bot], .hero_sub', c);

    page.mm.add({ desktop: '(min-width: 992px)', mobile: '(max-width: 991px)' }, (mc) => {
      if (mc.conditions.desktop) {
        // Posição do logo: centro da janela central (centro da tela) menos o centro do logo no header.
        // Usa offsetLeft/Top (layout) para não depender do transform atual → sem saltos após resize.
        const logoXY = () => {
          const h = header.getBoundingClientRect();
          return {
            x: window.innerWidth / 2 - (h.left + logo.offsetLeft + logo.offsetWidth / 2) + CONFIG.logoOffset.x,
            y: window.innerHeight / 2 - (h.top + logo.offsetTop + logo.offsetHeight / 2) + CONFIG.logoOffset.y,
          };
        };

        const tl = gsap.timeline({
          defaults: { ease: 'none', duration: 1 },
          scrollTrigger: {
            trigger: area,
            start: 'top top',
            end: 'bottom bottom',
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        tl.to(bg, { scale: 6.5, xPercent: -2, z: 100 }, 0)
          .to(s, { scale: 8 }, 0)
          .to(left, { x: () => -window.innerWidth / 2 }, 0)
          .to(right, { x: () => window.innerWidth / 2 }, 0)
          .to(sky, { y: () => window.innerHeight }, 0)          // parallax: a Terra "desce" mais devagar
          .to(fades, { opacity: 0, duration: 0.2 }, 0)
          .to(bg, { opacity: 0, duration: 0.1 }, 0.9)            // garante que nenhuma quina da moldura sobre
          .fromTo(logo, { x: () => logoXY().x, y: () => logoXY().y, scale: 1.25 }, { x: 0, y: 0, scale: 1, ease: 'power1.out' }, 0);
      } else {
        // Mobile: composição estática, só um fade/zoom leve e barato
        gsap.timeline({ scrollTrigger: { trigger: area, start: 'top top', end: 'bottom bottom', scrub: true } })
          .to(bg, { scale: 1.8, opacity: 0, ease: 'power1.in' }, 0)
          .to(s, { opacity: 0, scale: 1.1, ease: 'none' }, 0);
      }
    });
  }

  // =========================================================
  // 8. ABOUT: o conteúdo flutua sobre o céu (y -50vh → -200vh)
  // =========================================================
  function initAboutParallax(page) {
    const w = $('[data-about-w]', page.container);
    const s = $('[data-about-s]', page.container);
    if (!w || !s || reduce) return;

    page.mm.add('(min-width: 992px)', () => {
      // O conteúdo sobe 150vh a mais que a rolagem; a altura do .about-w é calculada
      // para o fim do conteúdo encostar no rodapé no momento em que ele aparece.
      // Resolve: W - S = y0 + Δ·W/(W+V)  →  W² + (3V - S)W - (S - V/2)V = 0
      const ajustarAltura = () => {
        const V = window.innerHeight, S = s.offsetHeight;
        const b = 3 * V - S, cc = -(S - 0.5 * V) * V;
        const W = (-b + Math.sqrt(b * b - 4 * cc)) / 2;
        w.style.height = `${Math.max(W, V)}px`;
      };
      ajustarAltura();
      ScrollTrigger.addEventListener('refreshInit', ajustarAltura);

      const tween = gsap.fromTo(s, { y: () => -0.5 * window.innerHeight }, {
        y: () => -2 * window.innerHeight,
        ease: 'none',
        scrollTrigger: { trigger: w, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
      state.aboutST = tween.scrollTrigger;

      return () => {
        ScrollTrigger.removeEventListener('refreshInit', ajustarAltura);
        w.style.height = '';
        state.aboutST = null;
      };
    });
  }

  // =========================================================
  // 9. REVELAÇÃO DE TEXTOS (blur → nítido)
  // =========================================================
  const ESCONDIDO = { filter: 'blur(36px)', opacity: 0 };
  const VISIVEL = { filter: 'blur(0px)', opacity: 1, duration: 1, ease: 'power2.out', clearProps: 'filter' };

  function initReveals(page) {
    if (reduce) return;
    const c = page.container;

    // Linhas: as palavras de cada linha entram juntas, com stagger de .1 entre linhas
    $$('[data-line-reveal]', c).forEach((el) => {
      const { lines, words } = split(el, 'lines words');
      const linhaDe = new Map();
      lines.forEach((ln, i) => ln.forEach((w) => linhaDe.set(w, i)));
      gsap.set(words, ESCONDIDO);
      onEnter(page, el, () => gsap.to(words, { ...VISIVEL, delay: 0.3, stagger: (i, t) => (linhaDe.get(t) || 0) * 0.1 }));
    });

    $$('[data-char-reveal]', c).forEach((el) => {
      const { chars } = split(el, 'words chars');
      gsap.set(chars, ESCONDIDO);
      onEnter(page, el, () => gsap.to(chars, { ...VISIVEL, delay: 0.3, stagger: 0.05 }));
    });

    $$('[data-div-reveal]', c).forEach((el) => {
      const filhos = el.tagName.toLowerCase() === 'svg' ? [el] : [...el.children];
      gsap.set(filhos, ESCONDIDO);
      onEnter(page, el, () => gsap.to(filhos, { ...VISIVEL, delay: 0.3, stagger: 0.1 }));
    });

    // Variações: palavras girando no eixo X / letras no eixo Y
    $$('[data-word-rotate]', c).forEach((el) => {
      const { words } = split(el, 'words');
      gsap.set(words, { rotateX: 90, opacity: 0, transformOrigin: 'center bottom', transformPerspective: 800 });
      onEnter(page, el, () => gsap.to(words, { rotateX: 0, opacity: 1, duration: 1.2, stagger: 0.075, ease: 'power4.out' }));
    });
    $$('[data-char-rotate]', c).forEach((el) => {
      const { chars } = split(el, 'words chars');
      gsap.set(chars, { rotateY: 90, opacity: 0, transformPerspective: 600 });
      onEnter(page, el, () => gsap.to(chars, { rotateY: 0, opacity: 1, duration: 1, stagger: 0.025, ease: 'power4.out' }));
    });
  }

  // Manifesto: letras começam em .15 e "acendem" com a rolagem (top 75% → bottom 75%)
  function initHighlight(page) {
    $$('[data-highlight-text]', page.container).forEach((el) => {
      const { chars } = split(el, 'words chars');
      if (reduce) { gsap.set(chars, { opacity: 1 }); return; }
      const tl = gsap.timeline({ paused: true }).to(chars, { opacity: 1, ease: 'none', duration: 0.3, stagger: { each: 0.04 } });
      visualScrub(page, el, (r) => {
        const linha = window.innerHeight * 0.75;
        tl.progress(clamp(0, 1, (linha - r.top) / Math.max(1, r.height)));
      });
    });
  }

  // Parallax genérico: [data-parallax="img"] dentro de [data-parallax="w"] (yPercent -30 → 10 por padrão)
  function initParallax(page) {
    if (reduce) return;
    $$('[data-parallax="w"]', page.container).forEach((w) => {
      const img = $('[data-parallax="img"]', w);
      if (!img) return;
      const de = parseFloat(img.dataset.parallaxFrom ?? -30);
      const ate = parseFloat(img.dataset.parallaxTo ?? 10);
      const set = gsap.quickSetter(img, 'yPercent');
      // "top bottom" → "bottom top", medido pela posição visual
      visualScrub(page, w, (r) => {
        const V = window.innerHeight;
        const p = clamp(0, 1, (V - r.top) / (V + r.height));
        set(de + (ate - de) * p);
      });
    });
  }

  // =========================================================
  // 10. TEMA DO HEADER (troca conforme a seção atrás dele)
  // =========================================================
  function initTheme(page) {
    const header = $('[data-header]', page.container);
    if (!header) return;
    const setTema = (bg) => {
      header.classList.toggle('theme_on-color', bg === 'color');
      header.classList.toggle('theme_on-light', bg === 'light');
    };
    page.setTema = setTema;
    // O CTA flutuante (embaixo) também inverte quando passa sobre uma seção clara
    const cta = $('[data-cta]', page.container);
    if (cta) {
      $$('[data-bg="light"]', page.container).forEach((sec) => ScrollTrigger.create({
        trigger: sec,
        start: 'top bottom-=40',
        end: 'bottom bottom-=40',
        toggleClass: { targets: cta, className: 'on-light' },
      }));
    }
    $$('[data-bg]', page.container).forEach((sec) => {
      ScrollTrigger.create({
        trigger: sec,
        start: () => `top ${header.offsetHeight / 2}px`,
        end: () => `bottom ${header.offsetHeight / 2}px`,
        onToggle: (self) => {
          if (!self.isActive) return;
          page.temaAtual = sec.dataset.bg;
          if (!state.menuOpen) setTema(sec.dataset.bg);
        },
      });
    });
  }

  // =========================================================
  // 11. BOTÕES MAGNÉTICOS (só desktop com mouse)
  // =========================================================
  function initMagnetic(page) {
    if (reduce) return;
    page.mm.add('(min-width: 992px) and (hover: hover)', () => {
      const ac = new AbortController();
      $$('[data-magnetic-strength]', page.container).forEach((btn) => {
        const inner = $('[data-magnetic-inner]', btn);
        const forca = parseFloat(btn.dataset.magneticStrength) || 25;
        const forcaInterna = parseFloat(btn.dataset.magneticStrengthInner) || forca / 2;

        btn.addEventListener('mousemove', (e) => {
          if (state.popupOpen) return;
          const r = btn.getBoundingClientRect();
          const em = parseFloat(getComputedStyle(btn).fontSize);   // o deslocamento é em "em"
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          gsap.to(btn, { x: px * (forca / 16) * em, y: py * (forca / 16) * em, rotate: '0.001deg', ease: 'power4.out', duration: 1.6 });
          if (inner) gsap.to(inner, { x: px * (forcaInterna / 16) * em, y: py * (forcaInterna / 16) * em, rotate: '0.001deg', ease: 'power4.out', duration: 1.6 });
        }, { signal: ac.signal });

        btn.addEventListener('mouseleave', () => {
          if (state.popupOpen) return;
          gsap.to(btn, { x: 0, y: 0, ease: 'elastic.out(1, 0.3)', duration: 1.6, clearProps: 'all' });
          if (inner) gsap.to(inner, { x: 0, y: 0, ease: 'elastic.out(1, 0.3)', duration: 2, clearProps: 'all' });
        }, { signal: ac.signal });
      });
      return () => ac.abort();
    });
  }

  // =========================================================
  // 12. HOVERS: nav-item, .btn e CTA (texto duplicado)
  // =========================================================
  function initHovers(page) {
    if (reduce) return;
    const c = page.container;
    page.mm.add('(min-width: 992px) and (hover: hover)', () => {
      const ac = new AbortController();
      const on = (el, t, f) => el && el.addEventListener(t, f, { signal: ac.signal });

      // nav-item: texto sobe e a cópia entra de baixo; fundo sobe (yPercent -100)
      $$('[data-nav-hover]', c).forEach((item) => {
        const bg = $('.nav-item_bg_hover', item);
        const t1 = $('.nav-item_text:not(.is-2)', item);
        const t2 = $('.nav-item_text.is-2', item);
        gsap.set(t2, { visibility: 'visible' });
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'none', duration: 1 } })
          .to(bg, { yPercent: -100 }, 0)
          .to([t1, t2], { yPercent: -100 }, 0);
        on(item, 'mouseenter', () => gsap.to(tl, { progress: 1, duration: 1.2, ease: 'power2.out', overwrite: true }));
        on(item, 'mouseleave', () => gsap.to(tl, { progress: 0, duration: 0.6, ease: 'power2.out', overwrite: true }));
      });

      // .btn: 24px → 32px, painel desliza da direita, textos trocam na horizontal
      $$('[data-btn-hover]', c).forEach((btn) => {
        const painel = $('.btn_hover', btn);
        const t1 = $('.btn_text:not(.is-2)', btn);
        const t2 = $('.btn_text.is-2', btn);
        if (!painel || !t1 || !t2) return;
        gsap.set(t2, { visibility: 'visible', xPercent: 150 });
        const tl = gsap.timeline({ paused: true, defaults: { ease: 'none', duration: 1 } })
          .to(painel, { xPercent: -100 }, 0)
          .to(t1, { xPercent: -150 }, 0)
          .to(t2, { xPercent: 0 }, 0);
        if (btn.classList.contains('btn') && !btn.classList.contains('btn--dark')) {
          tl.fromTo(btn, { height: '1.666em' }, { height: '2.222em' }, 0);
        }
        on(btn, 'mouseenter', () => gsap.to(tl, { progress: 1, duration: 1, ease: 'power2.out', overwrite: true }));
        on(btn, 'mouseleave', () => gsap.to(tl, { progress: 0, duration: 0.6, ease: 'power2.out', overwrite: true }));
      });

      // CTA: letras do texto 1 sobem, as do texto 2 entram de baixo; a seta sai e a cópia entra
      const cta = $('[data-cta]', c);
      if (cta) {
        const pill = $('[data-cta-pill]', cta);
        const t1 = $('[data-cta-text]', cta);
        const t2 = $('[data-cta-text2]', cta);
        const c1 = split(t1, 'chars').chars;
        const c2 = split(t2, 'chars').chars;
        const a1 = $('[data-cta-arrow]', cta);
        const a2 = $('[data-cta-arrow2]', cta);
        gsap.set(t2, { visibility: 'visible' });
        gsap.set(c2, { yPercent: 140 });
        gsap.set(a2, { visibility: 'visible', xPercent: -150, yPercent: 75 });
        const tl = gsap.timeline({ paused: true, defaults: { duration: 1, ease: 'power2.inOut' } })
          .to(c1, { yPercent: -140, opacity: 0, stagger: 0.01 }, 0)
          .to(c2, { yPercent: 0, stagger: 0.01 }, 0)
          .to(a1, { xPercent: 150, yPercent: -75 }, 0)
          .to(a2, { xPercent: 0, yPercent: 0 }, 0);
        on(pill, 'mouseenter', () => { if (!state.popupOpen) tl.timeScale(1).play(); });
        on(pill, 'mouseleave', () => tl.timeScale(1.4).reverse());
        page.ctaHover = tl;
      }
      return () => { ac.abort(); page.ctaHover = null; };
    });
  }

  // =========================================================
  // 13. POPUP DO FORMULÁRIO
  // =========================================================
  function initPopup(page) {
    const c = page.container;
    const popup = $('[data-popup="contact"]', c);
    const openers = $$('[data-popup-open="contact"]', c);

    // Páginas sem popup: o botão leva para o contato da home
    if (!popup) {
      openers.forEach((b) => page.on(b, 'click', (e) => { e.preventDefault(); goTo('index.html#contato'); }));
      return;
    }

    const modal = $('[data-popup-modal]', popup);
    const overlay = $('[data-popup-overlay]', popup);
    const content = $('.pop-up_content', popup);
    const cta = $('[data-cta]', c);
    const main = $('[data-cta-main]', c);
    const fecharBtn = $('[data-cta-close]', c);
    const icon = $('[data-cta-icon]', c);
    const emPx = (n) => n * parseFloat(getComputedStyle(main).fontSize);
    let quemAbriu = null;
    let tl = null;

    gsap.set(modal, { yPercent: 110 });

    // Quanto o CTA sobe para ficar centralizado na faixa superior do modal
    const ctaY = () => {
      const faixa = parseFloat(getComputedStyle(content).paddingTop);
      const topoFinal = window.innerHeight - parseFloat(getComputedStyle(modal).bottom) - modal.offsetHeight;
      const r = cta.getBoundingClientRect();
      const centroSemY = r.top - gsap.getProperty(cta, 'y') + r.height / 2;
      return topoFinal + faixa / 2 - centroSemY;
    };

    function abrir(e) {
      if (state.popupOpen) return fechar();
      state.popupOpen = true;
      quemAbriu = e?.currentTarget || document.activeElement;
      page.ctaHover?.reverse();
      gsap.killTweensOf([main, icon, ...$$('[data-magnetic-inner]', cta)]);
      gsap.set([main, icon, ...$$('[data-magnetic-inner]', cta)], { x: 0, y: 0 });

      popup.classList.add('is-open');
      popup.setAttribute('aria-hidden', 'false');
      cta.classList.add('is-open');
      fecharBtn.setAttribute('tabindex', '0');
      fecharBtn.removeAttribute('aria-hidden');
      main.setAttribute('tabindex', '-1');
      icon.setAttribute('aria-label', state.lang === 'en' ? 'Close form' : 'Fechar formulário');
      lock(true);

      tl?.kill();
      tl = gsap.timeline({ defaults: { duration: 1, ease: 'power2.out' } })
        .to(overlay, { opacity: 1, duration: 0.6 }, 0)
        .to(modal, { yPercent: 0 }, 0)
        .to(cta, { y: ctaY }, 0)
        .to(main, { x: emPx(3.333), autoAlpha: 0, duration: 0.6, ease: 'power2.inOut' }, 0)
        .fromTo(fecharBtn, { x: -emPx(3.333), autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.6, ease: 'power2.inOut' }, 0.25)
        .to(icon, { rotate: 90, duration: 0.6, ease: 'power2.inOut' }, 0);
      if (reduce) tl.progress(1);

      setTimeout(() => $('input:not([type="hidden"]):not([tabindex="-1"])', modal)?.focus({ preventScroll: true }), 450);
    }

    function fechar() {
      if (!state.popupOpen) return;
      state.popupOpen = false;
      cta.classList.remove('is-open');
      fecharBtn.setAttribute('tabindex', '-1');
      fecharBtn.setAttribute('aria-hidden', 'true');
      main.removeAttribute('tabindex');
      icon.setAttribute('aria-label', state.lang === 'en' ? EN['cta.open'] : 'Abrir formulário de contato');

      tl?.kill();
      tl = gsap.timeline({
        defaults: { duration: 0.8, ease: 'power2.inOut' },
        onComplete: () => {
          popup.classList.remove('is-open');
          popup.setAttribute('aria-hidden', 'true');
        },
      })
        .to(modal, { yPercent: 110, ease: 'power2.in' }, 0)
        .to(overlay, { opacity: 0 }, 0)
        .to(cta, { y: 0 }, 0)
        .to(fecharBtn, { x: -emPx(3.333), autoAlpha: 0, duration: 0.5 }, 0)
        .to(main, { x: 0, autoAlpha: 1, duration: 0.6 }, 0.2)
        .to(icon, { rotate: 0, duration: 0.6 }, 0);
      if (reduce) tl.progress(1);
      if (!state.successOpen) lock(false);
      if (quemAbriu && quemAbriu.isConnected) quemAbriu.focus({ preventScroll: true });
    }
    page.closePopup = fechar;

    openers.forEach((b) => page.on(b, 'click', abrir));
    $$('[data-popup-close]', c).forEach((b) => page.on(b, 'click', fechar));

    // Esc fecha; Tab fica preso dentro do popup (+ botão Fechar do CTA)
    page.on(document, 'keydown', (e) => {
      if (!state.popupOpen || state.successOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      const focaveis = [fecharBtn, ...$$('a[href], button:not([disabled]), input:not([type="hidden"]):not([tabindex="-1"]), select, textarea', modal)]
        .filter((el) => el.offsetParent !== null || el === fecharBtn);
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      else if (!popup.contains(document.activeElement) && document.activeElement !== fecharBtn) { e.preventDefault(); primeiro.focus(); }
    });

    // Se a janela mudar de tamanho com o popup aberto, reposiciona o CTA
    page.on(window, 'resize', debounce(() => { if (state.popupOpen) gsap.set(cta, { y: ctaY() }); }, 100));
    page.add(() => { if (state.popupOpen) { state.popupOpen = false; } });
  }

  // =========================================================
  // 14. TELA DE SUCESSO (entra de baixo, sai caindo girando)
  // =========================================================
  function initSuccess(page) {
    const s = $('[data-success]', page.container);
    if (!s) return;
    const card = $('[data-success-card]', s);
    const texto = $('[data-success-text]', s);
    const btn = $('[data-success-close]', s);
    let voltarFoco = null;

    page.showSuccess = (nome) => {
      texto.textContent = msg().success(nome);
      state.successOpen = true;
      voltarFoco = document.activeElement;
      s.classList.add('is-open');
      s.setAttribute('aria-hidden', 'false');
      lock(true);
      gsap.fromTo(s, { backgroundColor: 'rgba(0,0,0,0)' }, { backgroundColor: 'rgba(0,0,0,.35)', duration: 0.6 });
      gsap.fromTo(card, { y: window.innerHeight * 1.1, rotate: -8 }, { y: 0, rotate: 0, duration: reduce ? 0 : 1.1, ease: 'power4.out' });
      gsap.fromTo($('.success_icon', card), { scale: 0 }, { scale: 1, duration: reduce ? 0 : 0.9, delay: 0.35, ease: 'elastic.out(1, 0.5)' });
      setTimeout(() => btn.focus({ preventScroll: true }), 400);
    };

    const fechar = () => {
      if (!state.successOpen) return;
      state.successOpen = false;
      gsap.to(s, { backgroundColor: 'rgba(0,0,0,0)', duration: 0.6 });
      gsap.to(card, {
        y: window.innerHeight * 1.1,
        rotate: 25,
        duration: reduce ? 0 : 0.9,
        ease: 'power2.in',
        onComplete: () => {
          s.classList.remove('is-open');
          s.setAttribute('aria-hidden', 'true');
          gsap.set(card, { clearProps: 'transform' });
        },
      });
      if (state.popupOpen && page.closePopup) page.closePopup();
      else {
        lock(false);
        if (voltarFoco && voltarFoco.isConnected) voltarFoco.focus({ preventScroll: true });
      }
    };

    page.on(btn, 'click', fechar);
    page.on(s, 'click', (e) => { if (e.target === s) fechar(); });
    page.on(document, 'keydown', (e) => { if (e.key === 'Escape' && state.successOpen) fechar(); });
    page.add(() => { state.successOpen = false; });
  }

  // =========================================================
  // 15. FORMULÁRIOS: validação, máscara, honeypot e envio via fetch
  // =========================================================
  function initForms(page) {
    $$('[data-form]', page.container).forEach((form) => setupForm(page, form));
  }

  function setupForm(page, form) {
    const alerta = $('[data-form-error]', form);
    const submit = $('[data-submit]', form);
    const rotulo = $('[data-submit-label]', submit);
    const pais = $('[data-country]', form);
    const tel = $('[data-phone]', form);
    const dialLabel = $('[data-dial-label]', form);
    const soDigitos = (v) => v.replace(/\D/g, '');
    const dial = () => (pais ? pais.selectedOptions[0]?.dataset.dial ?? '' : null); // null = sem seletor de país

    // ----- Máscaras -----
    const maskBR = (n) => {
      if (!n) return '';
      if (n.length <= 2) return `(${n}`;
      const ddd = n.slice(0, 2), resto = n.slice(2);
      if (resto.length <= 4) return `(${ddd}) ${resto}`;
      const corte = resto.length > 8 ? 5 : 4;
      return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
    };
    const maskUS = (n) => {
      if (!n) return '';
      if (n.length <= 3) return `(${n}`;
      if (n.length <= 6) return `(${n.slice(0, 3)}) ${n.slice(3)}`;
      return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
    };
    const agrupar = (n) => n.replace(/(\d{3})(?=\d)/g, '$1 ');
    const mascarar = (v, digitos = soDigitos(v)) => {
      const d = dial();
      const internacional = v.trim().startsWith('+');
      if (d === null) return internacional ? `+${agrupar(digitos.slice(0, 15))}` : maskBR(digitos.slice(0, 11));
      if (d === '55') return maskBR(digitos.slice(0, 11));
      if (d === '1') return maskUS(digitos.slice(0, 10));
      if (d === '') return (internacional ? '+' : '') + agrupar(digitos.slice(0, 15));
      return agrupar(digitos.slice(0, 12));
    };
    const EXEMPLOS = { 55: '(11) 91234-5678', 1: '(555) 123-4567', 351: '912 345 678', '': '+00 000 000 000' };

    const atualizarDDI = () => {
      if (!pais || !tel) return;
      const d = dial();
      dialLabel.textContent = d ? `+${d}` : '';
      tel.closest('.g-tel').classList.toggle('no-dial', !d);
      tel.placeholder = EXEMPLOS[d] ?? '123 456 789';
      tel.value = mascarar(tel.value);
    };

    if (tel) {
      let anteriores = '';
      page.on(tel, 'input', (e) => {
        let digitos = soDigitos(tel.value);
        // apagou só um caractere de formatação? apaga também o dígito anterior
        if (e.inputType && e.inputType.startsWith('delete') && digitos === anteriores) digitos = digitos.slice(0, -1);
        tel.value = mascarar(tel.value, digitos);
        anteriores = soDigitos(tel.value);
      });
    }
    if (pais) page.on(pais, 'change', () => { atualizarDDI(); const f = tel?.closest('[data-field]'); if (f?.classList.contains('is-invalid')) validar(f); });
    atualizarDDI();

    // ----- Regras: cada uma devolve '' (ok) ou a mensagem de erro -----
    const regras = {
      name: (f) => { const v = $('input', f).value.trim(); return !v ? msg().required : v.length < 2 ? msg().name : ''; },
      email: (f) => { const v = $('input', f).value.trim(); return !v ? msg().required : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : msg().email; },
      tel: (f) => {
        const el = $('input', f);
        const n = soDigitos(el.value).length;
        if (!n) return msg().required;
        const d = dial();
        const br = d === '55' || (d === null && !el.value.trim().startsWith('+'));
        const [min, max] = br ? [10, 11] : d === '1' ? [10, 10] : [7, 15];
        return n < min || n > max ? msg().tel : '';
      },
      select: (f) => ($('select', f).value ? '' : msg().select),
      group: (f) => ($$('input:checked', f).length ? '' : msg().group),
      consent: (f) => ($('input[type="checkbox"]', f).checked ? '' : msg().consent),
      message: (f) => { const v = $('textarea', f).value.trim(); return !v ? msg().required : v.length < 10 ? msg().message : ''; },
    };
    const campos = $$('[data-field]', form).filter((f) => regras[f.dataset.field]);

    function validar(f) {
      const erro = regras[f.dataset.field](f);
      const saida = $('.field_error', f);
      if (saida) saida.textContent = erro;
      const alvos = f.matches('fieldset') ? [f] : $$('input:not([type="hidden"]), select, textarea', f);
      alvos.forEach((el) => el.setAttribute('aria-invalid', erro ? 'true' : 'false'));
      f.classList.toggle('is-invalid', !!erro);
      return erro;
    }
    const limpar = () => campos.forEach((f) => {
      f.classList.remove('is-invalid');
      $$('[aria-invalid]', f).forEach((el) => el.removeAttribute('aria-invalid'));
      f.removeAttribute('aria-invalid');
      const s = $('.field_error', f); if (s) s.textContent = '';
    });

    // Valida ao sair do campo; depois do 1º erro, valida a cada digitação
    page.on(form, 'focusout', (e) => {
      const f = e.target.closest('[data-field]');
      if (!f || !regras[f.dataset.field] || !e.target.matches('input[type="text"], input[type="email"], input[type="tel"], select, textarea')) return;
      if (e.target.value.trim() || f.classList.contains('is-invalid')) validar(f);
    });
    const revalidar = (e) => { const f = e.target.closest('[data-field]'); if (f && f.classList.contains('is-invalid')) validar(f); };
    page.on(form, 'input', revalidar);
    page.on(form, 'change', revalidar);

    const setCarregando = (on) => {
      form.classList.toggle('is-loading', on);
      submit.classList.toggle('is-loading', on);
      submit.disabled = on;
      submit.setAttribute('aria-busy', on ? 'true' : 'false');
      rotulo.textContent = on ? msg().sending : state.lang === 'en' && EN[rotulo.dataset.i18n] ? EN[rotulo.dataset.i18n] : rotulo.__pt || rotulo.textContent;
    };

    async function enviar() {
      const dados = new FormData(form);
      dados.set('idioma', state.lang);
      dados.set('pagina', location.href);
      dados.set('_subject', 'Novo contato pelo site Aurora');
      if (pais && tel) dados.set('telefone', `${dial() ? `+${dial()} ` : ''}${tel.value}`);

      if (!CONFIG.formEndpoint) {
        // MODO DEMONSTRAÇÃO: nada sai do navegador.
        await wait(1400);
        const resumo = {};
        for (const [k, v] of dados.entries()) resumo[k] = resumo[k] ? `${resumo[k]}, ${v}` : v;
        console.info('%c[Aurora] Modo demonstração: configure CONFIG.formEndpoint no main.js para enviar de verdade.', 'color:#2BB9A3;font-weight:bold', resumo);
        // Digite "erro" no nome para ver o estado de erro
        return !/^(erro|error)$/i.test(String(dados.get('nome') || '').trim());
      }
      const r = await fetch(CONFIG.formEndpoint, { method: 'POST', body: dados, headers: { Accept: 'application/json' } });
      return r.ok;
    }

    page.on(form, 'submit', async (e) => {
      e.preventDefault();
      if (form.classList.contains('is-loading')) return;
      alerta.hidden = true;

      const erros = campos.filter((f) => validar(f));
      if (erros.length) {
        alerta.textContent = msg().summary(erros.length);
        alerta.hidden = false;
        if (libsOk) gsap.fromTo(alerta, { y: -6, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
        const alvo = $('input:not([type="hidden"]):not([tabindex="-1"]), select, textarea', erros[0]);
        alvo?.focus();
        return;
      }

      const nome = String(form.elements.nome?.value || '').trim().split(/\s+/)[0];
      const robo = form.elements._gotcha && form.elements._gotcha.value;
      setCarregando(true);
      let ok = false;
      try {
        if (robo) { await wait(800); ok = true; }   // honeypot preenchido: finge sucesso e não envia
        else ok = await enviar();
      } catch (err) {
        ok = false;
      }
      setCarregando(false);

      if (ok) {
        form.reset();
        limpar();
        atualizarDDI();
        if (page.showSuccess) page.showSuccess(nome);
        else { alerta.textContent = msg().success(nome); alerta.hidden = false; alerta.style.background = 'var(--success)'; }
      } else {
        alerta.textContent = msg().error;
        alerta.hidden = false;
        alerta.style.background = '';
        if (libsOk) gsap.fromTo(alerta, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
        alerta.focus?.();
      }
    });
  }

  // =========================================================
  // 16. ACORDEÃO DE SERVIÇOS (um item sempre aberto)
  //     Todos os painéis abertos têm a MESMA altura: assim a altura total
  //     da seção não muda e o parallax do about continua exato.
  // =========================================================
  function initAccordion(page) {
    const acc = $('[data-accordion]', page.container);
    if (!acc) return;
    const itens = $$('[data-acc-item]', acc);
    const btns = itens.map((i) => $('[data-acc-btn]', i));
    const paineis = itens.map((i) => $('[data-acc-panel]', i));
    const mais = itens.map((i) => $('[data-acc-plus-v]', i));
    const imgs = $$('[data-acc-img]', page.container);
    if (!libsOk) { paineis.forEach((p) => (p.hidden = false)); return; }

    let ativo = Math.max(0, itens.findIndex((i) => i.classList.contains('is-open')));
    let alturaMax = 0;
    let z = 2;

    const medir = () => {
      alturaMax = 0;
      paineis.forEach((p) => {
        const estava = p.hidden;
        p.hidden = false;
        alturaMax = Math.max(alturaMax, p.firstElementChild.offsetHeight);
        p.hidden = estava;
      });
      paineis.forEach((p, i) => gsap.set(p, { height: i === ativo ? alturaMax : 0 }));
    };
    medir();
    ScrollTrigger.addEventListener('refreshInit', medir);
    page.add(() => ScrollTrigger.removeEventListener('refreshInit', medir));

    mais.forEach((m, i) => gsap.set(m, { rotate: i === ativo ? 180 : 90 }));
    imgs.forEach((im, i) => im.classList.toggle('is-active', i === ativo));

    const abrir = (i) => {
      if (i === ativo) return;
      const ant = ativo;
      ativo = i;
      const d = reduce ? 0 : 0.9;
      itens[ant].classList.remove('is-open');
      itens[i].classList.add('is-open');
      btns[ant].setAttribute('aria-expanded', 'false');
      btns[i].setAttribute('aria-expanded', 'true');
      paineis[i].hidden = false;
      gsap.to(paineis[i], { height: alturaMax, duration: d, ease: 'power3.inOut', overwrite: true });
      gsap.to(paineis[ant], { height: 0, duration: d, ease: 'power3.inOut', overwrite: true, onComplete: () => { if (ativo !== ant) paineis[ant].hidden = true; } });
      gsap.to(mais[i], { rotate: 180, duration: 0.6, ease: 'power2.inOut' });   // o "+" gira e vira "−"
      gsap.to(mais[ant], { rotate: 90, duration: 0.6, ease: 'power2.inOut' });

      // Imagem nova entra de baixo (yPercent 100 → 0) com scale 2 → 1
      const nova = imgs[i];
      if (nova) {
        nova.classList.add('is-active');
        nova.style.zIndex = ++z;
        gsap.fromTo(nova, { yPercent: 100, scale: 2 }, {
          yPercent: 0, scale: 1, duration: reduce ? 0 : 1.2, ease: 'power4.out', overwrite: true,
          onComplete: () => imgs.forEach((im, k) => { if (k !== ativo) im.classList.remove('is-active'); }),
        });
      }
    };
    btns.forEach((b, i) => page.on(b, 'click', () => abrir(i)));
  }

  // =========================================================
  // 17. RELÓGIOS (Intl.DateTimeFormat, HH:MM 24h, fuso configurável)
  // =========================================================
  const formatos = {};
  function horaEm(tz) {
    try {
      formatos[tz] = formatos[tz] || new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
      return formatos[tz].format(new Date());
    } catch (e) {
      return new Date().toTimeString().slice(0, 5);
    }
  }
  function gmtDe(tz) {
    try {
      const parte = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName');
      return parte ? parte.value : '';
    } catch (e) {
      return '';
    }
  }
  function initClock(page) {
    const tick = () => $$('[data-clock]').forEach((el) => {
      const h = horaEm(el.dataset.timezone || CONFIG.hq.tz);
      if (el.textContent !== h) el.textContent = h;
    });
    tick();
    const id = setInterval(tick, 1000);
    page.add(() => clearInterval(id));
  }

  // =========================================================
  // 18. OPERANDO NO MUNDO: rotador de cidades + globo pontilhado
  // =========================================================
  function createGlobe(page, canvas) {
    const ctx = canvas.getContext('2d');
    const RAD = Math.PI / 180;
    const bytes = Uint8Array.from(atob(LAND_MASK), (ch) => ch.charCodeAt(0));
    const ehTerra = (lat, lon) => {
      const col = clamp(0, 179, Math.floor((lon + 180) / 2));
      const lin = clamp(0, 89, Math.floor((90 - lat) / 2));
      const i = lin * 180 + col;
      return (bytes[i >> 3] >> (i & 7)) & 1;
    };

    // Pontos distribuídos por igual na esfera, só onde há continente
    const pontos = [];
    const passo = 2.2;
    for (let lat = -84; lat <= 84; lat += passo) {
      const n = Math.max(1, Math.round((360 * Math.cos(lat * RAD)) / passo));
      for (let k = 0; k < n; k++) {
        const lon = -180 + ((k + 0.5) * 360) / n;
        if (ehTerra(lat, lon)) pontos.push([Math.sin(lat * RAD), Math.cos(lat * RAD), lon * RAD]);
      }
    }
    const marcadores = [CONFIG.hq, ...CITIES].map((c) => ({ c, s: Math.sin(c.lat * RAD), co: Math.cos(c.lat * RAD), lon: c.lon * RAD }));

    const g = { rot: CONFIG.hq.lon * RAD, tilt: CONFIG.hq.lat * RAD * 0.6, ativa: CONFIG.hq, mexeuAte: 0 };
    let w = 0, h = 0, dpr = 1;

    const redimensionar = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      desenhar(performance.now());
    };

    const projetar = (sinLat, cosLat, lon) => {
      const dl = lon - g.rot;
      const x = cosLat * Math.sin(dl);
      const z0 = cosLat * Math.cos(dl);
      const ct = Math.cos(g.tilt), st = Math.sin(g.tilt);
      return [x, sinLat * ct - z0 * st, sinLat * st + z0 * ct];
    };

    function desenhar(t) {
      if (!w) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * 0.44, cx = w / 2, cy = h / 2;

      // halo da atmosfera + esfera de vidro
      const halo = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.2);
      halo.addColorStop(0, 'rgba(170,210,255,.28)');
      halo.addColorStop(1, 'rgba(170,210,255,0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.2, 0, Math.PI * 2); ctx.fill();
      const esfera = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      esfera.addColorStop(0, 'rgba(255,255,255,.16)');
      esfera.addColorStop(1, 'rgba(0,25,70,.32)');
      ctx.fillStyle = esfera;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // continentes
      const tam = Math.max(1, R / 170);
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < pontos.length; i++) {
        const p = pontos[i];
        const [x, y, z] = projetar(p[0], p[1], p[2]);
        if (z < 0) continue;
        ctx.globalAlpha = 0.2 + z * 0.75;
        const s = tam * (0.6 + z * 0.5);
        ctx.fillRect(cx + x * R - s / 2, cy - y * R - s / 2, s, s);
      }
      ctx.globalAlpha = 1;

      // cidades
      ctx.font = `600 ${Math.max(11, R / 18)}px Inter, system-ui, sans-serif`;
      for (const m of marcadores) {
        const [x, y, z] = projetar(m.s, m.co, m.lon);
        if (z < 0.05) continue;
        const px = cx + x * R, py = cy - y * R;
        if (m.c === g.ativa) {
          const fase = reduce ? 0.5 : (t % 1600) / 1600;
          ctx.strokeStyle = `rgba(43,185,163,${1 - fase})`;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(px, py, 4 + fase * R * 0.09, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = '#2BB9A3';
          ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(m.c[state.lang], px + 10, py - 8);
        } else {
          ctx.globalAlpha = 0.5 + z * 0.5;
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(px, py, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // Só desenha quando está na tela
    const tick = () => desenhar(performance.now());
    let ligado = false;
    page.observe(canvas, ([e]) => {
      if (e.isIntersecting && !ligado) { ligado = true; gsap.ticker.add(tick); }
      else if (!e.isIntersecting && ligado) { ligado = false; gsap.ticker.remove(tick); }
    });
    page.add(() => gsap.ticker.remove(tick));
    const ro = new ResizeObserver(redimensionar);
    ro.observe(canvas);
    page.add(() => ro.disconnect());

    // Arrastar para girar (com inércia)
    let arrastando = false, ultimoX = 0, ultimoY = 0, vx = 0;
    page.on(canvas, 'pointerdown', (e) => {
      arrastando = true;
      ultimoX = e.clientX; ultimoY = e.clientY; vx = 0;
      canvas.setPointerCapture(e.pointerId);
      gsap.killTweensOf(g);
    });
    page.on(canvas, 'pointermove', (e) => {
      if (!arrastando) return;
      const dx = e.clientX - ultimoX, dy = e.clientY - ultimoY;
      ultimoX = e.clientX; ultimoY = e.clientY;
      vx = dx;
      g.rot -= dx * 0.006;
      g.tilt = clamp(-1.1, 1.1, g.tilt + dy * 0.004);
      g.mexeuAte = performance.now() + 5000;   // não "puxa" de volta para a cidade enquanto o usuário brinca
    });
    const soltar = () => {
      if (!arrastando) return;
      arrastando = false;
      gsap.to(g, { rot: g.rot - vx * 0.06, duration: 1.4, ease: 'power3.out' });
    };
    page.on(canvas, 'pointerup', soltar);
    page.on(canvas, 'pointercancel', soltar);

    return {
      focus(cidade, instantaneo) {
        g.ativa = cidade;
        if (arrastando || performance.now() < g.mexeuAte) return;
        const alvo = cidade.lon * RAD;
        const diff = ((((alvo - g.rot + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
        gsap.to(g, { rot: g.rot + diff, tilt: cidade.lat * RAD * 0.6, duration: instantaneo || reduce ? 0 : 1.6, ease: 'power3.inOut', overwrite: true });
      },
      redesenhar: tick,
    };
  }

  function initWorld(page) {
    const c = page.container;
    const nome = $('[data-city-name]', c);
    if (!nome) return;
    const relogio = $('[data-city-clock]', c);
    const gmt = $('[data-city-gmt]', c);
    const canvas = $('[data-globe]', c);
    const globo = canvas && libsOk ? createGlobe(page, canvas) : null;
    const lista = [CONFIG.hq, ...CITIES];
    let i = 0;

    const mostrar = (cidade, animar) => {
      const trocar = () => {
        nome.textContent = cidade[state.lang];
        relogio.dataset.timezone = cidade.tz;
        relogio.textContent = horaEm(cidade.tz);
        gmt.textContent = gmtDe(cidade.tz);
      };
      globo?.focus(cidade, !animar);
      if (!animar || reduce || !libsOk) return trocar();
      gsap.timeline()
        .to(nome, { yPercent: -35, opacity: 0, filter: 'blur(12px)', duration: 0.45, ease: 'power2.in' })
        .add(trocar)
        .fromTo(nome, { yPercent: 35, opacity: 0, filter: 'blur(12px)' }, { yPercent: 0, opacity: 1, filter: 'blur(0px)', duration: 0.7, ease: 'power2.out', clearProps: 'filter' });
    };
    mostrar(lista[0], false);

    // Só gira enquanto a seção está visível
    let id = null;
    const iniciar = () => { if (!id) id = setInterval(() => { i = (i + 1) % lista.length; mostrar(lista[i], true); }, CONFIG.cityInterval); };
    const parar = () => { clearInterval(id); id = null; };
    page.observe(nome.closest('.world') || nome, ([e]) => (e.isIntersecting ? iniciar() : parar()), { rootMargin: '10% 0px' });
    page.add(parar);
  }

  // =========================================================
  // 19. PARTÍCULAS (particles.js), pausadas fora da tela
  // =========================================================
  function initParticles(page) {
    if (reduce || typeof window.particlesJS === 'undefined') return;
    const comum = {
      interactivity: { detect_on: 'canvas', events: { onhover: { enable: false }, onclick: { enable: false }, resize: true } },
      retina_detect: true,
    };
    const CONFIGS = {
      // Estrelas sobre a Terra (piscando devagar)
      hero: {
        particles: {
          number: { value: 90, density: { enable: false } },
          color: { value: '#ffffff' },
          shape: { type: 'circle' },
          opacity: { value: 0.8, random: true, anim: { enable: true, speed: 0.6, opacity_min: 0.1, sync: false } },
          size: { value: 1.4, random: true },
          line_linked: { enable: false },
          move: { enable: true, speed: 0.15, direction: 'none', random: true, straight: false, out_mode: 'out' },
        },
      },
      // Poeira sobre as nuvens: exatamente a especificação (120, 3 cores, 2.5, .6, .375)
      about: {
        particles: {
          number: { value: 120, density: { enable: false } },
          color: { value: ['#ffffff', '#aaccff', '#ddeeff'] },
          shape: { type: 'circle' },
          opacity: { value: 0.6, random: false },
          size: { value: 2.5, random: true },
          line_linked: { enable: false },
          move: { enable: true, speed: 0.375, direction: 'none', random: false, straight: false, out_mode: 'out' },
        },
      },
    };

    const instancias = [];
    $$('[data-particles]', page.container).forEach((el) => {
      const cfg = CONFIGS[el.dataset.particles];
      if (!cfg || !el.id) return;
      if (!Array.isArray(window.pJSDom)) window.pJSDom = [];
      particlesJS(el.id, { ...cfg, ...comum });
      const inst = window.pJSDom[window.pJSDom.length - 1];
      if (!inst) return;
      instancias.push(inst);
      const pjs = inst.pJS;
      let rodando = true;
      page.observe(el.parentElement, ([e]) => {
        if (e.isIntersecting && !rodando) { rodando = true; pjs.fn.vendors.draw(); }
        else if (!e.isIntersecting && rodando) { rodando = false; cancelAnimationFrame(pjs.fn.drawAnimFrame); }
      });
    });

    page.add(() => {
      instancias.forEach((inst) => {
        try { cancelAnimationFrame(inst.pJS.fn.drawAnimFrame); inst.pJS.fn.vendors.destroypJS(); } catch (e) { /* já destruído */ }
      });
      window.pJSDom = [];   // o destroypJS da lib zera a variável global; recriamos
    });
  }

  // =========================================================
  // 20. MENU MOBILE
  // =========================================================
  function initMenu(page) {
    const c = page.container;
    const btn = $('[data-menu-toggle]', c);
    const menu = $('[data-menu]', c);
    if (!btn || !menu) return;
    const links = $$('[data-menu-link]', menu);
    const sr = $('.sr-only', btn);

    const abrir = () => {
      state.menuOpen = true;
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      sr.textContent = msg().closeMenu;
      page.setTema?.('color');
      lock(true);
      if (libsOk && !reduce) {
        gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.4 });
        gsap.fromTo(links, { filter: 'blur(20px)', opacity: 0, y: 20 }, { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.8, stagger: 0.06, ease: 'power2.out', clearProps: 'filter' });
      }
    };
    const fechar = (depois) => {
      if (!state.menuOpen) return;
      state.menuOpen = false;
      btn.setAttribute('aria-expanded', 'false');
      sr.textContent = msg().openMenu;
      lock(false);
      if (page.temaAtual) page.setTema?.(page.temaAtual);
      const fim = () => { menu.hidden = true; if (typeof depois === 'function') depois(); };
      if (libsOk && !reduce) gsap.to(menu, { opacity: 0, duration: 0.3, onComplete: fim });
      else fim();
    };
    page.closeMenu = fechar;
    page.on(btn, 'click', () => (state.menuOpen ? fechar() : abrir()));
    page.on(document, 'keydown', (e) => { if (e.key === 'Escape' && state.menuOpen) { fechar(); btn.focus(); } });
    page.on(window, 'resize', debounce(() => { if (isDesktop()) fechar(); }, 150));
    page.add(() => {
      if (!state.menuOpen) return;
      state.menuOpen = false;
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  // =========================================================
  // 21. LINKS INTERNOS (âncoras com Lenis) e navegação
  // =========================================================
  function goTo(href) {
    if (state.barba && window.barba) window.barba.go(href);
    else window.location.href = href;
  }

  function initLinks(page) {
    page.on(document, 'click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
      const alvo = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!alvo) return;
      e.preventDefault();
      const ir = () => { scrollToEl(alvo); history.replaceState(null, '', url.hash); };
      if (state.menuOpen && page.closeMenu) page.closeMenu(ir);
      else ir();
    });
  }

  // =========================================================
  // 22. COOKIES (LGPD): analytics só depois do aceite
  // =========================================================
  function carregarAnalytics() {
    if (window.__auroraAnalytics) return;
    window.__auroraAnalytics = true;
    if (!CONFIG.gaId) {
      console.info('[Aurora] Cookies aceitos. Defina CONFIG.gaId no main.js para ativar o Google Analytics.');
      return;
    }
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(CONFIG.gaId)}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CONFIG.gaId, { anonymize_ip: true });
  }

  // =========================================================
  // 22b. MOVIMENTO: respeita "reduzir movimento" do sistema, mas deixa a pessoa escolher
  //      (muita gente desliga as animações do Windows sem saber que isso afeta sites)
  // =========================================================
  function trocarMovimento(ligar) {
    storage.set('aurora-motion', ligar ? 'on' : 'off');
    window.location.reload();
  }

  function initMotionNote() {
    const aviso = state.lang === 'en'
      ? { t: 'Animations are reduced', p: 'Your system asks for less motion, so the journey is static. Want to see the full experience?', on: 'Turn on animations', keep: 'Keep it off' }
      : { t: 'Animações reduzidas', p: 'Seu sistema pede menos movimento, então a jornada está estática. Quer ver a experiência completa?', on: 'Ativar animações', keep: 'Manter assim' };
    if (!sistemaPedeMenos || storage.get('aurora-motion') || $('.motion-note')) return;
    const el = document.createElement('div');
    el.className = 'cookie motion-note';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', aviso.t);
    el.innerHTML = `<p class="cookie_title t6">${aviso.t}</p><p class="cookie_p p7">${aviso.p}</p>
      <div class="cookie_btns"><button type="button" class="cookie_btn" data-m="keep">${aviso.keep}</button><button type="button" class="cookie_btn is-accept" data-m="on">${aviso.on}</button></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      if (b.dataset.m === 'on') trocarMovimento(true);
      else { storage.set('aurora-motion', 'off'); el.remove(); }
    });
  }

  function initCookies() {
    const el = $('[data-cookie]');
    // botão "Animações" do rodapé
    document.addEventListener('click', (e) => { if (e.target.closest('[data-motion-toggle]')) trocarMovimento(reduce); });
    if (!el) { initMotionNote(); return; }
    const escolha = storage.get('aurora-cookies');
    if (escolha === 'accept') carregarAnalytics();
    if (escolha) setTimeout(initMotionNote, 1200);

    const mostrar = () => {
      el.hidden = false;
      if (libsOk && !reduce) gsap.fromTo(el, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' });
    };
    const esconder = () => {
      const fim = () => { el.hidden = true; };
      if (libsOk && !reduce) gsap.to(el, { y: 30, opacity: 0, duration: 0.4, onComplete: fim });
      else fim();
    };
    if (!escolha) setTimeout(mostrar, state.firstLoad && !reduce ? 3600 : 800);

    $$('[data-cookie-choice]', el).forEach((b) => b.addEventListener('click', () => {
      storage.set('aurora-cookies', b.dataset.cookieChoice);
      esconder();
      setTimeout(initMotionNote, 600);
      if (b.dataset.cookieChoice === 'accept') carregarAnalytics();
    }));
    // botão "Cookies" do rodapé / página de privacidade reabre o banner
    document.addEventListener('click', (e) => { if (e.target.closest('[data-cookie-open]')) mostrar(); });
  }

  // =========================================================
  // 23. BARBA.JS (transições entre páginas)
  // =========================================================
  function atualizarHead(next) {
    const doc = new DOMParser().parseFromString(next.html, 'text/html');
    state.ptMeta = { title: doc.title, desc: doc.querySelector('meta[name="description"]')?.content || '' };
    state.namespace = next.namespace || 'home';
    const canon = doc.querySelector('link[rel="canonical"]');
    const atual = $('link[rel="canonical"]');
    if (canon && atual) atual.href = canon.href;
  }

  function initBarba() {
    // Barba precisa de um servidor (fetch das páginas); abrindo o arquivo direto, navega normal
    if (!window.barba || !libsOk || location.protocol === 'file:') return false;
    window.barba.init({
      preventRunning: true,
      prevent: ({ el, href }) => {
        if (el.hasAttribute('data-no-barba') || el.target === '_blank') return true;
        try {
          const u = new URL(href, location.href);
          return u.pathname === location.pathname && !!u.hash;   // âncora na mesma página: Lenis cuida
        } catch (e) { return true; }
      },
      transitions: [{
        name: 'fade',
        leave: ({ current }) => gsap.to(current.container, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }).then(() => destroyPage(state.page)),
        beforeEnter: ({ next }) => {
          ScrollTrigger.getAll().forEach((t) => t.kill());
          window.scrollTo(0, 0);
          atualizarHead(next);
          init(next.container);
        },
        enter: ({ next }) => gsap.fromTo(next.container, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power2.inOut' }),
        after: ({ trigger }) => {
          ScrollTrigger.refresh();
          // o hash vem do link clicado (alguns servidores redirecionam index.html → / e perdem o #)
          let hash = location.hash;
          try { if (trigger && trigger.href) hash = new URL(trigger.href, location.href).hash || hash; } catch (e) { /* ok */ }
          if (hash && !location.hash) history.replaceState(null, '', hash);
          const alvo = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
          if (alvo) setTimeout(() => scrollToEl(alvo), 200);
        },
      }],
    });
    return true;
  }

  // =========================================================
  // 24. INIT (initScripts) e BOOT
  // =========================================================
  function init(container) {
    const page = createPage(container);
    state.page = page;
    I18N.capture(document.body);
    I18N.apply(document.body, state.lang);

    if (!libsOk) {
      // Sem GSAP: o site continua legível e o formulário funciona
      $('[data-preloader]', container)?.remove();
      [initClock, initForms, initAccordion, initWorld, initMenu, initLinks].forEach((fn) => fn(page));
      return page;
    }

    page.ctx.add(() => {
      initLenis(page);
      initAccordion(page);        // antes do about: mede a altura fixa dos painéis
      initAboutParallax(page);
      initHero(page);
      initTheme(page);
      initReveals(page);
      initHighlight(page);
      initParallax(page);
      initHovers(page);
      initMagnetic(page);
      initPopup(page);
      initSuccess(page);
      initForms(page);
      initWorld(page);
      initClock(page);
      initParticles(page);
      initMenu(page);
      initLinks(page);
    });

    // Resize com debounce de 100ms
    page.on(window, 'resize', debounce(() => ScrollTrigger.refresh(true), 100));

    const primeiraCarga = state.firstLoad;
    initPreloader(page, () => {
      page.intro?.play();
      // chegou com #ancora na URL (ex.: vindo de outra página sem Barba)
      if (primeiraCarga && location.hash) {
        const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (alvo) setTimeout(() => scrollToEl(alvo), 300);
      }
    });
    ScrollTrigger.refresh();
    return page;
  }

  function boot() {
    if (!libsOk) root.classList.remove('js');
    else {
      gsap.registerPlugin(ScrollTrigger);
      ScrollTrigger.config({ ignoreMobileResize: true });
    }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

    const container = $('[data-barba="container"]');
    if (!container) return;
    init(container);
    initCookies();
    state.firstLoad = false;
    state.barba = initBarba();

    // Troca de idioma (delegado: o header é recriado a cada página)
    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-lang-toggle]')) setLang(state.lang === 'pt' ? 'en' : 'pt');
    });
    document.fonts?.ready.then(() => { if (libsOk) ScrollTrigger.refresh(); });
  }

  boot();
})();
