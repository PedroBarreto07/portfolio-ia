import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { ASSETS } from '../config.js';
import { isMobile } from '../core/math.js';

/**
 * Carrega os assets declarados em config.ASSETS em dois grupos:
 *   'critical' — antes do botão de início (Terra, estrelas, satélite)
 *   'deferred' — em segundo plano, durante a experiência (carro, HDRI, texturas da estrada)
 *
 * GLB com Draco / Meshopt + texturas KTX2 (Basis). Qualquer falha cai no
 * placeholder procedural da cena correspondente.
 *
 * Formato de cada entrada: 'url' ou { url, mobile?, group?, linear?, repeat? }
 */
export class AssetManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.items = {};
    this.groups = {};
    const draco = new DRACOLoader().setDecoderPath('/decoders/draco/');
    const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/basis/').detectSupport(renderer);
    this.gltf = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
    this.tex = new THREE.TextureLoader();
    this.hdr = new HDRLoader().setDataType(THREE.HalfFloatType);
    this.maxAniso = renderer.capabilities.getMaxAnisotropy();
  }

  static normalize(entry) {
    if (!entry) return null;
    return typeof entry === 'string' ? { url: entry } : entry;
  }

  tasks(group) {
    const list = [];
    const mobile = isMobile();
    const add = (prefix, type, obj) => {
      for (const [k, raw] of Object.entries(obj)) {
        const e = AssetManager.normalize(raw);
        if (!e?.url) continue;
        if ((e.group || 'critical') !== group) continue;
        list.push({ key: `${prefix}:${k}`, type, ...e, url: mobile && e.mobile ? e.mobile : e.url });
      }
    };
    add('model', 'gltf', ASSETS.models);
    add('tex', 'tex', ASSETS.textures);
    add('hdri', 'hdr', ASSETS.hdri || {});
    return list;
  }

  async loadOne(task) {
    if (task.type === 'gltf') return this.gltf.loadAsync(task.url);
    if (task.type === 'hdr') {
      const t = await this.hdr.loadAsync(task.url);
      t.mapping = THREE.EquirectangularReflectionMapping;
      return t;
    }
    const tx = await this.tex.loadAsync(task.url);
    tx.colorSpace = task.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tx.anisotropy = Math.min(8, this.maxAniso);
    if (task.repeat) tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    return tx;
  }

  /** Carrega um grupo; `onProgress(0..1)` a cada arquivo concluído. */
  load(group = 'critical', onProgress) {
    if (this.groups[group]) return this.groups[group];
    const list = this.tasks(group);
    let done = 0;
    if (!list.length) onProgress?.(1);
    this.groups[group] = Promise.all(
      list.map(async (task) => {
        try {
          this.items[task.key] = await this.loadOne(task);
        } catch (e) {
          console.warn(`[assets] não foi possível carregar ${task.url} — usando placeholder`, e);
        }
        onProgress?.(++done / list.length);
      })
    );
    return this.groups[group];
  }

  // Compatibilidade: carrega o grupo crítico
  loadAll(onProgress) {
    return this.load('critical', onProgress);
  }

  model(name) {
    return this.items[`model:${name}`] ?? null;
  }

  texture(name) {
    return this.items[`tex:${name}`] ?? null;
  }

  hdri(name) {
    return this.items[`hdri:${name}`] ?? null;
  }
}
