// Baixa os assets originais (NASA, Khronos, Poly Haven) para /assets-src.
// Depois rode `npm run assets:process` para gerar as versões otimizadas em /public/assets.
// Uso: node scripts/fetch-assets.mjs
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const root = resolve(import.meta.dirname, '..');
const SRC = resolve(root, 'assets-src');

const NASA_BMNG = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december';
const NASA_3D = 'https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models';
const PH = 'https://dl.polyhaven.org/file/ph-assets';

export const SOURCES = [
  // Terra — NASA Blue Marble Next Generation (topografia + batimetria, dezembro) — domínio público
  ['earth/bluemarble_21600.jpg', `${NASA_BMNG}/world.topo.bathy.200412.3x21600x10800.jpg`],
  // Luzes noturnas — NASA Black Marble 2012 — domínio público
  ['earth/blackmarble_3km.jpg', 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144875/BlackMarble_2012_3km.jpg'],
  // Nuvens — NASA Blue Marble clouds (8192×4096) — domínio público
  ['earth/clouds_8192.tif', 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif'],
  // Céu estrelado — NASA SVS Deep Star Maps 2020 — domínio público
  ['space/starmap_2020_4k.exr', 'https://svs.gsfc.nasa.gov/vis/a000000/a004800/a004851/starmap_2020_4k.exr'],
  // Satélite de comunicações — NASA 3D Resources (SSL-1300)
  ['models/ssl1300.glb', `${NASA_3D}/Space%20Systems%20Loral%20(SSL-1300)/Space%20Systems%20Loral%20(SSL-1300).glb`],
  // Carro conceito — Khronos glTF Sample Assets — CC BY 4.0 (Darmstadt Graphics Group / Eric Chadwick)
  ['models/carconcept.glb', 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb'],
  // Ambiente — Poly Haven "Lago d'Isola" (Alpes) — CC0
  ['hdri/lago_disola_2k.hdr', `${PH}/HDRIs/hdr/2k/lago_disola_2k.hdr`],
  ['hdri/lago_disola_tonemapped.jpg', `${PH}/HDRIs/extra/Tonemapped%20JPG/lago_disola.jpg`],
  // Texturas PBR — Poly Haven — CC0
  ['textures/asphalt_02_diff.jpg', `${PH}/Textures/jpg/2k/asphalt_02/asphalt_02_diff_2k.jpg`],
  ['textures/asphalt_02_nor.jpg', `${PH}/Textures/jpg/2k/asphalt_02/asphalt_02_nor_gl_2k.jpg`],
  ['textures/asphalt_02_arm.jpg', `${PH}/Textures/jpg/2k/asphalt_02/asphalt_02_arm_2k.jpg`],
  ['textures/snow_02_diff.jpg', `${PH}/Textures/jpg/2k/snow_02/snow_02_diff_2k.jpg`],
  ['textures/snow_02_nor.jpg', `${PH}/Textures/jpg/2k/snow_02/snow_02_nor_gl_2k.jpg`],
  ['textures/snow_02_arm.jpg', `${PH}/Textures/jpg/2k/snow_02/snow_02_arm_2k.jpg`],
  ['textures/rocks_ground_02_diff.jpg', `${PH}/Textures/jpg/2k/rocks_ground_02/rocks_ground_02_col_2k.jpg`],
  ['textures/rocks_ground_02_nor.jpg', `${PH}/Textures/jpg/2k/rocks_ground_02/rocks_ground_02_nor_gl_2k.jpg`],
  ['textures/rocks_ground_02_arm.jpg', `${PH}/Textures/jpg/2k/rocks_ground_02/rocks_ground_02_arm_2k.jpg`],
];

async function download(rel, url) {
  const dest = resolve(SRC, rel);
  if (existsSync(dest) && statSync(dest).size > 1000) {
    console.log(`✓ ${rel} (já existe)`);
    return;
  }
  mkdirSync(dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 nexora-asset-fetch' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  console.log(`↓ ${rel} (${(statSync(dest).size / 1e6).toFixed(1)} MB)`);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('fetch-assets.mjs')) {
  const queue = [...SOURCES];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const [rel, url] = queue.shift();
      try {
        await download(rel, url);
      } catch (e) {
        console.error(`✗ ${rel}: ${e.message}`);
        process.exitCode = 1;
      }
    }
  });
  await Promise.all(workers);
}
