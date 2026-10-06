// Copia os decodificadores Draco / Basis(KTX2) do pacote three para /public/decoders
// para que o carregamento de GLB comprimidos funcione offline.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const libs = resolve(root, 'node_modules/three/examples/jsm/libs');
const out = resolve(root, 'public/decoders');

if (!existsSync(libs)) process.exit(0);
mkdirSync(out, { recursive: true });
for (const dir of ['draco', 'basis']) {
  const src = resolve(libs, dir);
  if (existsSync(src)) cpSync(src, resolve(out, dir), { recursive: true });
}
console.log('[decoders] Draco + Basis copiados para public/decoders');
