import * as THREE from 'three';

/**
 * Contrato de uma cena:
 *  - build(): monta objetos (pode ser async; usa ctx.assets para GLBs opcionais)
 *  - update(local, dt, time, global): local = progresso 0..1 dentro da faixa da cena
 *  - render(renderer, target): desenha no render target recebido
 *  - enter()/leave(): chamados quando a cena passa a ser (ou deixa de ser) renderizada
 */
export class BaseScene {
  constructor(ctx, def) {
    this.ctx = ctx;
    this.def = def;
    this.id = def.id;
    this.range = def.range;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, ctx.sizes.width / ctx.sizes.height, 0.1, 4000);
    this.clearColor = new THREE.Color(0x000000);
    this.bloom = def.bloom ?? 0.8; // multiplicado por bloomBoost a cada frame
    this.bloomBoost = 1;
    this.active = false;
    this.ready = false;
    this.local = 0;
  }

  async build() {}

  update() {}

  enter() {}

  leave() {}

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  render(renderer, target) {
    renderer.setRenderTarget(target);
    renderer.setClearColor(this.clearColor, 1);
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }

  // Progresso local a partir do global
  toLocal(p) {
    const [a, b] = this.range;
    return (p - a) / (b - a);
  }

  // Global a partir do local (útil para comparar com faixas da config)
  toGlobal(l) {
    const [a, b] = this.range;
    return a + (b - a) * l;
  }
}
