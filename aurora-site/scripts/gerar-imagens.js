/* =========================================================
   gerar-imagens.js
   Gera TODAS as imagens de assets/images a partir de fotos da NASA
   (domínio público: https://www.nasa.gov/nasa-brand-center/images-and-media/).

   Uso:  npm run imagens      (precisa do "sharp", instalado como devDependency)

   O que ele faz:
   1. Baixa os originais da NASA para scripts/.cache (só na primeira vez).
   2. Recorta e comprime: space-earth (WebP), sky-about (AVIF + WebP), serviços.
   3. DESENHA a janela da cúpula (inspirada na Cupola da ISS: 6 janelas
      trapezoidais + 1 central) em SVG e exporta como WebP com transparência.
      Os vidros ficam 100% transparentes, então o céu aparece por trás.
   4. Cria noise.png, og-image.jpg e a máscara de continentes do globo.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const RAIZ = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '.cache');
const SAIDA = path.join(RAIZ, 'assets', 'images');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(path.join(SAIDA, 'services'), { recursive: true });

// ---------- Fotos da NASA usadas (id da NASA → uso) ----------
const NASA = 'https://images-assets.nasa.gov/image';
const FONTES = {
  terra: { url: `${NASA}/sts080-759-038/sts080-759-038~orig.jpg`, credito: 'STS-80, Space Shuttle Columbia (1996): a Lua sobre o limbo da Terra' },
  nuvens: { url: `${NASA}/s62-06613/s62-06613~orig.jpg`, credito: 'Mercury-Atlas 6 (1962): cúmulos sobre o Atlântico' },
  lancamento: { url: `${NASA}/NHQ202211160200/NHQ202211160200~large.jpg`, credito: 'Lançamento da Artemis I (2022), NASA/Joel Kowsky' },
  nebulosa: { url: `${NASA}/carina_nebula/carina_nebula~large.jpg`, credito: 'James Webb: "Penhascos Cósmicos" na Nebulosa de Carina' },
  caminhada: { url: `${NASA}/iss061e058522/iss061e058522~large.jpg`, credito: 'Caminhada espacial, Expedição 61 (ISS)' },
  aurora: { url: `${NASA}/iss046e015599/iss046e015599~large.jpg`, credito: 'Aurora vista da ISS, Expedição 46' },
  capacete: { url: `${NASA}/iss038e020313/iss038e020313~large.jpg`, credito: 'Reflexo no capacete, EVA 25 (ISS)' },
  mapa: { url: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_shallow_topo_2048.jpg', credito: 'Blue Marble, NASA Visible Earth' },
};

async function baixar(nome) {
  const arquivo = path.join(CACHE, `${nome}.jpg`);
  if (fs.existsSync(arquivo)) return arquivo;
  console.log('baixando', nome, '...');
  const r = await fetch(FONTES[nome].url);
  if (!r.ok) throw new Error(`Falha ao baixar ${nome}: ${r.status}`);
  fs.writeFileSync(arquivo, Buffer.from(await r.arrayBuffer()));
  return arquivo;
}

const salvar = (nome) => path.join(SAIDA, nome);
const tamanho = (arq) => `${(fs.statSync(arq).size / 1024).toFixed(0)} KB`;

// =========================================================
// JANELA DA CÚPULA (SVG → WebP com alfa)
// Tudo é desenhado num sistema de "unidades" centrado em (0,0),
// onde o raio externo do flange é 520 unidades.
// =========================================================
function svgJanela(W, H, escala, cy = H / 2) {
  const cx = W / 2;
  const u = (n) => (n * escala).toFixed(2);

  // Trapézio de UMA janela lateral (aponta para cima). As outras 5 são rotações de 60°.
  const R_CENTRAL = 165;
  const INT = 210, EXT = 410; // distância do centro até a borda interna / externa
  const trap = `${-INT * 0.46},${-INT} ${INT * 0.46},${-INT} ${EXT * 0.46},${-EXT} ${-EXT * 0.46},${-EXT}`;
  const seis = (conteudo) => [0, 60, 120, 180, 240, 300].map((a) => `<g transform="rotate(${a})">${conteudo}</g>`).join('');

  // Parafusos em círculo
  const parafusos = (n, r, raio, off = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((i + off) / n) * Math.PI * 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${raio}" fill="url(#parafuso)"/>`;
    }).join('');

  // Emendas da parede (linhas radiais fora do flange, como uma escotilha)
  const emendas = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * 360 + 15;
    return `<g transform="rotate(${a})"><rect x="-2" y="-2400" width="4" height="1860" fill="#000" opacity=".55"/><rect x="2" y="-2400" width="2" height="1860" fill="#fff" opacity=".035"/></g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <polygon id="trap" points="${trap}"/>
    <!-- Máscara: branco = metal; preto = vidro (buraco) -->
    <mask id="furos" maskUnits="userSpaceOnUse" x="-9999" y="-9999" width="19999" height="19999">
      <rect x="-9999" y="-9999" width="19999" height="19999" fill="#fff"/>
      <circle r="${R_CENTRAL}" fill="#000"/>
      <g fill="#000" stroke="#000" stroke-width="26" stroke-linejoin="round">${seis('<use href="#trap"/>')}</g>
    </mask>
    <clipPath id="vidros">
      <circle r="${R_CENTRAL}"/>
      ${seis(`<polygon points="${trap}"/>`)}
    </clipPath>

    <radialGradient id="parede" cx="0" cy="0" r="1400" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#1c2230"/>
      <stop offset=".45" stop-color="#11141c"/>
      <stop offset="1" stop-color="#050609"/>
    </radialGradient>
    <linearGradient id="flange" x1="-520" y1="-520" x2="520" y2="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8b95a8"/>
      <stop offset=".22" stop-color="#3b4252"/>
      <stop offset=".5" stop-color="#1a1e27"/>
      <stop offset=".78" stop-color="#394154"/>
      <stop offset="1" stop-color="#6d7890"/>
    </linearGradient>
    <radialGradient id="domo" cx="0" cy="-40" r="470" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#3a4252"/>
      <stop offset=".6" stop-color="#232834"/>
      <stop offset="1" stop-color="#11141b"/>
    </radialGradient>
    <linearGradient id="aro" x1="0" y1="-1" x2="0" y2="1">
      <stop offset="0" stop-color="#a9b6cc"/>
      <stop offset=".5" stop-color="#2a303c"/>
      <stop offset="1" stop-color="#58637a"/>
    </linearGradient>
    <radialGradient id="parafuso" cx=".35" cy=".35" r=".7">
      <stop offset="0" stop-color="#c9d2e0"/>
      <stop offset=".5" stop-color="#596377"/>
      <stop offset="1" stop-color="#1b1f28"/>
    </radialGradient>
    <linearGradient id="reflexo" x1="-400" y1="-400" x2="300" y2="300" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff" stop-opacity=".10"/>
      <stop offset=".35" stop-color="#fff" stop-opacity=".02"/>
      <stop offset=".36" stop-color="#fff" stop-opacity=".07"/>
      <stop offset=".42" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vinheta" cx="0" cy="0" r="1500" gradientUnits="userSpaceOnUse">
      <stop offset=".35" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".75"/>
    </radialGradient>

    <!-- Luz azul da Terra "vazando" pelos vidros e iluminando o metal -->
    <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="28"/>
    </filter>
    <!-- Granulação de metal escovado -->
    <filter id="grao" x="0" y="0" width="100%" height="100%" filterUnits="userSpaceOnUse">
      <feTurbulence type="fractalNoise" baseFrequency="${(0.9 / escala).toFixed(3)}" numOctaves="2" seed="7"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/>
    </filter>
  </defs>

  <g transform="translate(${cx} ${cy}) scale(${escala})">
    <g mask="url(#furos)">
      <!-- 1. Parede interna da estação -->
      <rect x="-9999" y="-9999" width="19999" height="19999" fill="url(#parede)"/>
      ${emendas}
      <circle r="640" fill="none" stroke="#000" stroke-width="10" opacity=".5"/>
      <circle r="646" fill="none" stroke="#fff" stroke-width="2" opacity=".05"/>
      ${parafusos(36, 600, 5, 0.5)}

      <!-- 2. Flange (anel externo da cúpula) -->
      <circle r="490" fill="none" stroke="url(#flange)" stroke-width="60"/>
      <circle r="520" fill="none" stroke="#000" stroke-width="4" opacity=".7"/>
      <circle r="461" fill="none" stroke="#000" stroke-width="6" opacity=".8"/>
      <circle r="516" fill="none" stroke="#fff" stroke-width="1.5" opacity=".25"/>
      ${parafusos(48, 490, 5.5)}

      <!-- 3. Domo (estrutura entre as janelas) -->
      <circle r="458" fill="url(#domo)"/>
      <!-- luz da Terra refletida no metal -->
      <g filter="url(#brilho)" fill="#5d9be0" opacity=".42">
        <circle r="${R_CENTRAL + 10}"/>
        <g stroke="#5d9be0" stroke-width="40" stroke-linejoin="round">${seis('<use href="#trap"/>')}</g>
      </g>

      <!-- 4. Molduras das janelas laterais (gaxeta escura + aro metálico + fio de luz) -->
      <g fill="none" stroke-linejoin="round">
        <g stroke="#07090d" stroke-width="66">${seis('<use href="#trap"/>')}</g>
        <g stroke="url(#aro)" stroke-width="50" opacity=".9">${seis('<use href="#trap"/>')}</g>
        <g stroke="#0b0e14" stroke-width="34">${seis('<use href="#trap"/>')}</g>
        <g stroke="#9fb4d6" stroke-width="28" opacity=".35">${seis('<use href="#trap"/>')}</g>
      </g>
      <!-- parafusos das janelas laterais -->
      ${seis(`${[0.18, 0.5, 0.82].map((t) => {
        const y = -(INT + (EXT - INT) * t);
        const hw = (INT + (EXT - INT) * t) * 0.46 + 26;
        return `<circle cx="${-hw}" cy="${y}" r="4.5" fill="url(#parafuso)"/><circle cx="${hw}" cy="${y}" r="4.5" fill="url(#parafuso)"/>`;
      }).join('')}`)}

      <!-- 5. Moldura da janela central -->
      <circle r="${R_CENTRAL + 20}" fill="none" stroke="#07090d" stroke-width="20"/>
      <circle r="${R_CENTRAL + 13}" fill="none" stroke="url(#aro)" stroke-width="16"/>
      <circle r="${R_CENTRAL + 3}" fill="none" stroke="#0b0e14" stroke-width="6"/>
      <circle r="${R_CENTRAL + 1}" fill="none" stroke="#a9c2e8" stroke-width="2" opacity=".5"/>
      ${parafusos(16, R_CENTRAL + 13, 3.8, 0.5)}

      <!-- 6. Manivelas das persianas, entre as janelas -->
      ${seis('<g transform="rotate(30)"><rect x="-9" y="-445" width="18" height="30" rx="5" fill="#2a303c" stroke="#000" stroke-opacity=".6" stroke-width="2"/><circle cy="-430" r="5" fill="url(#parafuso)"/></g>')}

      <!-- 7. Granulação + vinheta -->
      <rect x="-9999" y="-9999" width="19999" height="19999" filter="url(#grao)"/>
      <rect x="-9999" y="-9999" width="19999" height="19999" fill="url(#vinheta)"/>
    </g>

    <!-- 8. Reflexos quase invisíveis nos vidros (dão a sensação de vidro sem esconder o céu) -->
    <g clip-path="url(#vidros)">
      <rect x="-600" y="-600" width="1200" height="1200" fill="url(#reflexo)"/>
    </g>
  </g>
</svg>`;
}

async function gerarJanela() {
  // Desktop 16:9 — o flange ocupa ~96% da altura
  const W = 4000, H = 2250;
  await sharp(Buffer.from(svgJanela(W, H, (H * 0.48) / 520)))
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(salvar('spaceship-window.webp'));
  // Versão menor (telas até 1440px)
  await sharp(salvar('spaceship-window.webp')).resize(2400).webp({ quality: 80, alphaQuality: 90 }).toFile(salvar('spaceship-window-2400.webp'));

  // Celular (retrato 9:19.5) — o flange passa um pouco das bordas laterais
  const w = 1170, h = 2532;
  await sharp(Buffer.from(svgJanela(w, h, (w * 0.56) / 520)))
    .webp({ quality: 82, alphaQuality: 90, effort: 6 })
    .toFile(salvar('spaceship-window-mobile.webp'));
  console.log('janela:', tamanho(salvar('spaceship-window.webp')), '/', tamanho(salvar('spaceship-window-2400.webp')), '/ mobile', tamanho(salvar('spaceship-window-mobile.webp')));
}

// =========================================================
// FOTOS
// =========================================================
async function gerarFotos() {
  // Terra + Lua (quadrada 5250px): corta o topo vazio → 5250x3413, a Lua fica logo acima do centro da janela (acima do logo)
  const terra = await baixar('terra');
  const base = sharp(terra).extract({ left: 0, top: 1837, width: 5250, height: 3413 });
  await base.clone().resize(2400).webp({ quality: 78 }).toFile(salvar('space-earth.webp'));
  await base.clone().resize(1280).webp({ quality: 76 }).toFile(salvar('space-earth-1280.webp'));
  console.log('space-earth:', tamanho(salvar('space-earth.webp')));

  // Céu azul: faixa vertical 1:2 da foto de 1962; mediana tira os pontinhos de poeira do filme
  const nuvens = await baixar('nuvens');
  const ceu = sharp(nuvens).extract({ left: 1318, top: 0, width: 2635, height: 5270 }).median(5).resize(2000, 4000).modulate({ saturation: 1.1 });
  await ceu.clone().avif({ quality: 52, effort: 6 }).toFile(salvar('sky-about.avif'));
  await ceu.clone().webp({ quality: 74 }).toFile(salvar('sky-about.webp'));
  console.log('sky-about:', tamanho(salvar('sky-about.avif')), '(avif)', tamanho(salvar('sky-about.webp')), '(webp)');

  // Serviços: 1200x1500 (4:5), com foco escolhido a dedo em cada foto
  const servicos = [
    ['lancamento', 'launch.webp', 'attention'],
    ['nebulosa', 'nebula.webp', 'centre'],
    ['caminhada', 'spacewalk.webp', 'attention'],
    ['aurora', 'aurora.webp', 'centre'],
    ['capacete', 'helmet.webp', 'north'],
  ];
  for (const [fonte, nome, pos] of servicos) {
    await sharp(await baixar(fonte)).resize(960, 1200, { fit: 'cover', position: pos }).webp({ quality: 76 }).toFile(path.join(SAIDA, 'services', nome));
  }
  console.log('serviços: ok');
}

// Ruído 240x240 (textura .noise)
async function gerarRuido() {
  const n = 240, px = Buffer.alloc(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const v = Math.floor(Math.random() * 255);
    px.set([v, v, v, 255], i * 4);
  }
  await sharp(px, { raw: { width: n, height: n, channels: 4 } }).png({ compressionLevel: 9 }).toFile(salvar('noise.png'));
}

// Imagem de compartilhamento (Open Graph) 1200x630: Terra + janela + marca
async function gerarOG() {
  const fundo = await sharp(salvar('space-earth.webp')).resize(1200, 630, { fit: 'cover', position: 'centre' }).toBuffer();
  const janela = await sharp(Buffer.from(svgJanela(1200, 630, (630 * 0.48) / 520))).png().toBuffer();
  const texto = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <rect width="1200" height="630" fill="#000" opacity=".25"/>
    <text x="600" y="330" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="46" letter-spacing="10" fill="#fff">AURORA</text>
    <text x="600" y="580" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#fff" opacity=".85">Pareça premium. Venda mais.</text>
  </svg>`);
  await sharp(fundo).composite([{ input: janela }, { input: texto }]).jpeg({ quality: 82 }).toFile(salvar('og-image.jpg'));
}

// Máscara de continentes para o globo: grade 180x90 (2° por célula) → base64
async function gerarMapa() {
  const mapa = await baixar('mapa');
  const { data, info } = await sharp(mapa).resize(180, 90, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const bits = new Uint8Array(Math.ceil((180 * 90) / 8));
  for (let i = 0; i < 180 * 90; i++) {
    const r = data[i * info.channels], g = data[i * info.channels + 1], b = data[i * info.channels + 2];
    const oceano = b > r + 8 && b > g - 4 && r < 90; // o oceano do Blue Marble é azul-escuro
    if (!oceano) bits[i >> 3] |= 1 << (i & 7);
  }
  const b64 = Buffer.from(bits).toString('base64');
  fs.writeFileSync(path.join(CACHE, 'land-mask.txt'), b64);
  console.log('máscara do globo:', b64.length, 'caracteres → cole em LAND_MASK no main.js');
}

(async () => {
  await gerarJanela();
  await gerarFotos();
  await gerarRuido();
  await gerarOG();
  await gerarMapa();
  console.log('\nCréditos (NASA, domínio público):');
  Object.values(FONTES).forEach((f) => console.log(' -', f.credito));
})().catch((e) => { console.error(e); process.exit(1); });
