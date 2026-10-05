// Copia as bibliotecas de node_modules/ para assets/vendor/, a pasta usada pelas páginas.
// Roda sozinho depois do "npm install". A pasta assets/vendor já vem pronta no projeto,
// então o site funciona mesmo sem instalar nada.
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
const destino = path.join(raiz, 'assets', 'vendor');
fs.mkdirSync(destino, { recursive: true });

const arquivos = [
  'node_modules/gsap/dist/gsap.min.js',
  'node_modules/gsap/dist/ScrollTrigger.min.js',
  'node_modules/lenis/dist/lenis.min.js',
  'node_modules/lenis/dist/lenis.css',
  'node_modules/@barba/core/dist/barba.umd.js',
  'node_modules/particles.js/particles.js',
];

for (const arquivo of arquivos) {
  const origem = path.join(raiz, arquivo);
  if (!fs.existsSync(origem)) { console.warn('não encontrado (pulando):', arquivo); continue; }
  fs.copyFileSync(origem, path.join(destino, path.basename(arquivo)));
  console.log('copiado:', path.basename(arquivo));
}
